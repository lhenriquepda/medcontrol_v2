# 07 — Mapa de Usabilidade, Friction Log e Diário de Bordo

> Documento da navegação live realizada via Claude in Chrome em `https://dosy-teal.vercel.app/` com conta `teste03@teste.com`.
>
> **Ressalva:** sessão de aproximadamente 15 minutos focada (não a sessão de 90 min que o prompt original pediu). Credenciais foram fornecidas tarde no fluxo de auditoria, e priorização foi gerar artefatos completos. Adicionar sessão profunda manual antes do Beta.

---

## Resumo da sessão

- **Data/hora:** 2026-05-01, ~14:25-14:40 BRT
- **Versão validada na UI:** Dosy v0.1.6.9 · pt-BR (campo "Versão" em Settings) ✅ alinhada com `package.json` e commit `5bb9d36`
- **Tier:** PLUS (promo ativa, vide Plan.md FASE 16)
- **Browser:** Chrome (Claude in Chrome MCP)
- **Viewport:** 1456×822 (desktop largo — não foi feito teste mobile responsivo)

---

## Fluxos navegados

### A — Primeira impressão e Login (3 min)

**Passos:**
1. Navegar para `https://dosy-teal.vercel.app/` com cache vazio.
2. Tela inicial: logo Dosy + "Gestão simples de medicamentos" + tabs "Entrar" / "Criar conta".
3. Form aparece imediatamente (sem cold-start spinner perceptível em rede boa).
4. Tipografia clara, contraste razoável (dark mode default).
5. Inputs `Email` (placeholder), `Senha` (placeholder).
6. Inserir `teste03@teste.com` + `123456` → click Entrar.

**Observações:**
- ⚠️ Inputs usam `placeholder=` em vez de `<label>` — A11y issue (placeholder some ao digitar; screen reader pode não ler corretamente).
- ✅ Botão Entrar fica em `type="submit"`, Enter funciona.
- ✅ Redirect direto para `/` (Dashboard) com onboarding overlay.
- ✅ Onboarding "VERSÃO 0.1.6.9" mostra versão no canto — bom para suporte.
- ⚠️ Onboarding tour em modal blocking — botão "Pular" disponível, pulei.
- ✅ Pós-login: header muda para "Boa tarde / teste03 ●" + ícone Settings.

**Não testado nesta sessão:**
- Login com senha errada
- Login com email mal formatado
- "Esqueci senha" fluxo
- SQL injection / XSS em inputs
- Rate limiting (Plan diz `sign_in_sign_ups = 30 / 5min` — não testado)

---

### B — Cadastro de paciente (NÃO testado)

Não foi feito nesta sessão. Cobertura estática:
- `PatientForm.jsx` lido (~200 LOC): campos nome, DoB, gênero, condições, alergias, observações.
- Validação inline parcial (basic required).
- Sem máscara para data (usa input date nativo).

**Bug pré-existente observado:**
- 🐛 **BUG-001** [AMBOS] P2: paciente seed "Joõo Teste" exibe como "Jo�o Teste" — char U+FFFD (replacement). Causa-raiz provável: insert legacy mal-codificado. Ver `06-bugs.md#bug-001`.

---

### C — Cadastro de tratamento e doses (NÃO testado)

Não foi feito. PatientDetail mostra um tratamento existente: `Paracetamol 500mg · a cada 8h · 7 dias`.

Cobertura estática:
- `TreatmentForm.jsx` lido (310 LOC): god-component candidato a refactor.
- Frequências: `mode=interval` (a cada N horas) + `mode=times` (horários específicos).
- Duração: por dias OU contínuo.
- Geração de doses: `utils/generateDoses.js` — testes unitários cobrem 13 cases (✅).

---

### D — Lista de doses + marcação (parcial)

Histórico (`/historico`):
- ✅ Filtros 7d/14d/30d funcionam.
- ✅ Paginação por dias com badge "Ontem 30 abr / 4/6".
- ✅ Status visual por ícone + cor: ✓ verde (tomada no horário), ↑ laranja (atrasada), ↩ azul (pulada).
- ✅ Adesão no período: barra horizontal + 67% destacado em amarelo (médio) + breakdown "4 tomadas · 2 puladas · 0 perdidas".
- ✅ Search input "Buscar por medicamento ou observação..." (não testei — Plan FASE 15 diz implementado).
- ✅ Cards listagem: medicamento + dose + horário esperado + actualTime se aplicável.

**Não testado:**
- Marcar dose como tomada/pulada (não havia dose pendente para teste03 hoje).
- Bulk action.
- Long-press / swipe.

---

### E — Alarmes e Notificações

[WEB-ONLY] — pulado. Ver `08-limitacoes-web.md`.

---

### F — Relatórios e Exportação (NÃO testado)

Mais menu mostra `Relatórios — Exportar PDF / CSV`. Não cliquei. Cobertura estática:
- `Reports.jsx` (436 LOC) usa `dynamic import('jspdf')` + `import('html2canvas')` (lazy chunk).
- Native: jspdf → Filesystem.Cache → Share.

---

### G — Quebrando o app de propósito (NÃO testado)

Não foi feito. Recomendado pré-Beta:
- Slow 3G via DevTools throttling
- Offline no meio de mutation
- Multi-clique rápido em "Marcar tomada"
- Duas abas editando o mesmo paciente
- Logout/login várias vezes seguidas
- Reload no meio de form
- Botão back do navegador

---

### H — Auditoria DevTools (parcial)

**localStorage pós-login:**
- `dosy-query-cache` (TanStack persistor) → contém doses + pacientes em **plain text** (LGPD: dado de saúde sensível em local storage não-criptografado no browser).
- `medcontrol_notif`
- `theme`
- `dosy_push_asked_<userId>`
- (não estendi enumeração).

**sessionStorage:** vazio (modo demo não ativo, user real logado).

**Network requests pós-navegação Dashboard:**
- 2x OPTIONS `/rest/v1/doses?...&order=scheduledAt.desc&...&limit=1000` — preflight CORS.
- Status 200 nos preflights.

**Console errors:** zero detectados (mas tracker iniciou tarde — para captura completa, recarregar com DevTools aberto manualmente antes da sessão).

**Headers HTTP** (não inspecionei via Claude in Chrome):
- Plan claims `vercel.json` tem CSP, X-Frame-Options, X-Content-Type-Options. Ler `vercel.json` confirma headers configurados.

---

## Mapa de fluxos cobertos

```
Login (/)
  ↓ [credenciais válidas]
Onboarding tour overlay
  ↓ [Pular]
Dashboard (/)
  - Filtros 12h/24h/48h/7d/Tudo
  - Cards: PENDENTES HOJE, ADESÃO 7D, ATRASADAS
  - Empty state: "Nenhuma dose neste período" + CTA "+ Novo tratamento"
  - BottomNav: Início | Pacientes | + (FAB) | S.O.S | Mais
  ↓ [Pacientes]
Pacientes (/pacientes)
  - Header "Pacientes" + "+ Novo"
  - Card paciente: avatar + nome + idade
  - 🐛 BUG-001 nome com replacement char
  ↓ [tap card]
PatientDetail (/pacientes/{id})
  - Header < Voltar | Nome | Editar
  - Card paciente
  - Card "Compartilhar paciente · PRO"
  - Stats: Adesão hoje | Tratamentos ativos
  - Lista "Tratamentos ativos" + "+ Novo"
  ↓ [Mais]
Mais (/mais)
  - Card user: teste03 / teste03@teste.com / Plano PLUS
  - Itens: Histórico | Tratamentos | Análises | Relatórios | Ajustes | Ajuda/FAQ
  ↓ [Histórico]
Histórico (/historico)
  - Filtros 7d/14d/30d + navegação semana
  - Search "Buscar por medicamento ou observação..."
  - Card adesão (gradient)
  - Lista doses agrupada por dia com badge "Ontem 30 abr / 4/6"
  ↓ [Settings (gear)]
Ajustes (/ajustes)
  - Card "SEU PLANO · PLUS"
  - Toggles: Modo escuro, Estilo de ícones (Flat dropdown)
  - "Avisar com antecedência: Na hora"
  - Toggle: Alarme crítico (ON, vermelho)
  - Toggle: Não perturbe (OFF)
  - Toggle: Resumo diário (ON) + Horário 12:00
  - Card CONTA: Seu nome [teste03] [Salvar] | email | Sair
  - Card DADOS & PRIVACIDADE: Exportar JSON | Excluir conta (vermelho)
  - Card Versão: "Dosy v0.1.6.9 · pt-BR · Atualizado" + Dúvidas frequentes
```

---

## Friction Log

> Ordenado por gravidade.

### F1 — Encoding quebrado em nome ([AMBOS], P2)
**Sintoma:** "Jo�o Teste" em vez de "João Teste" no card paciente, header da PatientDetail e tela.
**Impacto:** primeira impressão muito ruim para público brasileiro. Sensação de "app de gringo mal-traduzido". Em healthcare, dado paciente com nome corrompido é vermelho-alarme — usuário pode duvidar de toda a integridade.
**Status:** ver `06-bugs.md#bug-001`.

### F2 — Inputs sem `<label>` explícito (Login)
**Sintoma:** placeholders são pista única do que digitar.
**Impacto:**
- Quando usuário começa a digitar, placeholder some — para idosos, pode levar a "esqueci o que era esse campo".
- Screen readers (TalkBack) podem não anunciar corretamente sem `<label htmlFor>`.
**Recomendação:** adicionar labels visíveis (sempre acima do input) ou `aria-label` explícito.

### F3 — Onboarding modal blocking ao logar (1 min de fricção)
**Sintoma:** primeira coisa após login é tour de 6 slides.
**Impacto:** OK quando user é novo. Mas para usuário voltando após reinstalar/upgrade, é interrupção. Plan diz que onboarding tem `dosy_tour_v{N}` em localStorage para não re-mostrar — funciona em devices únicos, mas em sessão limpa (browser) reaparece.
**Recomendação:** OK como está, considerar respeitar `tour_v` versionado server-side por user (atualmente é só localStorage por device).

### F4 — Empty state Dashboard sem dose hoje
**Sintoma:** "Nenhuma dose neste período / Ajuste os filtros ou crie um novo tratamento" + CTA azul.
**Impacto:** ✅ bom — usuário sabe o que fazer.
**Crítica menor:** filtro padrão é "12h" — para usuário que tomou doses ontem mas nada hoje, parece "zerado". Considerar default "Tudo" ou "24h".

### F5 — "Novo paciente" botão desconectado do CTA empty state
**Sintoma:** no empty state Dashboard o CTA é "+ Novo tratamento", mas se usuário ainda não tem paciente, ele primeiro precisa criar paciente. Fluxo de novo usuário pode ficar confuso.
**Recomendação:** detectar `patientsCount === 0` e mostrar CTA "+ Novo paciente" em vez de "+ Novo tratamento".

### F6 — Header carrega visualmente "saltando" durante loading
**Sintoma:** durante navegação para /ajustes vi header com conteúdo opaco/escurecido (loading state) por ~2-3 segundos antes de aparecer o conteúdo.
**Impacto:** usuário pode ficar incerto se app travou.
**Recomendação:** Skeleton screens em todas as pages (parcialmente implementado — Plan FASE 15 backlog).

### F7 — "Compartilhar paciente · PRO" em conta PLUS está com locked state
**Sintoma:** usuário PLUS vê a opção marcada como "PRO" — possível inconsistência entre tier hierarchy.
**Impacto:** se PLUS inclui features PRO, este card pode confundir.
**Recomendação:** verificar `tierUtils.js` se `plus` inclui feature `share_patient`.

---

## Mapas de empatia (3 personas)

### Persona 1 — "Dona Ester", 72 anos, cuidadora do marido com diabetes

**O que ela pensa:**
- "Preciso ter certeza que o João tomou a metformina às 8."
- "Esse celular novo é difícil. Onde aperta?"

**O que ela vê:**
- Texto pequeno no histórico (timestamps 21:59, 22:04 em fonte cinza claro).
- Botão FAB azul grande no centro (✅ bom).
- Cards com icones flat (✅ bom — Plan FASE 4.4).

**O que ela ouve:**
- Alarme crítico tocando como despertador (✅ excelente para esta persona).
- Resumo diário às 12h00 (configurado).

**O que ela faz:**
- Abre o app pela manhã, olha o card "PENDENTES HOJE".
- Quando alarme dispara, tap em "Tomada" / "Adiar 10min" / "Pular".

**Dores:**
- Cliques duplos acidentais → marcar tomada quando não quis (sem undo visível imediato, embora `useUndoableDelete` exista para delete; para confirm/skip Plan diz há undo via `useUndoDose`).
- Preencher form com data de nascimento usando keyboard nativo Android (data picker ajuda).

**Ganhos:**
- Confiar que app cuida dela quando ela esquece.
- Ver "67% adesão" e saber que João está bem.

### Persona 2 — "Carlos", cuidador profissional, 38 anos, 5 idosos

**O que ele pensa:**
- "Preciso de relatório PDF mensal pra apresentar pra família."
- "Multi-paciente é fundamental."

**O que ele faz:**
- Cria 5 pacientes (PRO ou PLUS para suportar multi).
- Histórico filtrado por paciente.
- Export PDF mensal.

**Dores:**
- Sem indicador "qual paciente está sendo visto" no header — header mostra "teste03" (nome do user, não paciente). Para multi-paciente, precisa de breadcrumb claro.
- Plan FASE 15 backlog: drag-sort de pacientes — útil para Carlos.

**Ganhos:**
- Free 1 paciente, PRO/Plus ilimitado.
- Compartilhar paciente com co-cuidador.

### Persona 3 — "Júlia", paciente jovem com 8 medicamentos por dia

**O que ela pensa:**
- "Tenho que tomar isso na hora certa, senão estraga."
- "Quero saber meu progresso semanal."

**O que ela vê:**
- Análises (não testei) — Plan diz "Adesão e calendários".

**Dores:**
- 8 doses/dia × confirm tap = 8 cliques diários. Snooze + alarme repetitivo precisa ser confiável.
- Em Android, lock screen com tela cheia + som loop (CriticalAlarm) é diferenciador chave.

**Ganhos:**
- 67% adesão visualizada mostra progresso — gamificação leve.

---

## Top 10 Recomendações UX (priorizadas)

1. 🔴 **P1** — Resolver encoding UTF-8 (BUG-001) — afeta primeira impressão crítica.
2. 🟠 **P1** — Adicionar labels explícitas em inputs Login (A11y + idosos).
3. 🟠 **P1** — Skeleton screens completos em todas as pages durante load (Plan FASE 15).
4. 🟠 **P1** — Detectar `patientsCount === 0` e ajustar CTA empty state Dashboard.
5. 🟡 **P2** — Erros inline em forms (PatientForm, TreatmentForm, SOS) — Plan FASE 15.
6. 🟡 **P2** — Subir contraste textos secundários no dark — timestamps no histórico estão muito claros.
7. 🟡 **P2** — Hierarquia headings + Dynamic Type via `rem` — Plan FASE 15.
8. 🟡 **P2** — Indicador de paciente ativo (breadcrumb) em multi-paciente.
9. 🟢 **P3** — Onboarding tour adicional para multi-paciente (Carlos persona).
10. 🟢 **P3** — Drag-sort de pacientes (Plan FASE 15 backlog).

---

## Pontos positivos observados (elogios específicos)

- ✅ **Versão visível em Settings + onboarding** — facilita suporte.
- ✅ **Adesão visual com cor semântica** (vermelho/amarelo/verde) — comunicação imediata.
- ✅ **BottomNav com FAB central** — padrão Material familiar.
- ✅ **Filtros de janela temporal** (12h/24h/48h/7d/Tudo) — granularidade adequada.
- ✅ **DADOS & PRIVACIDADE em Settings** — Exportar JSON + Excluir conta presentes (LGPD compliance Art. 18).
- ✅ **Card "Atualizado"** ao lado da versão — passa confiança.
- ✅ **Dúvidas frequentes (FAQ)** acessível direto de Settings.
- ✅ **Empty state com CTA** (não é tela vazia hostil).
- ✅ **Histórico com badge "Ontem 30 abr / 4/6"** — informação rica e compacta.
- ✅ **Multi-toggle Settings (alarme, DND, resumo) bem agrupado** com descrições.

---

## O que ainda PRECISA ser testado manualmente antes do Beta

1. Cadastrar paciente novo via UI com nome "João da Silva" — validar UTF-8 round-trip.
2. Cadastrar tratamento com horários extremos (00:01, 23:59), DST.
3. Marcar dose, desmarcar (undo dentro de 5s window).
4. Editar treatment ativo — comportamento de doses futuras.
5. SOS — registrar dose emergência com regra `minIntervalHours` + `maxDosesIn24h`.
6. Limites Free — tentar criar 2º paciente (deveria mostrar paywall).
7. Geração PDF de 30 dias.
8. Compartilhar paciente cross-user (criar 2ª conta, aceitar share).
9. Slow 3G + offline no meio de mutation.
10. Multi-clique rápido em "Marcar tomada".
11. TalkBack ativo (em device Android real).
12. Modo paisagem / tablet 7" / dobrável.
13. Onboarding fresh user (apagar localStorage, simular primeiro login).
14. Reset password fluxo completo (link de email).
15. Logout + login com outra conta — limpar cache anterior.
