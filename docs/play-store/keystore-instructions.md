# Keystore — geração + segurança

⚠️ **CRÍTICO:** Sem o keystore, **não é possível atualizar o app no Play Store**. Perda do keystore = app efetivamente abandonado, precisa lançar novo `applicationId` e perder usuários. Backup em 3 lugares seguros.

## Gerar (uma única vez)

```bash
cd G:\00_Trabalho\01_Pessoal\Apps\medcontrol_v2

keytool -genkey -v ^
  -keystore dosy-release.keystore ^
  -alias dosykey ^
  -keyalg RSA ^
  -keysize 2048 ^
  -validity 10000
```

Responder:
- `Enter keystore password:` ← senha forte (16+ chars, salvar em gerenciador)
- `What is your first and last name?` ← `Luiz Henrique` (ou outro)
- `What is the name of your organizational unit?` ← `Dosy`
- `What is the name of your organization?` ← `Dosy`
- `What is the name of your City or Locality?` ← cidade
- `What is the name of your State or Province?` ← UF
- `What is the two-letter country code?` ← `BR`
- `Is CN=..., OU=..., O=..., L=..., ST=..., C=BR correct?` ← `yes`
- `Enter key password for <dosykey> (RETURN if same as keystore):` ← `RETURN` (mesma senha)

## Backup (obrigatório, 3 locais)

1. **HD externo criptografado** — VeraCrypt ou disco encriptado APFS
2. **Cofre de senhas** — 1Password / Bitwarden / KeePass: anexar arquivo + senha
3. **Cloud criptografado** — Tresorit / pCloud Crypto / encrypted ZIP no Drive

**NÃO armazenar:**
- Repo Git (mesmo privado)
- Pasta sincronizada com cloud sem criptografia
- Email/Slack/Discord

## Variáveis de ambiente (build CI/CD)

Configure como secrets no ambiente de build (não em `.env` commitado):

```
KEYSTORE_PATH=/path/to/dosy-release.keystore
KEYSTORE_PASSWORD=<senha>
KEY_ALIAS=dosykey
KEY_PASSWORD=<senha>
```

`android/app/build.gradle` lê estas vars automaticamente. Se ausentes, build de debug funciona normalmente (sem signing).

## Build AAB de release

```bash
cd android
.\gradlew.bat bundleRelease

# Ou via Studio: Build → Generate Signed Bundle/APK → Android App Bundle
```

Saída: `android/app/build/outputs/bundle/release/app-release.aab`

## Validar AAB

```bash
# Verificar conteúdo
.\platform-tools\bundletool.jar dump manifest --bundle=app-release.aab

# Verificar signing
keytool -list -printcert -jarfile app-release.aab
```

## Checklist segurança

- [ ] Keystore gerado com 16+ chars senha
- [ ] Backup em 3 locais (HD criptografado + cofre senhas + cloud crypto)
- [ ] Senhas em variáveis ambiente CI, **nunca em código**
- [ ] `.keystore` no `.gitignore`
- [ ] Documentação de qual conta Google fez upload inicial (Play App Signing precisa dessa info pra recovery)
