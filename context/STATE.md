# 📍 Dosy — Estado Atual

> Fonte única de verdade para versão, branch e próximos passos.
> **Atualizar SOMENTE via Passo 9 do `context/WORKFLOW.md`** — a cada release.
> Conflito com `git log`? Fonte da verdade é o git.

---

## Estado atual

| Campo | Valor |
|---|---|
| **Versão** | `v0.2.3.14` |
| **versionCode** | `77` |
| **Branch ativa** | `master` (release/v0.2.3.14 mergeada) |
| **Último tag** | `v0.2.3.14` · merge pendente (pós-Vercel) — anterior `v0.2.3.13` `3e27811` |
| **Ship date** | 2026-05-19 |
| **Play Console** | Internal Testing vc 77 — publicado 2026-05-19 10:45 BRT |
| **Vercel prod** | TBD pós-merge master — anterior `dosymed.app` v0.2.3.13 confirmado 2026-05-18T23:09Z |

**Commits release/v0.2.3.14 (8):**
- `8daa0af` chore: abre release/v0.2.3.14 — bump vc 76→77
- `2bd4139` fix(useAppUpdate): #0010 + #0011 banner update version_name + mandatory
- `8fc5f03` fix(useShares): #0009 401 JWT expiry error UI + skip retry
- `1437d1f` docs(release v0.2.3.14): sync STATE/ROADMAP/CHECKLIST/PROJETO/whatsnew
- `347666b` docs(validar): release/v0.2.3.14 §11a web validation 3 fixes OK
- `077e796` feat(useAppUpdate): Sentry breadcrumbs + sanitização copy fallback
- `c839d5f` chore(useAppUpdate): debug toggle __dosyForceFallback pra testar copy
- `16ab6c6` docs(release v0.2.3.14): sync empilhamentos C (Sentry+copy+debug toggle)

---

## P0 abertos (próxima release)

1. **#006** — device validation 3 devices físicos (manual user)
2. **#131** — recrutamento Reddit testers (desbloqueado pós #130)
3. **#132** — gate 14d ≥12 testers (depende #131)
4. **#133** — Production access Console (depende #132)
5. **#191/#192** — RevenueCat + Play Billing (Fase 3)
6. **#300** — Validação device físico v0.2.3.13 disclaimer paciente compartilhado + cenário E cache offline + snooze 10min + Samsung One UI battery optimizer impact

---

## Contas teste

| Conta | Tier | Senha |
|---|---|---|
| `teste-free@teste.com` | free | `123456` |
| `teste-plus@teste.com` | plus | `123456` |

---

## Template de atualização (Passo 9 — preencher a cada release)

```
| **Versão** | `vX.Y.Z.W` |
| **versionCode** | `NN` |
| **Branch ativa** | `master` (sem release em curso) |
| **Último tag** | `vX.Y.Z.W` · merge `{hash}` |
| **Ship date** | YYYY-MM-DD |
| **Play Console** | Internal Testing vc NN — publicado YYYY-MM-DD HH:MM BRT |
| **Vercel prod** | `dosymed.app` — vX.Y.Z.W confirmado YYYY-MM-DDTHH:MMZ |
```
