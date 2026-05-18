# 📍 Dosy — Estado Atual

> Fonte única de verdade para versão, branch e próximos passos.
> **Atualizar SOMENTE via Passo 9 do `context/WORKFLOW.md`** — a cada release.
> Conflito com `git log`? Fonte da verdade é o git.

---

## Estado atual

| Campo | Valor |
|---|---|
| **Versão** | `v0.2.3.14` (EM CURSO) |
| **versionCode** | `77` |
| **Branch ativa** | `release/v0.2.3.14` |
| **Último tag** | `v0.2.3.13` · merge `3e27811` (anterior) |
| **Ship date** | TBD (pendente validação + Passo 10.5 STOP) |
| **Play Console** | TBD (pré-ship) |
| **Vercel prod** | TBD (pré-ship) — anterior `dosymed.app` v0.2.3.13 confirmado 2026-05-18T23:09Z |

**Commits release/v0.2.3.14:**
- `8daa0af` chore: abre release/v0.2.3.14 — bump vc 76→77
- `2bd4139` fix(useAppUpdate): #0010 + #0011 banner update version_name + mandatory
- `8fc5f03` fix(useShares): #0009 401 JWT expiry error UI + skip retry

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
