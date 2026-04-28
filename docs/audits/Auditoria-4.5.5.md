# Auditoria 4.5.5 — Performance

> **Tipo:** read-only (bundle scan, code patterns)
> **Data:** 2026-04-28

## Score: 4/10

| Dimensão | Score | Nota |
|---|---|---|
| Bundle main size | 3 | 716KB (gzip 206KB) — alvo ≤500KB |
| Code splitting (route-level) | 0 | ZERO `React.lazy` |
| Dynamic imports (heavy libs) | 1 | `jspdf` 390KB + `html2canvas` 202KB eager (só usados em /relatorios) |
| Vendor chunk separation | 0 | `manualChunks` não configurado |
| `useMemo`/`useCallback` usage | 6 | 48 ocorrências em 16 arquivos (uso razoável) |
| `React.memo` em componentes | 0 | ZERO componentes memoizados |
| Virtualização de listas | 0 | Sem `react-virtual`/`react-window`. Listas longas (200+ doses) renderizam todas |
| Lazy load de imagens | ? | Avatares user/photo — verificar `loading="lazy"` |
| Persistor offline cache | 10 | TanStack PersistQueryClient + 24h gcTime ✓ |
| Mutations retry | 9 | Já config global: retry 3 + exponential backoff ✓ |
| Lighthouse score | ? | Não medido (manual em FASE 4.5.15) |

## Bundle breakdown (dist v0.1.5.6)
```
716 KB  index-*.js       (main bundle - 35.8% do total)
390 KB  jspdf.es.min     (eager, só /relatorios)
202 KB  html2canvas      (eager, só /relatorios)
151 KB  index.es         (purify dep, eager)
 49 KB  index-*.css
 24 KB  purify.es
~30 KB  outros chunks (web-*, base, native)
```

Total dist: ~2 MB. ~592KB de heavy libs eager carregadas em rota onde não são usadas.

## Gaps

### CRÍTICO (P0)
- **G1.** Bundle main 716KB sem code-splitting. Time-to-interactive penalizado em 3G. Lighthouse mobile não bate 90 com bundle desse tamanho. Daily-money meta: ≤500KB.

### ALTO (P1)
- **G2.** `jspdf` + `html2canvas` (590KB combined) carregados eager. Devem ser dynamic imports no `Reports.jsx` (`const { default: jsPDF } = await import('jspdf')`).
- **G3.** Vite `manualChunks` ausente. Vendor chunk não separado de app code → atualização de app invalida cache de vendor (slow re-download em update).
- **G4.** Sem virtualização em DoseHistory/Patients/TreatmentList. Para usuário com 200+ doses, render scroll laggy.

### MÉDIO (P2)
- **G5.** Componentes pesados sem `React.memo`: `DoseCard`, `PatientCard`, `Stat`, `Icon`. Re-renders desnecessários quando parent updates.
- **G6.** Sem lazy load de avatares de paciente (PatientCard render todos com photo_url eager). Listas longas = vários loads simultâneos.
- **G7.** `useDoses` com `refetchInterval: 60_000` em hook polled. Multiple consumers = multiple intervals concurrentes (mitigado por TanStack dedup, mas worth verifying).

### BAIXO (P3)
- **G8.** `purify.es` 24KB carregado eager — verificar se necessário no main path (provavelmente dependência de jspdf).
- **G9.** `__APP_VERSION__` define inline em todo bundle — minor.
- **G10.** Sem service worker pre-cache strategy específica (Vite default).

## Top 5 Recomendações
1. **Code splitting routes** (`React.lazy` + `Suspense` em todas pages) (M) — P0
2. **Dynamic import jspdf/html2canvas** dentro do handler de export em Reports.jsx (XS) — P1
3. **Vite `manualChunks`** separar react/supabase/vendor (S) — P1
4. **`React.memo` em DoseCard/PatientCard/Icon** (XS) — P2
5. **Virtualização** com `@tanstack/react-virtual` em DoseHistory/Patients (M) — P2

## Métricas alvo (pós-otimização)
- Main bundle ≤300KB (gzip ≤100KB)
- Lighthouse mobile ≥90
- Time-to-interactive ≤3s em 3G simulado
- 60fps scroll em lista de 500 doses
