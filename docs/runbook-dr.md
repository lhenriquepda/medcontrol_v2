# Runbook — Disaster Recovery (DR) Dosy

> **Versão:** v1.0 (2026-05-05) · v0.2.1.0
> **Última verificação baseline:** 2026-05-05 (counts em §3)
> **Owner:** Dosy Med LTDA · DPO `privacidade@dosymed.app`

---

## 1. Escopo + RTO/RPO

| Métrica | Alvo | Justificativa |
|---|---|---|
| RTO (Recovery Time Objective) | **5–15 min** | Daily backup restore Supabase Dashboard one-click |
| RPO (Recovery Point Objective) | **máx 24h** | Daily backup retenção 7 dias (plano Pro) |
| MTTR (Mean Time to Recover) alvo | **<30 min** | Inclui detecção + decisão + restore + validação |
| Severity 1 (data loss) detection | **<10 min** | Sentry + alertas Supabase + user reports |

**PITR (Point-in-Time Recovery):** desabilitado (decisão #009 v0.2.0.11 — DEFERRED $100/mo add-on). Re-avaliar quando Dosy gerar revenue (Q3 2026 ou 50+ paying users). Sem PITR, RPO é discreto (snapshots diários 03:00 UTC) — não contínuo.

---

## 2. Componentes críticos + caminhos de falha

| Componente | Provider | Failure modes | Recovery |
|---|---|---|---|
| **Database (Postgres)** | Supabase Pro `sa-east-1` (São Paulo) | Drop table acidental, migration broken, corruption, region outage | Daily backup restore |
| **Auth (JWT)** | Supabase Auth | JWT secret leak, user deletion accidental | Roll JWT secret + restore auth.users |
| **Edge Functions** | Supabase Edge | Deploy broken, env var corrupted | Re-deploy via Supabase CLI git history |
| **Realtime** | Supabase Realtime | Channel leak, postgres_changes stuck | Restart Realtime via Dashboard |
| **Storage (avatares)** | Supabase Storage `patient-photos` bucket | Bucket deletion, RLS broken | Re-upload from device localStorage cache (#115 photo_version) |
| **FCM Push** | Google Firebase | Token revoked, project quota | Re-init via Firebase Console |
| **Email (Resend SMTP)** | Resend | API key revoked, domain DKIM broken | Verify dosymed.app DNS + rotate API key |
| **Email forward (ImprovMX)** | ImprovMX | DNS MX broken | Re-verify Hostinger DNS records |
| **CDN (Vercel)** | Vercel | Build broken, custom domain DNS | Rollback via Vercel Dashboard |
| **AAB build** | EAS / GitHub Actions | Keystore corrupted, signing broken | Restore keystore from #021 backup (1Password + pendrive + cloud) |

---

## 3. Baseline produção (referência pré-incidente)

**Snapshot 2026-05-05 v0.2.0.12:**

| Tabela | Counts |
|---|---|
| `auth.users` | 5 |
| `medcontrol.patients` | 6 |
| `medcontrol.treatments` | 33 |
| `medcontrol.doses` | 582 |
| `medcontrol.subscriptions` | 5 |
| `medcontrol.push_subscriptions` | 10 |
| `medcontrol.dose_notifications` | ~1500 |
| `medcontrol.security_events` | ~50 |

**Atualizar baseline:** rodar SQL `SELECT count(*) FROM <tabela>` mensalmente, registrar em `contexto/decisoes/YYYY-MM-DD-baseline-prod.md`.

---

## 4. Procedure: Restore Daily Backup Supabase

### 4.1 Cenário aplicável
- Drop table acidental
- Migration corrompeu schema
- Mass UPDATE/DELETE accidental
- Disaster region (São Paulo down — provável zero, mas possível)

### 4.2 Passos (RTO ~10min)

1. **Detectar** via Sentry alert OR user report OR Supabase Dashboard alert
2. **Confirmar severity:** Slack #incidents + criar issue GitHub label `S1`
3. **Comunicar** users via email broadcast `noreply@dosymed.app` (template em `docs/incident-comm-template.md` — TODO criar)
4. **Acessar Supabase Dashboard:** https://supabase.com/dashboard/project/guefraaqbkcehofchnrc → Settings → Database → Backups
5. **Listar backups disponíveis:** 7 daily snapshots (último ~03:00 UTC)
6. **Selecionar timestamp:** o mais recente PRÉ-incidente (NÃO o último — pode conter dados corrompidos)
7. **Click "Restore" → Confirm:**
   - ⚠️ Aviso: backup substitui DATABASE atual completo (inclui migrations + data)
   - Backup atual stack salvo automaticamente como rollback
8. **Aguardar:** restore ~3-8min para 582 doses dataset atual; cresce linear
9. **Validar pós-restore:**
   ```sql
   SELECT count(*) FROM auth.users;
   SELECT count(*) FROM medcontrol.doses;
   SELECT count(*) FROM medcontrol.patients;
   ```
   Comparar contra baseline §3 (esperar -X% dependendo timing).
10. **Smoke test app:** login `teste-plus@teste.com / 123456` → cadastrar 1 dose → confirma persiste → marcar tomada.
11. **Re-deploy Edge Functions** (se PostgREST schema mudou): `supabase functions deploy --project-ref guefraaqbkcehofchnrc`.
12. **Documentar incidente:** `contexto/decisoes/YYYY-MM-DD-incident-S<num>.md` com: timeline, causa raiz, RTO real, RPO real, lições aprendidas.

### 4.3 Quando NÃO restaurar
- Incidente afeta apenas 1 user → fix manual via SQL Dashboard (mais rápido + sem regressão pra outros users)
- Bug código frontend (não atinge DB) → revert + re-deploy Vercel sem tocar DB
- Migration nova com bug → rollback migration via `DROP` na Dashboard SQL Editor

---

## 5. Procedure: Roll JWT secret (compromised key)

Per #084 (incidente 2026-05-02): se JWT secret leak (e.g. commitado público GitHub):

1. **Imediato:** Supabase Dashboard → Settings → API → "Roll JWT Secret"
2. **Resultado:** todos JWTs antigos invalidados; sessions ativas forçadas re-login
3. **Atualizar:** `VITE_SUPABASE_ANON_KEY` em Vercel Project env (production + preview branches)
4. **Atualizar:** `.env.local` + `.env.production` git-tracked
5. **Rebuild AAB Android:** vc bump + gradle build + assinar + push Internal Testing
6. **Rebuild Vercel:** force redeploy `master` + `release/*`
7. **Auditar logs Supabase:** Auth/REST janela ataque (timestamp do leak detection)
8. **Comunicar users:** caso suspeita exfiltração dados, email broadcast obrigatório (LGPD art.48 ANPD notification 72h)

---

## 6. Procedure: Restore keystore Android (#021)

⚠️ **Crítico:** keystore perdido = app **morto** no Play Store, **impossível** publicar updates futuros.

### 6.1 Backup atual (3 locais)
- ✅ Local 1: 1Password vault (encrypted, sync cloud)
- ⏳ Local 2: pendrive offline VeraCrypt (TODO #021)
- ⏳ Local 3: cloud cifrado pCloud Crypto (TODO #021)

### 6.2 Recovery passos
1. Recuperar `dosy-release-key.jks` de 1Password Notes "Dosy Keystore"
2. Recuperar `keystore.password` + `keyAlias` + `keyPassword` (anotados separados)
3. Colocar arquivo em `android/app/dosy-release-key.jks` local
4. Atualizar `android/gradle.properties`:
   ```properties
   DOSY_RELEASE_STORE_FILE=dosy-release-key.jks
   DOSY_RELEASE_STORE_PASSWORD=<from 1Password>
   DOSY_RELEASE_KEY_ALIAS=<from 1Password>
   DOSY_RELEASE_KEY_PASSWORD=<from 1Password>
   ```
5. Build AAB: `cd android && ./gradlew bundleRelease`
6. Upload Play Console Internal Testing → confirma assinatura válida.

---

## 7. Procedure: Region outage Supabase São Paulo

Cenário low-prob mas alto impacto. AWS sa-east-1 outages históricos ~1-4h.

1. **Detectar:** Sentry erro spike + Supabase Status page (status.supabase.com)
2. **Comunicar:** banner app via Vercel env var `VITE_MAINTENANCE_BANNER=true` → UpdateBanner mostra alerta
3. **Esperar:** Supabase team notifica recovery em status page
4. **Validar:** post-recovery, smoke test ler/escrever DB
5. **Documentar:** incidente externo, sem ação Dosy required além comunicação

---

## 8. Pós-incidente (always-do)

| Passo | Quem | Quando |
|---|---|---|
| Documentar timeline + causa raiz | Owner | 24h pós-incidente |
| RCA (Root Cause Analysis) | Owner | 48h pós-incidente |
| Action items preventivos | Owner | Sprint seguinte |
| Comunicação user (LGPD art.48 se data breach) | DPO `privacidade@dosymed.app` | 72h se PII vazou |
| Update baseline §3 | Owner | Mensal mesmo sem incidente |

---

## 9. Drill schedule

- **Test restore staging:** semestral. Criar Supabase project staging + restaurar backup prod recente + validar contagens. Nunca testar em prod.
- **Smoke test recovery:** anual full drill (drop table staging → restore → cronometra RTO real).

---

## 10. Contatos emergência

| Função | Contato |
|---|---|
| Owner técnico | Luiz Henrique (lhenrique.pda@gmail.com) |
| DPO LGPD | `privacidade@dosymed.app` |
| Suporte usuários | `suporte@dosymed.app` |
| Security disclosure | `security@dosymed.app` |
| Supabase support (Pro plan) | https://supabase.com/dashboard/support |
| Resend support | support@resend.com |
| ImprovMX support | support@improvmx.com |

---

## 11. Histórico revisões

| Data | Versão | Mudança |
|---|---|---|
| 2026-05-05 | v1.0 | Criação inicial (Dosy v0.2.1.0) — baseline §3 capturado |

---

**Próximas iterações:**
- v1.1: criar `docs/incident-comm-template.md` (template email broadcast users)
- v1.2: PITR re-avaliação quando Dosy gerar revenue
- v1.3: drill staging executado (data + RTO real medido)
