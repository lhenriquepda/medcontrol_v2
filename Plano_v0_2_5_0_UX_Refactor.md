# Plano v0.2.5.0 — Refactor UX (Histórico/Relatórios/Análise) + fixes críticos

> Versão alvo: **v0.2.5.0** (vc 83). Status: em implementação autônoma 2026-05-22.
> Baseado em 3 agentes de investigação (UX apps saúde, mobile autocomplete, fix Escitalopram DCB).

---

## 1. Problemas relatados pelo user

1. **Dropdown autocomplete ruim em Android** — some no scroll, mistura com teclado, preenche errado.
2. **Histórico só vê dia por dia** — não dá pra ver "todos antibióticos dos últimos 3 meses".
3. **3 áreas confusas** (Histórico × Relatórios × Análise) — overlap, user não sabe pra que cada uma serve.
4. **Caso médica:** "Quando foi a última vez que tomei antibiótico?" — não consegue responder sem abrir PDF.
5. **Escitalopram no dropdown sem categoria** — autofill falha.

---

## 2. Decisões consolidadas (3 agentes)

### Histórico/Relatórios/Análise — consolidar para 2 áreas + 1 ação

| Antes (3 telas) | Depois (2 telas + 1 ação) |
|---|---|
| Histórico (day-by-day) | **Histórico** = feed querável cross-period com filtros + busca + agrupamento dinâmico |
| Relatórios (configura período + gera PDF) | **Botão "Exportar PDF/CSV"** dentro do Histórico (sheet modal) |
| Análise (donut + trends + flags) | **Análise** = leitura agregada com drill-down → Histórico |

Rota `/relatorios` **deprecada** (redirect → `/historico` com toast).

### Autocomplete medicamento — Opção C (split inline + sheet)

Top 3 sugestões inline + botão "Ver mais (N)" abre bottom sheet quando >3 resultados.
Sheet respeita `window.visualViewport.height` (teclado-aware).
Remove handler Tab. Remove `onMouseEnter setHighlight`. Touch targets 56px.

### Escitalopram — DCB seed + RPC sort + modal contextual

- Adicionar coluna `is_dcb boolean` em `medications_catalog`.
- Seed ~50 DCBs top BR (Escitalopram, Dipirona, Paracetamol, etc) com `group_id` correto.
- RPC `ORDER BY is_dcb DESC, nome_comercial`.
- `CategoryHintModal.jsx` — top-3 categorias sugeridas (sufixo farmacológico + histórico user + global) quando autofill falha.

---

## 3. Plano implementação (3 blocos)

### Bloco A — Foundation (Escitalopram + DCBs)

- [ ] Migration `ALTER medications_catalog ADD is_dcb boolean NOT NULL DEFAULT false`
- [ ] Seed top-50 DCBs com `is_dcb=true` + `group_id` correto
- [ ] RPC `search_medications` atualizada com `ORDER BY is_dcb DESC, nome_comercial`
- [ ] `src/constants/groupKeywords.js` — sufixos farmacológicos (`-pram`, `-pril`, `-azol`, etc)
- [ ] `src/components/dosy/CategoryHintModal.jsx` — modal top-3
- [ ] Integração TreatmentForm + SOS: open modal quando submit sem group_id

### Bloco B — Autocomplete UX fix (mobile)

- [ ] Remover handler Tab em `handleKeyDown`
- [ ] Remover `onMouseEnter setHighlight` (só keyboard nav)
- [ ] `visualViewport` listener pra altura dinâmica do dropdown
- [ ] Portal `<body>` pra escapar overflow ancestral
- [ ] Touch targets `<li>` padding 16px / min-height 56px
- [ ] Remover auto-open em exact-match
- [ ] Bottom sheet quando >5 resultados (lite Opção C)

### Bloco C — Consolidação Histórico/Análise

- [ ] DoseHistory: chips período (7d/30d/90d/6m/1a/Tudo) — substitui day-strip quando >7d
- [ ] DoseHistory: agrupamento dinâmico (≤7d dia / >7d semana / filtered por med)
- [ ] DoseHistory: multi-select categoria via chips inline
- [ ] DoseHistory: card sticky "Resumo escopo atual" (totais + adesão %)
- [ ] Botão "Exportar PDF/CSV" sheet dentro do Histórico (reusa Reports.jsx)
- [ ] Deprecar rota `/relatorios` → redirect com toast
- [ ] Drill-down Analytics: Top Meds + flags clínicos linkam Histórico filtrado

---

## 4. Versão + bump

- versionCode: 82 → **83**
- versionName: 0.2.4.1 → **0.2.5.0**
- Branch: master (continuous deploy)

---

## 5. QA mínimo pós-implementação

- Web Vercel preview do `dosymed.app` antes de buildar APK
- Validação manual SQL `search_medications('escit', 5)` → deve retornar Escitalopram DCB primeiro
- Build vite verde + ESLint zero erros
- Build AAB CI Linux com env Supabase configurada (já corrigido v0.2.4.1)
- Upload Play Console vc 83 via Vetor 4
- Modal mandatory (`is_mandatory=false` — não-bloqueante, é evolução UX)

---

## 6. Fora de escopo v0.2.5.0 (parking lot)

- Natural language query no histórico
- Heatmap calendário por categoria
- Saved filter presets ("Meus antibióticos")
- 33 categorias + multi-categoria (continua MVP 16-single conforme v0.2.4.0)
- Refactor visual completo Analytics (mantém estrutura atual + drill-down)
