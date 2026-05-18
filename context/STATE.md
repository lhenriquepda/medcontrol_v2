# 📍 Dosy — Estado Atual

> Fonte única de verdade para versão, branch e próximos passos.
> **Atualizar SOMENTE via Passo 9 do `context/WORKFLOW.md`** — a cada release.
> Conflito com `git log`? Fonte da verdade é o git.

---

## Estado atual

| Campo | Valor |
|---|---|
| **Versão** | `v0.2.3.11` |
| **versionCode** | `74` |
| **Branch ativa** | `master` (sem release em curso) |
| **Último tag** | `v0.2.3.11` · merge `21b6a0e` |
| **Ship date** | 2026-05-18 |
| **Play Console** | Internal Testing vc 74 — publicado 2026-05-17 22:55 BRT |
| **Vercel prod** | `dosymed.app` — v0.2.3.11 confirmado 2026-05-18T01:58Z |

---

## P0 abertos (próxima release)

1. **#006** — device validation 3 devices físicos (manual user)
2. **#131** — recrutamento Reddit testers (desbloqueado pós #130)
3. **#132** — gate 14d ≥12 testers (depende #131)
4. **#133** — Production access Console (depende #132)
5. **#191/#192** — RevenueCat + Play Billing (Fase 3)

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
