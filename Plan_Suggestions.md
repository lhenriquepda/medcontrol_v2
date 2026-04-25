import os

# Conteúdo do arquivo Plan_Suggestions.md
content = """# Dosy — Sugestões de Melhorias Técnicas

> **Público-alvo:** Desenvolvedor / Arquiteto de Software.  
> **Objetivo:** Elevar os padrões de segurança, escalabilidade e resiliência do projeto Dosy para o lançamento na Play Store.

---

## 1. Segurança de Dados Sensíveis (Nível de Hardware)

Embora o plano de migração preveja o uso do `Capacitor Preferences`, para um app de saúde, a segurança em repouso é crítica.

* **Sugestão:** Substituir `@capacitor/preferences` por `@cap-go/capacitor-secure-storage` ou similar.
    * **Por que:** O `Preferences` padrão armazena dados em texto simples (SharedPrefs). O `Secure Storage` utiliza o **Android KeyStore**, garantindo que os tokens de sessão e dados sensíveis sejam criptografados com chaves protegidas por hardware.
* **SSL Pinning:** Implementar `http-pinning` para evitar ataques de Man-in-the-Middle (MitM). Isso garante que o app *só* aceite se comunicar com o domínio do Supabase se o certificado for exatamente o esperado, impedindo interceptações em redes Wi-Fi públicas.

---

## 2. Escalabilidade do Banco de Dados (Tabela de Doses)

A tabela `doses` é a que mais cresce. Se cada usuário tiver 1 paciente com 3 remédios/dia, são ~1.100 registros por usuário/ano. Com 10.000 usuários, chegamos a 11 milhões de linhas rapidamente.

* **Sugestão:** Implementar **Table Partitioning** (Particionamento de Tabela) no PostgreSQL do Supabase para a tabela `doses`.
    * **Como:** Particionar por data (mensal ou anual).
    * **Benefício:** Consultas no Dashboard (que buscam doses de "hoje") ficam extremamente rápidas, pois o banco varre apenas a partição do mês atual, ignorando milhões de linhas de histórico antigo.
* **Índices Compostos:** Garantir que existam índices em `(userId, scheduledAt)` e `(patientId, status)` para otimizar os filtros do Dashboard.

---

## 3. Infraestrutura de Notificações (pg_cron)

O uso de serviços externos (cron-job.org) para disparar notificações adiciona um ponto de falha e latência.

* **Sugestão:** Migrar a lógica de agendamento para a extensão **`pg_cron`** nativa do Supabase.
    * **Benefício:** O próprio banco de dados chama a Edge Function a cada 1 ou 5 minutos. É mais confiável, tem menor latência e mantém toda a infraestrutura dentro do ecossistema Supabase/PostgreSQL.

---

## 4. Resiliência: Modo Offline & Fila de Sincronização

Lembretes de remédios não podem depender de sinal de 4G estável.

* **Sugestão:** Implementar **Offline Mutations** com `persistQueryClient` do TanStack Query.
    * **Cenário:** O usuário marca uma dose como "Tomada" num subsolo sem sinal. O app deve:
        1. Atualizar a UI imediatamente (Optimistic Update).
        2. Salvar a mutação em uma fila (IndexedDB/Preferences).
        3. Sincronizar com o Supabase automaticamente assim que detectar conexão.
* **Local Notifications Fallback:** Garantir que o agendamento local (`LocalNotifications`) seja o "mestre" para alertas críticos, enquanto o Push (FCM) serve para notificações de engajamento ou atualizações do sistema.

---

## 5. Monitoramento & Observabilidade

Para um APK em produção, "não saber" que um erro ocorreu é o maior risco.

* **Sugestão:** Integrar **Sentry** (SDK para React/Capacitor).
    * **O que monitorar:** Erros de RPC no Supabase, falhas de autenticação e, principalmente, falhas no Service Worker ou no registro de doses SOS.
* **Logs de Auditoria (Security Events):** Conforme sugerido na Fase 0 do plano, garantir que cada mudança de Tier (PRO/FREE) ou deleção de conta gere um log imutável no banco para conformidade com auditorias de segurança.

---

## 6. LGPD & Governança de Dados Sensíveis

* **Data Minimization:** Avaliar se o campo `observation` nas doses precisa mesmo ser texto livre ou se pode ser estruturado para evitar que o usuário insira dados sensíveis desnecessários (como diagnósticos complexos).
* **Documentação de API:** Manter um registro das Edge Functions e quais dados PII (Personally Identifiable Information) elas processam, facilitando a criação do Relatório de Impacto à Proteção de Dados (RIPD), se solicitado pela ANPD.

---

## Resumo de Prioridades para o Dev:

1.  **Segurança:** Secure Storage e RPCs SOS (Server-side).
2.  **Resiliência:** Fila de sincronização offline para marcação de doses.
3.  **Escalabilidade:** pg_cron para notificações e revisão de índices em `doses`.
"""

with open("Plan_Suggestions.md", "w", encoding="utf-8") as f:
    f.write(content)