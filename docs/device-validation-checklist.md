# FASE 17 — Validação Manual em Device Real

> Checklist completo para executar antes do Beta Interno (FASE 19).
> Cobre Aud 5.3 + 5.5 device validation. Imprimir e marcar conforme testar.

---

## Setup recomendado

### 3 devices alvo

| Tier | Modelo sugerido | Android | RAM | Notas |
|------|-----------------|---------|-----|-------|
| **Baixo** | Moto E13 / Samsung A15 / Xiaomi Redmi 12C | 13–14 | 3–4GB | maioria dos cuidadores idosos |
| **Médio** | Samsung A35 / Moto G84 / Xiaomi Note 13 | 14 | 6–8GB | mainstream Brasil |
| **Top** | Pixel 8 / Samsung S23 / Galaxy Note | 14–15 | 8–12GB | early-adopters |

### Pre-checks

- [ ] APK sideload instalado em cada (`app-release.aab` → bundletool → APK universal)
- [ ] Conta de teste criada com 2 pacientes + 5 tratamentos
- [ ] Cabos OTG / acesso ADB pra capturar logs
- [ ] Network throttle simulado: desktop config 3G/Edge

---

## 17.2 Acessibilidade (A11y)

### axe DevTools
- [ ] Run axe scan em cada tela principal: 0 erros críticos
- [ ] Cor contrastes mínimo WCAG AA (4.5:1 texto normal, 3:1 grande)

### TalkBack (leitor de tela)
- [ ] Ativar TalkBack em Configurações → Acessibilidade
- [ ] Navegar Login → Dashboard → DoseModal → Confirmar usando só voz
- [ ] Cada botão lê descrição clara
- [ ] Timer de undo audível ("Desfazer em 5 segundos")
- [ ] Inputs anunciam label + placeholder

### Tamanho de fonte
- [ ] Configurações → Tela → Fonte = "Maior" (escala 130%+)
- [ ] Layout não quebra em Dashboard, Pacientes, Settings
- [ ] Nenhum texto cortado por overflow

### Modo escuro forçado
- [ ] Configurações → Tela → Tema escuro forçado
- [ ] Cores e contraste mantidos
- [ ] Imagens (avatares emoji) visíveis

### Contraste sob luz solar
- [ ] Levar device pra fora ou janela em pleno dia
- [ ] Header e botões críticos legíveis
- [ ] Status badges (Tomada/Pulada) distinguíveis

### Touch targets
- [ ] Botões mínimo 44×44pt (medir com régua DevTools ou Bridges Tool)
- [ ] Lista de doses: tap fácil, sem mistarget

---

## 17.3 Performance

### Lighthouse mobile
- [ ] Reports tab no Chrome DevTools → Lighthouse → Mobile preset
- [ ] Performance ≥ 90 em Dashboard
- [ ] Performance ≥ 90 em Reports
- [ ] FCP < 1.5s, LCP < 2.5s, CLS < 0.1, TBT < 200ms

### Scroll performance
- [ ] Adicionar 200+ doses fictícias via DevTools
- [ ] Scrollar lista — frames sem stutter (>50fps média)
- [ ] FlamGraph DevTools sem long tasks (>200ms)

### Teclado virtual
- [ ] Em PatientForm: teclado abre, não cobre botão Salvar
- [ ] Em TreatmentForm com vários inputs: scroll auto pra input ativo
- [ ] Tecla "voltar" do teclado fecha sem perder dados

### Notch / safe-area
- [ ] Pixel 8 (notch) — header não corta
- [ ] Galaxy S (camera hole) — botão flutuante respeita
- [ ] Status bar (top): texto não embaixo
- [ ] Bottom nav: respeita gesture area inferior

### Pull-to-refresh
- [ ] Dashboard: puxar pra baixo dispara refresh
- [ ] Indicador visual aparece
- [ ] Dados atualizam sem flicker

### Sem rede
- [ ] Modo avião ON
- [ ] Abrir app: cache TanStack persistor mostra última lista
- [ ] Confirmar dose offline: queue local, sync ao reconectar
- [ ] Reconectar: sync automático (retry queue)

### 3G simulado
- [ ] Chrome DevTools → Network → Slow 3G
- [ ] Login: tela não trava sem feedback
- [ ] Dashboard: skeleton aparece, depois data
- [ ] Sem timeout silencioso

---

## 17.4 Notificações & Alarmes

### Alarme dispara nos cenários

- [ ] **Locked screen** — device travado, alarme acorda + tela acende
- [ ] **Unlocked, app fechado** — alarme persistente em foreground
- [ ] **App em background** — alarme não silencia
- [ ] **App killed** — alarme dispara mesmo após swipe-away
- [ ] **DND mode (Não Perturbe global Android)** — alarme crítico fura DND
- [ ] **Modo silencioso device** — som ativo (se Critical Alarm flag ON)
- [ ] **Bateria baixa (< 15%)** — alarme não suprimido
- [ ] **Doze mode (idle ≥ 1h)** — alarme acorda device

### DND in-app respeitado
- [ ] DND interno do Dosy 22h-7h ativo
- [ ] Dose não-crítica nessa janela: silencia
- [ ] Dose crítica nessa janela: toca

### Adiar 10min
- [ ] Toca alarme → Adiar
- [ ] 10min depois toca novamente
- [ ] Pode adiar várias vezes
- [ ] Não duplica notif

### Snooze nativo (FASE 2 carry-over)
- [ ] Botão snooze direto na notif (sem abrir app)
- [ ] Funciona com tela locked

---

## 17.5 Mobile security

### FLAG_SECURE
- [ ] Tela com dados sensíveis (lista pacientes/doses) — screenshot bloqueado
- [ ] App switcher (recents view) — preview obfuscado/blurred
- [ ] Capture screen recording (scrcpy/MediaProjection) — bloqueado

### Biometria
- [ ] Settings → ativar lock biométrico
- [ ] App em background ≥ 5min → ao retornar pede fingerprint/face
- [ ] Falha biometria → fallback PIN/senha conta
- [ ] Configurável: nunca / 1min / 5min / 15min

### Detecção root (opcional Beta)
- [ ] Em device rooted (Magisk hide off): warning aparece
- [ ] Usuário pode dismiss + continuar (com ressalva)
- [ ] Logs Sentry registram `device_rooted: true`

### TLS / Network
- [ ] Cert pinning ativo: substituir cert Supabase por self-signed via proxy → request rejeitado
- [ ] HTTP request bloqueado (apenas HTTPS)

---

## 17.6 Fluxos críticos end-to-end

### Onboarding novo usuário
- [ ] Cadastro → email confirm → login → tour
- [ ] Permissions onboarding: notif + alarmes + bateria
- [ ] FAQ acessível desde primeiro login

### Criar tratamento contínuo + receber dose
- [ ] Cadastra paciente
- [ ] Cria tratamento contínuo a cada 8h, 1ª dose 18:00
- [ ] Aguarda 18:00 (forçar via change clock device)
- [ ] Alarme dispara
- [ ] Confirma Tomada
- [ ] Histórico mostra dose registrada

### Compartilhamento (PRO)
- [ ] Owner compartilha paciente com outro email
- [ ] Convidado recebe email (verificar inbox real)
- [ ] Aceita convite → vê paciente
- [ ] Dose tomada por owner → reflete em convidado em <30s

### Logout / re-login
- [ ] Logout limpa cache local
- [ ] Re-login restaura todos pacientes/tratamentos
- [ ] Sem sync conflict / dose duplicada

### Excluir conta
- [ ] Settings → Excluir → confirm 2x
- [ ] Conta removida do Supabase (verificar via SQL)
- [ ] Email de confirmação recebido
- [ ] Re-cadastrar mesmo email funciona

---

## 17.7 Edge cases

- [ ] Mudar timezone do device durante uso ativo: doses recalculadas
- [ ] DST (horário de verão) — sem doses duplicadas/faltando
- [ ] Apagar localStorage manualmente — app re-sync sem corromper
- [ ] Atualização in-app (OTA via service worker web): banner notifica + reload limpo
- [ ] App primeira vez sem internet: tela login mostra erro amigável

---

## 17.8 Battery & background

- [ ] Uso normal (5 doses/dia) por 24h: <2% bateria consumido
- [ ] Background active (alarmes scheduled): <0.5% bateria/h
- [ ] Network calls: ≤ 50 requests/dia em uso normal
- [ ] Memória: pico < 200MB, idle < 100MB

---

## 17.9 Atualização do app

- [ ] Versão N instalada → versão N+1 publicada
- [ ] App detecta update → banner aparece
- [ ] Click banner → Play Store update flow
- [ ] Após update: dados preservados, sem login novo

---

## Validação final

- [ ] Todos checkboxes ✅ em pelo menos **2 de 3 devices**
- [ ] Bugs S1/S2 = 0
- [ ] Bugs S3 documentados em backlog (não-bloqueantes)
- [ ] **Decisão go/no-go** registrada em Plan.md FASE 17

---

## Como reportar achados

Cada bug encontrado:
1. Print ou vídeo curto
2. Device + OS version
3. Passos pra reproduzir
4. Comportamento esperado vs real
5. Crash log (logcat)
6. Severidade (S1/S2/S3)

Salvar em `docs/audit-findings/device-validation-YYYY-MM-DD.md`.
