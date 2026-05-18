# Receita — Build AAB via Gradle CLI

> Autônomo, sem Android Studio GUI. 33s em média.

---

## Comando

```bash
cd android
TEMP='C:\temp\gradle_tmp' TMP='C:\temp\gradle_tmp' \
  JAVA_HOME='/c/Program Files/Eclipse Adoptium/jdk-25.0.3.9-hotspot' \
  PATH="$JAVA_HOME/bin:$PATH" ./gradlew bundleRelease
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

---

## Por que o TEMP override

Filter driver em `C:\Users\<user>\AppData\Local\Temp` bloqueia AF_UNIX → JDK `Pipe.LoopbackConnector` falha com "Invalid argument". Redirect para `C:\temp\gradle_tmp` resolve. Root cause confirmado definitivamente em v0.2.3.2 (diagnóstico binário: bind+connect AF_UNIX OK em `C:\temp`, FAIL em `AppData\Local\Temp`).

Garantir que o diretório existe antes:
```bash
mkdir -p 'C:\temp\gradle_tmp'
```

---

## Requisitos

- **JDK 25 obrigatório:** Adoptium Temurin 25.0.3.9
  ```
  winget install -e --id EclipseAdoptium.Temurin.25.JDK
  ```
- `keystore.properties` presente em `android/` (gitignored, contém senhas do keystore)
- `android/app/release/` ou o path correto do keystore configurado no `build.gradle`

---

## Pré-build obrigatório

```bash
npm run build && npx cap sync android
```

Propaga `dist/` → `android/app/src/main/assets/public`. Sem isso o app buildado usa JS antigo.

---

## Verificar antes de publicar

```bash
ls -lh android/app/build/outputs/bundle/release/app-release.aab
```

Tamanho esperado: ~12-20 MB. Se menor (< 1 MB) → build falhou silenciosamente, verificar logs.

---

## Após build

→ Publicar via `context/recipes/play-console-upload.md`
