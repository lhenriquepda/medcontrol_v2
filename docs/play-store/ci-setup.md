# CI/CD Setup — GitHub Actions → Play Store

## Workflows

- `.github/workflows/ci.yml` — build + cap sync on every push/PR (verifica compilação)
- `.github/workflows/android-release.yml` — build signed AAB + upload Play Store

## Secrets necessários (GitHub repo Settings → Secrets and variables → Actions)

### Build (web bundle)
- `VITE_SUPABASE_URL` — produção URL projeto Supabase
- `VITE_SUPABASE_ANON_KEY` — anon key (público, mas evitar commit)
- `VITE_VAPID_PUBLIC_KEY` — VAPID public (web push)
- `VITE_SENTRY_DSN` — Sentry DSN (criar projeto sentry.io)
- `VITE_ADMOB_BANNER_ANDROID` — AdMob banner ad unit ID

### Signing (Android)
- `KEYSTORE_BASE64` — keystore encoded base64:
  ```bash
  base64 -w 0 dosy-release.keystore > keystore.b64
  # Cole conteúdo de keystore.b64 no secret
  ```
- `KEYSTORE_PASSWORD` — senha keystore
- `KEY_ALIAS` — alias (default `dosykey`)
- `KEY_PASSWORD` — senha key (geralmente igual ao KEYSTORE_PASSWORD)

### Play Store upload
- `PLAY_SERVICE_ACCOUNT_JSON` — JSON service account com Play Console permissions
  1. Google Cloud Console → criar service account
  2. Play Console → Setup → API access → link ao service account
  3. Conceder permissões: Release manager, App content
  4. Baixar key JSON, colar conteúdo inteiro no secret

## Triggers

### Push tag `v*` → build + upload internal track automático
```bash
git tag v1.0.0
git push --tags
```

### Manual dispatch (workflow_dispatch)
- GitHub → Actions → Android Release → Run workflow
- Escolher track: internal / alpha / beta / production

## Release notes por idioma

Criar `docs/play-store/whatsnew/whatsnew-pt-BR` (max 500 chars):
```
v1.0.0 — Initial release
• Cadastro de pacientes e tratamentos
• Alarmes estilo despertador
...
```

E `whatsnew-en-US` para inglês (se publicar internacionalmente).

## Validações antes do release

1. `npm run build` local sem erros
2. `npx cap sync android` sem warnings
3. Studio Run no emulador → app abre + login funciona
4. Tag semver (`v1.0.0`)
5. Release notes atualizadas
6. Plan.md status sincronizado
