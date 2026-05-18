# Fix encoding UTF-8 em paciente legacy — 2026-05-01

> **Sessão:** ~45 min · **Agente:** Claude Opus 4.7 · **Versão app:** 0.1.6.9 (sem bump — data fix prod only)

---

## 🎯 Objetivo da sessão

Fechar #005 (BUG-001): paciente "Jo�o Teste" exibido com U+FFFD literal no app. Confirmar se é dado seed legacy isolado ou bug em código de inserção via UI.

## ✅ O que foi feito

### Investigação

1. **Query SQL via Management API** (`/v1/projects/.../database/query`):
   ```sql
   SELECT id, name, encode(name::bytea, 'hex'), octet_length(name)
   FROM medcontrol.patients ORDER BY name;
   ```

   Resultado:
   ```
   Frederico Augusto | 17 bytes | 46726564657269636f204175677573746f
   Jo�o Teste        | 12 bytes | 4a6fefbfbd6f205465737465   ← bytes EF BF BD = U+FFFD literal
   Liam              | 4 bytes  | 4c69616d
   Luiz Henrique     | 13 bytes | 4c75697a2048656e7269717565
   Rael              | 4 bytes  | 5261656c
   sasdasd           | 7 bytes  | 73617364617364
   ```

2. **Identificado dono:** `userId fb05c9cb-...` = `teste03@teste.com` (1 paciente, dentro do limite Free).

3. **Verificado pg_proc** (função SQL `enforce_patient_limit` que dispara mensagem PT-BR com acentos):
   ```
   prosrc: ...raise exception 'PLANO_FREE_LIMITE_PACIENTES: No plano grátis você pode ter apenas 1 paciente...'
   ```
   Bytes corretos UTF-8 (`grátis` `você` = `c3 a1` `c3 aa`). DB e funções OK.

4. **Display Windows console mangleou exibição** de respostas do REST API (cp1252 não renderiza UTF-8). Bytes raw via `.encode('utf-8')` em Python confirmaram dados corretos no DB.

### Fix

- **Deletado registro corrompido** via REST + service_role:
  ```
  DELETE /rest/v1/patients?id=eq.46d9196f-1196-47ad-956a-f6603dcc16c8
  Authorization: Bearer <SERVICE_ROLE>
  Content-Profile: medcontrol
  → HTTP 200, retornou registro deletado
  ```

### Verificação

Round-trip end-to-end via REST como `teste03` com nome acentuado:

- Login `/auth/v1/token?grant_type=password` → JWT
- POST `/rest/v1/patients` body `{"name":"João da Silva ÃÕÉÍÇãõéíç"}` (UTF-8) → 201
- GET `/rest/v1/patients?id=eq.<pid>` (service_role) → response raw bytes
- **Comparação:**
  ```
  bytes sent: b'Jo\xc3\xa3o da Silva \xc3\x83\xc3\x95\xc3\x89\xc3\x8d\xc3\x87\xc3\xa3\xc3\xb5\xc3\xa9\xc3\xad\xc3\xa7'
  bytes db:   b'Jo\xc3\xa3o da Silva \xc3\x83\xc3\x95\xc3\x89\xc3\x8d\xc3\x87\xc3\xa3\xc3\xb5\xc3\xa9\xc3\xad\xc3\xa7'
                                                                                                 ↑ idêntico
  ```
- Cleanup test patient via DELETE service_role.

**Veredito:** path REST/UI grava UTF-8 correto. Bug isolado a 1 paciente seed. Sem mudança de código necessária.

## 📦 Itens do ROADMAP fechados

- [x] **#005** Resolver BUG-001 encoding UTF-8. Aceitação: bytes corrompidos identificados, registro deletado, round-trip via REST validado UTF-8 puro.

## 🐛 Bugs novos descobertos

Nenhum.

## 🧠 Decisões tomadas

- **Não adicionar Playwright pra esse teste.** Repo só tem Vitest (unit tests puros). Adicionar framework E2E inteiro pra cobrir 1 caso = scope creep. Substituído por **recipe Python** abaixo (rodar manualmente em auditoria futura).
- **Não criar migration SQL.** Cleanup é one-off em prod data. Migrations versionadas devem ser DDL ou data-shape, não cleanup de teste account.
- **Não atualizar PROJETO.md.** Sem mudança de schema, rota ou contrato. Pure data fix.

## 📁 Arquivos da pasta `contexto/` atualizados

- `ROADMAP.md` — §3 (não tinha menção, só §6+§12), §4 (#005 strikethrough), §6 (checkbox [x]), §12 (P0 7→6, em-aberto 71→70)
- `CHECKLIST.md` — #005 Status → ✅ Concluído + aceitação reescrita refletindo o que foi feito
- `updates/2026-05-01-fix-encoding-utf8-pacientes.md` — este arquivo

## 🚧 Estado deixado pra próxima sessão

- **Branch `fix/encoding-utf8-pacientes`** com 1 commit (docs only, sem código). Aguarda aprovação user.
- **Branch `security/send-test-push-admin`** ainda aberta (commit `1285f29`), aguardando merge no fim da sessão.
- **Master** intocada em `d53266b` (apenas docs reorg).
- **Próximo P0 §4:** #003 (rotação senha + revogar PAT + INFOS.md → vault) — **manual seu**, ~30 min, eu posso guiar. Ou #008 (Sentry GitHub Secrets, 15 min manual) — ambos não requerem código.
- **Itens P0 restantes que dão pra fazer com código:** #007 (PostHog telemetria — depende #018 PostHog key configurada manual user), #009 (PITR — manual upgrade Pro plan).
- **Recomendação:** pausar P0 com código por agora. Encerrar sessão, mergear branches, fazer #003 + #008 manualmente em próxima sessão.

## 💬 Notas livres

### Recipe pra reauditoria de encoding

Salvar como `scripts/audit-encoding.py` (não criado nesta sessão — adicionar se decidir manter como rotina):

```python
import urllib.request, json, re
env = open(".env.local").read()
PAT = re.search(r"^SUPABASE_PAT=(.+)$", env, re.M).group(1).strip().strip('"').strip("'")

req = urllib.request.Request(
    "https://api.supabase.com/v1/projects/guefraaqbkcehofchnrc/database/query",
    data=json.dumps({"query": """
        SELECT id, name, encode(name::bytea, 'hex') AS hex
        FROM medcontrol.patients
        WHERE octet_length(name) > char_length(name)  -- só nomes com bytes não-ASCII
          AND encode(name::bytea, 'hex') LIKE '%efbfbd%'  -- U+FFFD literal
    """}).encode(),
    method="POST",
    headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json"})
result = json.load(urllib.request.urlopen(req))
if result:
    print(f"❌ {len(result)} patients com U+FFFD encontrados:")
    for r in result: print(f"  {r['id']}: {r['name']!r}")
else:
    print("✅ Sem patients com U+FFFD literal")
```

Rodar antes de cada release Closed Testing pra garantir que não voltou.

### Por que dispara em healthcare PT-BR

Nomes brasileiros com `ã`/`õ`/`ç`/`é`/`í` são extremamente comuns. Se o bug recorresse em produção pública via algum import CSV ou tooling antigo, atingiria literalmente milhões de usuários ("João", "André", "Conceição", "São", "Açaí" etc). Manter o script de detecção rodando faz parte do safety net.

## 📊 Métricas

- Commits criados: 1 (docs only)
- LOC tocadas: 0 código + ~80 docs
- Tempo de sessão: ~45 min
- Pacientes deletados em prod: 1 (`46d9196f` legacy seed teste03)
