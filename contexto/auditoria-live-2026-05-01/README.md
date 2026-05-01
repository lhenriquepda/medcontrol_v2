# Auditoria Live — 2026-05-01

> Sessão de validação live nav durante release `v0.1.7.0`. Foco: idle freeze + lentidão reportada pelo user.

## Tipo
- **Live nav exaustiva** (browser preview Vercel + device físico Android)

## Escopo
- Validação fixes #023 / #075-#078 (release v0.1.7.0)
- Reproduzir bug "app trava após muito tempo + lento"
- Testar alarme nativo + push FCM em multiple cenários

## Duração
- ~30min preview Vercel
- ~30min device físico (teste03)

## Ferramentas
- Claude in Chrome (preview Vercel)
- Android Studio Run (device físico USB)
- Supabase Management API + REST (cleanup data + check pg_cron)
- DB injection direta (criar doses pra testar timing)

## Veredito
- ✅ Fixes v0.1.7.0 funcionaram (app recovers ao voltar foco, sem cold reload)
- 🚨 1 BUG-016 NOVO (P0): push + alarme não disparam após idle longo (~16min)
- Bug de notificação healthcare-critical reportado, vira items #079 + #080 release v0.1.8.0

## Bugs encontrados
Ver `bugs-encontrados.md`. **BUG-016 P0** [ANDROID].
