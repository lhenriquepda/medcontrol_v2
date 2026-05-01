# Posts de lançamento — passive discovery

> Postar **1 vez** em cada local. Sem follow-ups ativos. Quem se interessar, encontra.
> Substitua `[LINK]` pelo opt-in URL real depois de criar Open Testing.

---

## 1. Reddit — r/AndroidBeta

**Subreddit:** https://www.reddit.com/r/AndroidBeta/

**Title:**
```
[Beta] Dosy — lembrete de medicação para pacientes crônicos e cuidadores (PT-BR)
```

**Body (Markdown):**
```
Oi! Lancei o **Dosy**, um app de lembrete de medicação focado em pacientes crônicos e cuidadores familiares. Estou em **Open Testing** e procurando feedback de qualquer pessoa que use ou cuide de alguém que tome remédio diariamente.

**O que tem:**
- Alarme crítico que toca mesmo no silencioso (Android `AlarmManager`)
- Doses contínuas e por duração fixa
- Compartilhar paciente com cuidador (PRO)
- Histórico + adesão semanal
- Modo escuro, PT-BR, gratuito (com anúncios)

**O que NÃO tem (e nunca terá):**
- Aconselhamento médico — é só lembrete
- Telessaúde

**Stack pra quem curte:** React + Capacitor + Supabase + Sentry.

**Beta:** [LINK]

Feedback bem-vindo. Resumo: bugs, ideias, frustrações. Crítico: o alarme funciona no seu device?

(EN summary: medication reminder app for chronic patients and family caregivers, PT-BR, Android beta open testing — looking for feedback especially on alarm reliability across devices.)
```

**Quando postar:** Após Open Testing publicado e link válido. Não antes.
**Frequência:** 1 vez. Não repostar.
**Cross-post sugerido:** r/sideloaded (mesma copy)

---

## 2. BetaList.com

**URL:** https://betalist.com/submit

**Como funciona:** submit free, BetaList curates → publica em newsletter (~100K subs).

**Form fields:**

- **Name:** `Dosy`
- **Tagline (max 80 chars):** `Medication reminder for chronic patients and family caregivers (BR)`
- **Description (max 600 chars):**
  ```
  Dosy is a medication reminder app focused on chronic patients (hypertension, diabetes, post-stroke) and family caregivers. Critical alarm that fires through Do-Not-Disturb mode, continuous treatment scheduling, history with adherence stats, optional sharing with caregivers (PRO). Built mobile-first with React + Capacitor for Android. Available in Brazilian Portuguese. Free with ads, PRO subscription planned.
  ```
- **URL:** `https://dosy-teal.vercel.app`
- **Beta link:** `[LINK Open Testing]`
- **Logo:** `resources/icon.png`
- **Cover:** `resources/feature-graphic.png`
- **Tags:** `health`, `medication`, `mobile`, `android`, `caregivers`
- **Pricing:** Free + Premium

**Quando submeter:** Após Open Testing live + descrição/screenshots na Play Store.

---

## 3. AlternativeTo.net

**URL:** https://alternativeto.net/software/new/

**Por que:** lista como alternativa BR a Medisafe, MyTherapy, MedPass — apps populares globais. Aparece em buscas tipo "medisafe alternative free".

**Form fields:**

- **Name:** `Dosy`
- **Tagline:** `Medication reminder app for Android, focused on Brazilian users`
- **Categories:** Health & Fitness · Medication Tracker
- **Description (markdown):**
  ```
  **Dosy** is an Android medication reminder built for chronic patients and family caregivers in Brazil. Key features:

  - **Critical alarm** that bypasses silent mode and DND
  - **Continuous treatments** (no end date) with auto-renewal
  - **Patient sharing** with caregivers (Premium)
  - **Adherence history** and weekly stats
  - **Offline-first** — alarms scheduled locally, sync when online
  - **LGPD compliant** — data exportable + deletable

  Available in Brazilian Portuguese. Free with ads, optional Premium subscription.

  Comparable to: Medisafe, MyTherapy, MedPass — focused on local Brazilian needs and language.
  ```
- **Tags:** `medication-tracker`, `health-reminder`, `caregiver`, `android-app`
- **License:** Freemium
- **Operating system:** Android (Online: Yes)
- **Alternatives to:** Medisafe, MyTherapy

**Quando:** Mesma janela do BetaList (após Open Testing).

---

## 4. Product Hunt — DEFER

**Não postar agora.** Reservar pra **launch oficial** (FASE 22). Product Hunt = high-visibility, single-shot. Queima cartucho cedo = pouca tração.

Quando: após métricas Beta sólidas (NPS ≥ 50, ≥ 100 testers ativos).

---

## 5. Posts próprios (rede pessoal) — opcional

### LinkedIn

**Texto sugerido (1 post):**
```
Lancei beta de um app pessoal: Dosy — lembrete de medicação focado em pacientes crônicos e cuidadores familiares no Brasil.

A ideia veio de ver familiares perdendo doses ou tomando duplicado. Apps existentes que tentei eram em inglês, não tinham alarme persistente, ou eram complexos demais para idosos.

O Dosy tem alarme crítico que toca mesmo no silencioso, doses contínuas com renovação automática, compartilhamento com cuidador. Stack: React + Capacitor + Supabase.

Beta aberto: [LINK]

Aceito feedback principalmente de cuidadores, enfermeiros e geriatras. Pode comentar ou DM.

#desenvolvimento #saúde #android #cuidadores
```

### Twitter/X (1 post)
```
Acabei de lançar o beta do Dosy, um lembrete de medicação focado em pacientes crônicos e cuidadores no Brasil.

Stack: React + Capacitor + Supabase
PT-BR, grátis, alarme que fura modo silencioso

Beta aberto: [LINK]
```

---

## Não recomendado (ativos demais)

- ❌ Cold DM em grupos de Facebook de cuidadores (spam)
- ❌ Post em grupos WhatsApp aleatórios (sem opt-in)
- ❌ Email blast pra listas compradas
- ❌ Reddit posts em subreddits não-relacionados

---

## Métricas pra acompanhar

Após cada post, monitorar via PostHog:
- Tráfego orgânico (referrer = reddit.com, betalist.com, linkedin.com)
- Conversão visit → install
- Retention D1, D7 dos novos installs

Se 1 fonte > 30% conversão D7, replicar copy em similar (ex: r/AndroidBeta funcionou → tentar r/AndroidApps).
