# Auditoria 4.5.3 — UX & A11y (estática)

> **Tipo:** read-only static analysis. Validação manual em device fica em FASE 4.5.15.
> **Data:** 2026-04-28

## Score: 4/10

| Dimensão | Score | Nota |
|---|---|---|
| ARIA labels em icon-only buttons | 3 | 11 ocorrências em 9 arquivos. ~50 botões só-ícone sem label |
| `:focus-visible` outline | 0 | ZERO ocorrências em todo o código |
| Trap de foco em modais | 0 | BottomSheet/DoseModal/PaywallModal sem focus trap |
| Touch targets ≥44×44px | 4 | 16 ocorrências de `w-7/8/9/10 h-7/8/9/10` (28-40px — abaixo do mínimo WCAG) |
| `inputMode` em campos numéricos | 0 | ZERO ocorrências (formulários de quantidade/dose) |
| Skeleton screens | 6 | Existe `Skeleton.jsx` + uso em Dashboard/DoseHistory/Patients/Admin. Mas falta em Treatments, Reports, Analytics |
| Erro inline próximo ao campo | 2 | Maioria via toast — usuário não vê erro contextual |
| `aria-live` em toasts | ? | Sonner pode ter built-in — verificar |
| Empty states | 7 | EmptyState component presente, usado em vários lugares |
| Hierarquia de headings (h1/h2/h3) | ? | Não auditado estaticamente — manual review needed |
| Contraste WCAG AA | ? | Não automatizável aqui — usar axe DevTools |

## Gaps

### CRÍTICO (P0)
- **G1.** ZERO `:focus-visible` global — usuários teclado/TalkBack sem feedback visual de foco. Bloqueia certificação A11y.
- **G2.** ZERO trap de foco em modais — Tab escapa pra elementos atrás. Cyclic focus básico.

### ALTO (P1)
- **G3.** Botões `w-7/8/9 h-7/8/9` (28-36px) abaixo de WCAG 44×44px mínimo. 16 ocorrências em Header back-button, FilterBar funil, DoseHistory navigation, AppHeader settings, UpdateBanner close.
- **G4.** ~50 botões só-ícone sem `aria-label`. Lucide icons renderizados como SVG sem `<title>`.
- **G5.** ZERO `inputMode="numeric"` em campos quantidade/dose/idade/peso. Mobile abre teclado errado.
- **G6.** Erros de validação em forms só via toast — usuário não vê inline com campo errado.

### MÉDIO (P2)
- **G7.** Skeleton screens incompletos: TreatmentList, Reports, Analytics, SOS, PatientForm, TreatmentForm não usam.
- **G8.** Contraste textos secundários (text-slate-400/500) em dark pode falhar WCAG AA — confirmar com axe.
- **G9.** Sem skip-to-content link no `<main>`.
- **G10.** Sem `aria-current="page"` em BottomNav active state.
- **G11.** `OnboardingTour` slides têm imagens sem `alt` semântico.

### BAIXO (P3)
- **G12.** Sem suporte a Dynamic Type (font-scaled). Tamanhos em `px` em vários lugares ao invés de `rem`.
- **G13.** Sem leitor TalkBack testado — reservar device session.

## Top 5 Recomendações
1. Adicionar `:focus-visible` global em `theme.css` (XS) — P0
2. Adicionar `aria-label` em todos botões só-ícone (S) — P1, ~50 lugares
3. Aumentar touch targets <44px → `w-11 h-11` mínimo (S) — P1
4. `inputMode="numeric"` em campos numéricos (XS) — P1
5. Trap de foco em `BottomSheet` + DoseModal + PaywallModal (S) — P0
