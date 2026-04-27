# RIPD — Relatório de Impacto à Proteção de Dados
## Dosy — Abril 2026

> **LGPD Art. 38** — Documento interno de registro do tratamento de dados pessoais.
> Atualizar sempre que novas Edge Functions ou fluxos de dados forem adicionados.

---

## 1. Identificação

**Nome do produto:** Dosy
**Finalidade:** Aplicativo de gestão pessoal de medicamentos e doses para pacientes e cuidadores.
**Plataforma:** Android (APK via Play Store) + PWA (Vercel — versão legada 1.0)
**Categoria de dados:** Dados de saúde — categoria especial (LGPD Art. 11)

---

## 2. Controlador

**Nome:** [a preencher pelo responsável]
**E-mail de contato (DPO):** [a preencher]
**Domicílio legal:** Brasil

---

## 3. Subprocessadores

| Subprocessador | Função | Localização | Base legal | DPA |
|---|---|---|---|---|
| Supabase Inc. | Banco de dados PostgreSQL + Autenticação + Edge Functions | EUA (AWS sa-east-1 / São Paulo) | Contrato + Art. 33, II LGPD | https://supabase.com/legal/dpa |
| Vercel Inc. | Hospedagem da PWA (versão 1.0) | EUA (Edge Network global) | Contrato | https://vercel.com/legal/dpa |
| Google LLC | Distribuição (Play Store) e FCM (futuro) | EUA | Contrato | https://policies.google.com/privacy |
| RevenueCat (futuro) | Monetização IAP | EUA | Contrato | https://www.revenuecat.com/dpa |

---

## 4. Edge Functions — fluxos de dados pessoais

### 4.1 `notify-doses`

| Campo | Valor |
|---|---|
| **Projeto** | `dosy-app` (org Dosy) |
| **Trigger** | Cron externo (1× / minuto) |
| **PII processado** | `userId`, `medName`, `unit`, `scheduledAt`, `endpoint` (push subscription), `keys` |
| **Categoria** | Dado de saúde (Art. 11 LGPD) |
| **Finalidade** | Enviar lembretes Web Push sobre doses próximas |
| **Retenção** | Não armazena — apenas lê `push_subscriptions` e `doses`, envia notificação e descarta |
| **Compartilhamento** | Push enviado via servidor do navegador do usuário (Mozilla/Google) — body criptografado VAPID |
| **Base legal** | Consentimento explícito (usuário ativa notificações) |

### 4.2 `delete-account`

| Campo | Valor |
|---|---|
| **Projeto** | `dosy-app` (org Dosy) |
| **Trigger** | Chamada autenticada do app (botão "Excluir minha conta") |
| **PII processado** | `userId` + cascata em todos os dados do usuário (patients, treatments, doses, etc.) |
| **Categoria** | Dado de saúde (Art. 11 LGPD) |
| **Finalidade** | Direito ao Esquecimento (Art. 18, VI LGPD) |
| **Retenção** | Apaga permanentemente — sem backup |
| **Compartilhamento** | Nenhum |
| **Base legal** | Direito do titular (Art. 18) |

### 4.3 `admin_grant_tier` (RPC, não Edge Function)

| Campo | Valor |
|---|---|
| **Projeto** | `dosy-app` |
| **Trigger** | Painel admin (apenas usuários na tabela `medcontrol.admins`) |
| **PII processado** | `userId` alvo, `tier`, `expires` |
| **Finalidade** | Conceder/revogar plano PRO |
| **Auditoria** | Toda chamada gera linha em `medcontrol.security_events` |
| **Retenção `security_events`** | 1 ano |
| **Base legal** | Legítimo interesse (gestão de assinaturas) |

---

## 5. Dados coletados pelo aplicativo

| Dado | Categoria | Local de armazenamento | Base legal LGPD |
|---|---|---|---|
| E-mail | PII básico | `auth.users` | Art. 7, V (execução de contrato) |
| Nome do paciente | PII | `medcontrol.patients` | Art. 11, II, a (consentimento) |
| Data de nascimento (paciente) | PII | `medcontrol.patients` | Art. 11, II, a |
| Medicamentos (nome, dose, unidade) | Saúde — categoria especial | `medcontrol.treatments`, `medcontrol.doses` | Art. 11, II, a |
| Horários de dose | Saúde | `medcontrol.doses` | Art. 11, II, a |
| Observações clínicas (limitadas a 500 chars) | Saúde | `medcontrol.doses.observation` | Art. 11, II, a |
| Push subscription (endpoint, keys) | Técnico | `medcontrol.push_subscriptions` | Art. 7, I (consentimento) |
| Plataforma (Android/Web) | Técnico | `medcontrol.push_subscriptions.platform` | Art. 7, IX (legítimo interesse) |
| Eventos de segurança (login, exclusão) | Auditoria | `medcontrol.security_events` | Art. 7, II (cumprimento de obrigação legal) |

---

## 6. Medidas técnicas e organizacionais (Art. 46 LGPD)

| Medida | Implementação |
|---|---|
| Criptografia em trânsito | TLS 1.3 obrigatório (`network_security_config.xml` + Vercel HTTPS) |
| Criptografia em repouso | AWS RDS encryption (Supabase) |
| Controle de acesso | Row Level Security (RLS) em todas as tabelas, FORCE RLS ativo |
| Princípio do menor privilégio | RLS por `auth.uid()` + tabela `admins` para escalonamento |
| Validação server-side | RPCs `register_sos_dose`, `confirm_dose` etc. — atacante não bypassa lógica via REST direto |
| Anonimização | `pg_cron` job semanal anonimiza observações com +3 anos |
| Rate limiting | Auth: 5 OTP/min, 30 anon/h, 150 token refresh/min |
| Senha forte | Mín 8 chars, mínimo 1 letra minúscula + 1 maiúscula + 1 dígito |
| Auditoria | Tabela `security_events` registra mudanças sensíveis |
| Direito de acesso (Art. 18, II) | Função "Exportar meus dados" em Settings |
| Direito de exclusão (Art. 18, VI) | Edge Function `delete-account` |
| Backup desativado em mobile | `allowBackup="false"` + `data_extraction_rules.xml` (LGPD: dados de saúde) |
| SSL Pinning | Configurado em `network_security_config.xml` (a ativar antes do launch público) |

---

## 7. Notificação de incidentes (Art. 48 LGPD)

Em caso de incidente de segurança que afete dados pessoais, o controlador notificará a ANPD em prazo razoável (24-72h conforme avaliação de risco). Logs disponíveis em `medcontrol.security_events` para apoio à investigação.

---

## 8. Histórico de revisões

| Data | Versão | Mudança |
|---|---|---|
| 2026-04-26 | 1.0 | Criação inicial. Migração para projeto `dosy-app` na org Dosy (Supabase). |
