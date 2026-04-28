# Auditoria 4.5.4 — Segurança Mobile

> **Tipo:** read-only (AndroidManifest, build.gradle, network_security_config, dist scan)
> **Data:** 2026-04-28

## Score: 6/10

| Dimensão | Score | Nota |
|---|---|---|
| Network Security Config | 9 | Cleartext blocked, SSL pinning Supabase (3 pins) ativo |
| Cert pinning Vercel domain | 0 | dosy-teal.vercel.app sem pinning |
| ProGuard/R8 obfuscation | 0 | `minifyEnabled false` em release ⚠️ |
| Allow backup desabilitado | 10 | `allowBackup="false"` + `data_extraction_rules` |
| FLAG_SECURE em telas sensíveis | 0 | Nenhuma tela usa FLAG_SECURE — info médica vaza no app switcher / screen recording |
| Mask em background | 0 | Sem screenshot mask em recents view |
| Detecção root/jailbreak | 0 | Sem plugin/lógica |
| Biometria opcional | 0 | Não implementada |
| Play Integrity API | 0 | Não integrada |
| Secrets em bundle | 9 | Apenas anon key (público — esperado). Sem service_role/PAT/FCM private |
| Permissões Android | 9 | Lista enxuta, sem permissões suspeitas |
| OWASP Mobile Top 10 | ? | Não pen-testado profissionalmente |

## Permissões declaradas (AndroidManifest)
- INTERNET, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, USE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED, WAKE_LOCK, VIBRATE, USE_FULL_SCREEN_INTENT, ACCESS_NOTIFICATION_POLICY, TURN_SCREEN_ON, DISABLE_KEYGUARD, FOREGROUND_SERVICE, FOREGROUND_SERVICE_SPECIAL_USE, SYSTEM_ALERT_WINDOW
- Todas justificadas (alarme crítico full-screen estilo despertador)

## Gaps

### CRÍTICO (P0)
- **G1.** `minifyEnabled false` em release. ProGuard/R8 NÃO aplicado:
  - APK pode ser decompilado trivial (jadx) — lógica de negócio + RPC names + URLs visíveis
  - Bundle 30-50% maior do que poderia
  - Daily-money 3.5 / OWASP MASVS L1 exigem
- **G2.** ZERO uso de FLAG_SECURE em screens com info médica:
  - DoseModal, PatientDetail, Reports, DoseHistory leak em screen recording / app switcher / accessibility services maliciosos
  - Saúde = dado sensível LGPD, mandatory pra compliance

### ALTO (P1)
- **G3.** Sem mask em background (recents/multitasking view):
  - Capacitor não tem plugin built-in pra isso. Solução: native code em MainActivity ou `@capacitor-community/privacy-screen`
- **G4.** Sem detecção root/jailbreak. App de saúde em device rooted = risco LGPD elevado.
- **G5.** Sem cert pinning pra `dosy-teal.vercel.app` (Vercel hospeda APK + version.json). MITM em /version.json poderia injetar falso "update available" → user baixa APK malicioso. Mitigação parcial: APK é assinado, install só funciona se signature bater.
- **G6.** Sem Google Play Integrity API. Permite install de APK modificado.
- **G7.** Sem biometria pra abrir app. Opcional mas recomendado em saúde.

### MÉDIO (P2)
- **G8.** Sem auto-lock após N minutos em background.
- **G9.** Sem logout remoto multi-device / lista de sessões ativas.
- **G10.** Sem 2FA opcional.
- **G11.** Sem criptografia client-side de `observation` (campo médico sensível).

### BAIXO (P3)
- **G12.** `BootReceiver` exported=true. Necessário pra receber BOOT_COMPLETED, mas verificar se action filter restringe corretamente.
- **G13.** AdMob test ID hardcoded como fallback em AdBanner.jsx — verificar se string `ca-app-pub-3940256099942544/6300978111` ainda no bundle prod (usar real via env só em prod).

## Top 7 Recomendações
1. **`minifyEnabled true`** + proguard rules tested (S) — P0 imediato
2. **FLAG_SECURE** em DoseModal + PatientDetail + Reports + DoseHistory (S) — P0 antes Beta
3. Plugin privacy-screen / mask em recents (S) — P1
4. Cert pinning Vercel (S) — P1
5. Play Integrity API (M) — P1 antes prod
6. Biometria opcional + auto-lock (M) — P1
7. Detecção root + warn (S) — P1
