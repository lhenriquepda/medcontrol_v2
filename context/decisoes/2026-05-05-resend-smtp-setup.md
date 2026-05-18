# 2026-05-05 — ADR: Custom SMTP Resend pra dosymed.app

**Status:** Aceita
**Release:** v0.2.0.12
**Item ROADMAP:** #154
**Sessão:** Recovery senha OTP (#153) descobriu rate limit Supabase built-in 2 emails/h hardcoded.

## Contexto

Implementação OTP recovery (#153 v0.2.0.12) substituiu magic-link broken (#147 BUG-041). Ao testar real, user atingiu rate limit Supabase built-in:
> "over_request_rate_limit" / 429 / "Aguarde 1 minuto"

Investigação Dashboard Auth → Rate Limits revelou:
- **Built-in email service Supabase: 2 emails/h projeto inteiro (hardcoded, sem custom SMTP)**
- Tentativa bumpar pra 30/h → erro: "Custom SMTP required to configure RATE_LIMIT_EMAIL_SENT. Missing SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS fields."

Built-in email Supabase é **serviço dev/teste** apenas. Produção real exige Custom SMTP.

## Opções consideradas

| Provider | Free tier | Setup | DKIM/SPF support | Domain custom |
|---|---|---|---|---|
| **Resend** ⭐ | 3000/mês + 100/dia | DNS records + API key | ✅ DKIM auto | ✅ |
| SendGrid | 100/dia | DNS + API key | ✅ | ✅ |
| Mailgun | 100/dia, 3 meses depois pago | DNS + API key | ✅ | ✅ |
| Amazon SES | $0.10/1000 emails | Complexo (verify domain + region) | ✅ | ✅ |
| Gmail SMTP | 500/dia | App password user pessoal | ❌ DKIM Gmail | ❌ user@gmail.com |

**Decisão:** **Resend**.
- DX top (dashboard limpo, docs claros)
- Free tier generoso (3000/mês cobre Dosy facilmente nos primeiros 100-200 users ativos)
- DKIM/SPF/DMARC auto-gerados
- Suporte direto domain custom (`noreply@dosymed.app`)
- Integração documentada Supabase oficial
- Conta Dosy: `dosy.med@gmail.com`

## Implementação executada

### 1. Domain Resend
- Adicionado `dosymed.app` no Resend Dashboard (region São Paulo `sa-east-1`)
- Resend gerou 4 DNS records:
  - **DKIM TXT** `resend._domainkey` → `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBi...wIDAQAB`
  - **SPF MX** `send` → `feedback-smtp.sa-east-1.amazonses.com` priority 10 TTL 3600
  - **SPF TXT** `send` → `v=spf1 include:amazonses.com ~all` TTL 3600
  - **DMARC TXT** `_dmarc` → `v=DMARC1; p=none;` (opcional mas recomendado)

### 2. DNS Hostinger (provider dosymed.app)
- Hostinger gerencia DNS dosymed.app via NS `horizon.dns-parking.com` + `orbit.dns-parking.com`
- Adicionados 4 records via Hostinger Dashboard → DNS / Nameservers → Adicionar registro:
  - TXT `resend._domainkey` (DKIM key full)
  - MX `send` priority 10 → `feedback-smtp.sa-east-1.amazonses.com`
  - TXT `send` → `v=spf1 include:amazonses.com ~all`
  - TXT `_dmarc` → `v=DMARC1; p=none;`
- TTL Hostinger default 14400s (~4h)
- DNS propagou em <5min (validation Resend imediata)

### 3. API key Resend
- Conta Resend → API keys → Create API key
- Name: `supabase-smtp-prod`
- Permission: Full access
- Domain: All domains
- Token: `re_xxxxxxxx...` (REDACTED — armazenado Supabase SMTP Settings encrypted. Rotacionar a cada 6 meses ou suspeita de exposição via Resend Dashboard → API keys → Delete + recreate)

### 4. Supabase Auth → SMTP Settings
- Toggle "Enable custom SMTP" ON
- **Sender email**: `noreply@dosymed.app`
- **Sender name**: `Dosy`
- **Host**: `smtp.resend.com`
- **Port**: `465` (SSL)
- **Minimum interval per user**: `60s` (default OK)
- **Username**: `resend`
- **Password**: API key Resend (encrypted Supabase)
- Save changes → rate limit auto-bumpa 2/h → 30/h

### 5. Email template Magic Link customizado
- Auth → Email Templates → Magic Link
- Subject: "Dosy — Código de recuperação"
- Body HTML usando `{{ .Token }}` pra OTP code 6 dígitos:
  ```html
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #FFFAF5;">
    <h2 style="color: #2A1810; margin: 0 0 16px;">Recuperação de senha — Dosy</h2>
    <p style="color: #5A4A3F; line-height: 1.5;">Use o código abaixo para confirmar sua identidade no app:</p>
    <p style="font-size: 32px; font-weight: 800; letter-spacing: 6px; text-align: center; padding: 20px; background: #FFE8D6; border-radius: 16px; color: #E67849; margin: 20px 0;">{{ .Token }}</p>
    <p style="color: #5A4A3F; line-height: 1.5; font-size: 14px;">O código expira em 1 hora. Se você não solicitou recuperação, ignore este email com segurança.</p>
    <hr style="border: none; border-top: 1px solid #E8D5C4; margin: 24px 0;">
    <p style="font-size: 12px; color: #999;">Dosy — Gestão simples de medicamentos</p>
  </div>
  ```
- Branding peach Dosy + token destacado center
- Padrão Sender: `Dosy <noreply@dosymed.app>` (do SMTP Settings)

### 6. Email OTP length config
- Auth → Sign In / Providers → Email → Email OTP length: 8 → **6 dígitos**
- Justificativa: 6 dígitos é padrão indústria (Google/GitHub/Stripe). Mais decorável user idoso. Segurança 6 dígitos = 1M combinações × rate limit = adequada.
- Email OTP expiration: 3600s (1h) — default OK

## Consequências

### Positivas

- **Recovery senha funcional em prod**: emails saem `Dosy <noreply@dosymed.app>` profissional
- **Rate limit Supabase Auth: 2/h → 30/h** (15× capacidade)
- **Resend free tier 3000/mês** cobre Dosy primeiros 100-300 users ativos confortavelmente
- **DKIM/SPF/DMARC autoconfigurados** = baixa probabilidade ir spam
- **Sem dependência email pessoal** (vs Gmail SMTP)
- **DNS propagou rápido** (<5min Hostinger), validação Resend imediata
- **Branding consistente** (peach Dosy email igual app)

### Negativas

- **Adicional dep ops**: Resend conta + API key + DNS records pra manter
- **Cost futuro**: >3000 emails/mês = paid tier ($20/mês = 50k emails)
- **Provider dependency**: Resend down = Dosy não envia emails (mitigação: Supabase pode trocar SMTP em <1min Dashboard)
- **Region São Paulo Resend** → AWS SES sa-east-1 latência boa BR mas pode demorar 2-3min entrega outros países

### Pendências

- **API key sensível**: rotacionar quando team grow OR a cada 6 meses por padrão
- **Monitoramento**: Resend dashboard mostra delivery rate, bounces, complaints
- **DMARC reporting**: `p=none` atual = report-only. Promover `p=quarantine` pós 30d sem bounces
- **Outros emails Supabase**: Confirm Sign Up, Reset Password, Invite User, Change Email — todos passam Resend agora

## Validação

✅ Domain Resend status: VERIFIED em ~5min após DNS prop
✅ Supabase Auth SMTP Settings saved (rate limit auto-bumpa 30/h)
✅ Recovery OTP real test: `lhenrique.pda@gmail.com` recebeu email Dosy com código 6 dígitos. Verifyotp + force modal nova senha funcionou end-to-end.
✅ Tradução erros OTP no app (`traduzirErro` cobre rate limit, expired, invalid).

## Referências

- [Resend Docs - Send Email with SMTP](https://resend.com/docs/send-with-smtp)
- [Supabase Auth - Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- Hostinger DNS records: https://hpanel.hostinger.com/domain/dosymed.app/dns
- Resend domain dashboard: https://resend.com/domains/90b1115d-c2d6-4bc7-b667-23a4a82e9c8e
