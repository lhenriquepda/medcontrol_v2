# Plano — Categorização de Medicamentos

> **Status v3 (2026-05-22):** Decisões consolidadas. EM IMPLEMENTAÇÃO autônoma branch `release/v0.2.4.0-categorias-medicamentos`.

> Versão alvo: **v0.2.4.0** (vc 81). Estimativa: 4 fases, 4-6 semanas de esforço solo.

> **Mudança v1→v2:** investigação revelou tabela CMED da ANVISA (mensal, ~100% cobertura BR, classe terapêutica oficial). Substituiu estratégia inicial baseada em dicionário manual. Ver §5 e §14.

> **Mudança v2→v3:** todas 9 decisões §10 aprovadas em modo autônomo. Decisões consolidadas:
> 1. Hierarquia 2 níveis: SIM
> 2. "Outro" sem texto livre: SIM
> 3. Fallback agressivo: SIM
> 4. Categoria afeta doses futuras: SIM
> 5. Versão `v0.2.4.0` (vc 81): SIM
> 6. Shipar agora (Refactor_Full já em prod estável): SIM
> 7. PRD update após Fase 1 estar verde: SIM
> 8. CMED como source-of-truth: SIM
> 9. Edge Function cron mensal: SIM

---

## 1. Objetivo

Permitir que cada medicamento cadastrado em **Tratamento** ou **SOS** tenha uma **categoria terapêutica** associada (Antibiótico, Antitérmico, Vitamina, etc.). A categoria preenche-se **automaticamente** quando o medicamento é reconhecido pelo catálogo. Se não houver reconhecimento, o usuário escolhe a categoria manualmente — e esse aprendizado fica salvo no catálogo pessoal dele, para preenchimento automático nas próximas vezes.

A categorização habilita análises agregadas em **Analytics**, **Histórico** e **Relatórios** — por exemplo, "quantas vezes tomei Antibiótico nos últimos 3 meses?", independente do nome comercial específico.

---

## 2. Premissas e respeito ao que já existe

Antes de propor mudança, mapeei o que já está construído. O plano respeita tudo isso:

| Componente atual | Comportamento | Decisão no plano |
|---|---|---|
| `MedNameInput.jsx` | Autocomplete com 3 fontes: histórico do usuário, catálogo ANVISA via RPC, fallback JSON local | **Não alterar comportamento de busca.** Apenas enriquecer o objeto retornado com `category`. |
| Tabela `medcontrol.medications_catalog` | Colunas: `id, nome_comercial, principio_ativo, ativo`. ~30 mil linhas via CSV ANVISA diário. | **Adicionar colunas** `category` (texto) e `principio_ativo_normalizado` (texto, lowercase sem acento, índice trigram). Sem migração destrutiva. |
| Tabela `treatments`, `doses`, `sos_rules` | `medName` é texto livre. Sem categoria. | **Adicionar coluna `category`** como snapshot histórico (mesmo que catálogo mude depois, registro antigo preserva a categoria escolhida na época). |
| Tabela `user_medications` | Não existe. Histórico de medicamentos por usuário hoje deriva de `treatments` agregados. | **Criar tabela nova** `user_medications` (per-user) com `name, category, principio_ativo, usage_count, last_used_at`. Acumula aprendizado do usuário. |
| RPC `search_medications(q, lim)` | Retorna `nome_comercial` + `principio_ativo`. | **Estender** para retornar `category` também. Backward-compatible (clientes antigos ignoram coluna nova). |
| Heurística client-side `FLAGGED_CLASSES` em `Analytics.jsx` | Substring matching para 4 classes (Corticoide, Opioide, Benzodiazepínico, AINE), só pra flags visuais de risco. | **Promover para canonical** — migrar essas regras para o backfill do catálogo. Heurística client-side vira fallback apenas. |
| Script `scripts/ingest-anvisa.mjs` | Importa CSV ANVISA diário. Descarta a coluna `DESCRICAO_PRODUTO` do CSV. | **Modificar**: passar a parsear `DESCRICAO_PRODUTO` + `principio_ativo` por dicionário de regras → preenche `category` automaticamente no upsert. |
| `Refactor_Full.md` (5 fases já planejadas) | Sem menção a categorização. | **Sem conflito.** Esta feature é independente das 5 fases de refactor. |
| PRD em `dosy-app/docs/` | Menciona "Interação medicamentosa" e "ANVISA bula" como features v2.0+ (§6) — sem detalhamento de categorização. | **Esta feature é pré-requisito** para Interação Medicamentosa (que precisa saber a classe pra cruzar). Documentar isso no PRD após validação. |

---

## 3. Lista de categorias — hierarquia em 2 níveis

Decisão revisada (v2): você apontou — com razão — que 16 categorias são poucas e que cada uma teria poucos exemplos. A solução é **hierarquia em 2 níveis**:

- **Nível 1 — Grupo amigável (16 itens):** o que o usuário vê na maior parte das telas (chip, filtro principal de Analytics, Card "Doses por categoria"). Linguagem leiga, pt-br.
- **Nível 2 — Classe terapêutica oficial CMED (~90 itens):** detalhe técnico vindo da ANVISA. Usado em filtros avançados, exportação CSV/PDF e em casos de saúde mais sérios (cuidador profissional, etc).

Cada apresentação fica com **ambos os níveis preenchidos** automaticamente quando vem da CMED. O usuário não precisa escolher Nível 2 — é derivado.

### 3.1 Nível 1 — 16 grupos amigáveis (default visível)

Cada um com cor própria (token CSS) para uso em Analytics.

| Grupo (Nível 1) | Exemplos | Cor (token Dosy) |
|---|---|---|
| **Antibiótico** | Amoxicilina, Azitromicina, Cefalexina, Clavulin | `--dosy-red-500` |
| **Antifúngico** | Fluconazol, Itraconazol, Nistatina | `--dosy-red-400` |
| **Antiviral** | Aciclovir, Tamiflu | `--dosy-red-300` |
| **Antitérmico / Analgésico** | Dipirona, Paracetamol, Tramadol, Novalgina, Tylenol | `--dosy-orange-500` |
| **Anti-inflamatório (AINE)** | Ibuprofeno, Diclofenaco, Nimesulida | `--dosy-orange-400` |
| **Corticoide** | Prednisona, Dexametasona, Betametasona | `--dosy-purple-500` |
| **Anti-hipertensivo** | Losartana, Enalapril, Anlodipino | `--dosy-blue-500` |
| **Antidiabético** | Metformina, Glibenclamida, Insulina | `--dosy-blue-400` |
| **Antialérgico / Anti-histamínico** | Loratadina, Desloratadina, Cetirizina | `--dosy-cyan-500` |
| **Antidepressivo** | Sertralina, Fluoxetina, Escitalopram | `--dosy-indigo-500` |
| **Ansiolítico / Sedativo** | Alprazolam, Clonazepam, Diazepam | `--dosy-indigo-400` |
| **Anticoagulante / Antiagregante** | Varfarina, AAS infantil, Rivaroxabana | `--dosy-pink-500` |
| **Gastrointestinal** | Omeprazol, Esomeprazol, Domperidona | `--dosy-amber-500` |
| **Broncodilatador / Respiratório** | Salbutamol, Budesonida, Berotec | `--dosy-teal-500` |
| **Vitamina / Suplemento** | Vitamina D, Complexo B, Ômega-3 | `--dosy-green-500` |
| **Outro** | tudo que não cai nos anteriores | `--dosy-gray-500` |
| **Não classificado** | default histórico (treatments criados antes da feature) | `--dosy-gray-300` |

### 3.2 Nível 2 — Classe terapêutica CMED (~90 valores)

Vem direto da coluna `CLASSE TERAPÊUTICA` da planilha CMED. Exemplos de como mapeia pro Nível 1:

| Classe CMED (Nível 2) | Mapeia pra Grupo (Nível 1) |
|---|---|
| Penicilinas de espectro ampliado | Antibiótico |
| Macrolídeos | Antibiótico |
| Cefalosporinas de 1ª geração | Antibiótico |
| Quinolonas | Antibiótico |
| Outros analgésicos e antitérmicos | Antitérmico/Analgésico |
| Anti-inflamatórios não esteroides | Anti-inflamatório (AINE) |
| Glicocorticoides | Corticoide |
| Antagonistas da angiotensina II (sartanas) | Anti-hipertensivo |
| Inibidores da ECA | Anti-hipertensivo |
| Bloqueadores de canais de cálcio | Anti-hipertensivo |
| Biguanidas | Antidiabético |
| Insulinas e análogos | Antidiabético |
| Inibidores da recaptação de serotonina (ISRS) | Antidepressivo |
| Benzodiazepínicos | Ansiolítico/Sedativo |
| Antagonistas H2 / Inibidores da bomba de prótons | Gastrointestinal |
| Beta-2 agonistas de curta duração | Broncodilatador/Respiratório |
| Vitamina D e análogos | Vitamina |
| ... (~70 outras) | ... |

### 3.3 Como o usuário interage com cada nível

| Tela | Nível 1 (Grupo) | Nível 2 (Classe CMED) |
|---|---|---|
| **TreatmentForm / SOS** — cadastro | Visível como chip, autofill | Oculto na UI, salvo no banco |
| **DoseHistory** — filtros | Chip principal multi-select | Filtro avançado "Mais opções" |
| **Analytics** — Card "Doses por categoria" | Donut top 5 por Grupo | Drill-down ao clicar fatia: lista Classes daquele Grupo |
| **Reports** — PDF | Tabela resumo por Grupo | CSV ganha colunas extras com Classe |

### 3.4 Constante única no código

`src/constants/medCategories.js` exporta:

```js
export const MED_GROUPS = [
  { id: 'antibiotico',     label: 'Antibiótico',                color: 'var(--dosy-red-500)' },
  { id: 'antifungico',     label: 'Antifúngico',                color: 'var(--dosy-red-400)' },
  // ...
  { id: 'outro',           label: 'Outro',                      color: 'var(--dosy-gray-500)' },
  { id: 'nao_classificado',label: 'Não classificado',           color: 'var(--dosy-gray-300)' },
];

// De-para Classe CMED → Grupo, lookup case-insensitive
export const CMED_CLASS_TO_GROUP = {
  'penicilinas de espectro ampliado': 'antibiotico',
  'macrolideos': 'antibiotico',
  // ~90 entradas
};
```

A lista vive no código — fonte da verdade. Schema do banco usa CHECK constraint só pra Nível 1 (`group_id`). Nível 2 (`cmed_class`) é texto livre (validação branda; CMED renomeia classes ocasionalmente e não quero quebrar migração).

---

## 4. Mudanças no banco

### 4.1 Migration 1 — Catálogo ganha `group_id`, `cmed_class` e colunas auxiliares

```sql
ALTER TABLE medcontrol.medications_catalog
  ADD COLUMN ean text NULL,                          -- chave de match com CMED
  ADD COLUMN group_id text NULL,                     -- Nível 1: grupo amigável
  ADD COLUMN cmed_class text NULL,                   -- Nível 2: classe terapêutica CMED
  ADD COLUMN tarja text NULL,                        -- vermelha/preta/sem
  ADD COLUMN tipo_produto text NULL,                 -- genérico/similar/referência
  ADD COLUMN principio_ativo_normalizado text NULL,  -- lowercase sem acento (fallback)
  ADD COLUMN updated_from_cmed_at timestamptz NULL;  -- audit do último sync CMED

CREATE UNIQUE INDEX idx_med_catalog_ean ON medcontrol.medications_catalog (ean) WHERE ean IS NOT NULL;
CREATE INDEX idx_med_catalog_group ON medcontrol.medications_catalog (group_id);
CREATE INDEX idx_med_catalog_cmed_class ON medcontrol.medications_catalog (cmed_class);
CREATE INDEX idx_med_catalog_principio_trgm
  ON medcontrol.medications_catalog USING gin (principio_ativo_normalizado gin_trgm_ops);

-- CHECK constraint só no Nível 1 (Nível 2 fica texto livre)
ALTER TABLE medcontrol.medications_catalog
  ADD CONSTRAINT chk_med_catalog_group
  CHECK (group_id IS NULL OR group_id IN (
    'antibiotico','antifungico','antiviral','antitermico_analgesico',
    'anti_inflamatorio','corticoide','anti_hipertensivo','antidiabetico',
    'antialergico','antidepressivo','ansiolitico','anticoagulante',
    'gastrointestinal','broncodilatador','vitamina','outro'
  ));
```

### 4.2 Migration 2 — Catálogo pessoal do usuário

```sql
CREATE TABLE medcontrol.user_medications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  category    text NULL,
  principio_ativo text NULL,
  usage_count int NOT NULL DEFAULT 1,
  first_used_at timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lower(name))
);

-- RLS: cada user só lê e escreve o próprio histórico
ALTER TABLE medcontrol.user_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_meds_select ON medcontrol.user_medications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_meds_insert ON medcontrol.user_medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_meds_update ON medcontrol.user_medications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_user_meds_user_lastused ON medcontrol.user_medications (user_id, last_used_at DESC);
```

### 4.3 Migration 3 — Tratamento, Dose e SOS recebem `group_id` e `cmed_class`

```sql
ALTER TABLE medcontrol.treatments
  ADD COLUMN group_id text NULL,
  ADD COLUMN cmed_class text NULL;

ALTER TABLE medcontrol.doses
  ADD COLUMN group_id text NULL,
  ADD COLUMN cmed_class text NULL;

ALTER TABLE medcontrol.sos_rules
  ADD COLUMN group_id text NULL,
  ADD COLUMN cmed_class text NULL;

-- CHECK só no Nível 1 (mesma do catálogo — DRY via função ou repete)

CREATE INDEX idx_treatments_group ON medcontrol.treatments (user_id, group_id);
CREATE INDEX idx_doses_group_actualtime ON medcontrol.doses (user_id, group_id, actual_time);
CREATE INDEX idx_doses_cmed_class_actualtime ON medcontrol.doses (user_id, cmed_class, actual_time);
CREATE INDEX idx_sos_rules_group ON medcontrol.sos_rules (patient_id, group_id);
```

**Por que `group_id` E `cmed_class` em `doses` e não só em `treatments`?** Para queries de Analytics rodarem rápido sem JOIN. Dose é snapshot ponto-no-tempo. Se treatment muda categoria depois (user editou ou CMED reclassificou a apresentação no mês seguinte), doses passadas preservam a categoria original (auditoria correta).

### 4.4 Migration 4 — RPC `search_medications` retorna category

```sql
CREATE OR REPLACE FUNCTION public.search_medications(q text, lim int DEFAULT 20)
RETURNS TABLE (
  nome_comercial text,
  principio_ativo text,
  category text
)
LANGUAGE sql STABLE
AS $$
  SELECT nome_comercial, principio_ativo, category
  FROM medcontrol.medications_catalog
  WHERE ativo = true
    AND (
      lower(nome_comercial) = lower(q)                          -- exact
      OR lower(nome_comercial) LIKE lower(q) || '%'             -- starts-with
      OR lower(principio_ativo) LIKE lower(q) || '%'
      OR lower(nome_comercial) LIKE '%' || lower(q) || '%'
    )
  ORDER BY
    CASE WHEN lower(nome_comercial) = lower(q) THEN 0
         WHEN lower(nome_comercial) LIKE lower(q) || '%' THEN 1
         WHEN lower(principio_ativo) LIKE lower(q) || '%' THEN 2
         ELSE 3 END,
    nome_comercial
  LIMIT lim;
$$;
```

---

## 5. Estratégia de preenchimento — CMED é a fonte oficial

Estratégia v1 baseada em dicionário manual virou **fallback**. Agora a fonte primária é a planilha oficial CMED da ANVISA.

### 5.1 Fonte primária — Tabela CMED mensal

**O que é:** Câmara de Regulação do Mercado de Medicamentos (ANVISA) publica mensalmente o XLSX oficial de preços com **classe terapêutica codificada** por apresentação.

**URL:** https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos (link de download versionado `xls_conformidade_site_YYYYMMDD_*.xlsx`)

**Colunas relevantes para esta feature:**

| Coluna CMED | Uso no Dosy |
|---|---|
| `EAN 1` | Match com `medications_catalog` (chave primária do join) |
| `SUBSTÂNCIA` | Fallback se EAN não match (compara com `principio_ativo`) |
| `PRODUTO` | Validação de nome comercial |
| `CLASSE TERAPÊUTICA` | **→ alimenta `cmed_class` (Nível 2) e via de-para, `group_id` (Nível 1)** |
| `TIPO DE PRODUTO` | Diferencia Genérico/Similar/Referência (informativo) |
| `TARJA` | Vermelha/Preta/Sem tarja (informativo, futura feature de alerta) |

**Cobertura:** ~30 mil apresentações = ~100% do mercado brasileiro regulado. Inclui Clavulin, Novalgina, Tylenol, Buscopan, todos os nomes comerciais.

### 5.2 Pipeline de ingest

Script novo `scripts/ingest-cmed.mjs`:

```
1. Download XLSX mensal CMED (URL atual com mês corrente)
2. Parse via lib `xlsx` ou `exceljs`
3. Para cada linha:
   a. UPSERT em medcontrol.medications_catalog usando EAN como chave
   b. Setar cmed_class = linha.CLASSE_TERAPEUTICA
   c. Setar group_id = CMED_CLASS_TO_GROUP[normalize(cmed_class)] (de-para)
   d. Setar substancia, tarja, tipo_produto (colunas novas no catálogo)
4. Log final: X linhas processadas, Y novas, Z atualizadas, W sem match no de-para (= "Outro")
5. Roda como Edge Function agendada via pg_cron (1× por mês, dia 5 às 4h BRT)
```

O script `scripts/ingest-anvisa.mjs` antigo (CSV DADOS_ABERTOS) **continua existindo** porque ele traz `principio_ativo` cru, que CMED nem sempre tem completo. As duas fontes se complementam via EAN.

### 5.3 Fallback — Para o que escapa CMED (~3-5%)

Itens que ficam sem `group_id` após CMED ingest:

- **Manipulados** (farmácia de manipulação) — CMED não cobre
- **Suplementos vendidos sem registro de medicamento** — vitaminas isoladas, ômegas
- **Importados/exceção** (Anvisa autoriza caso a caso)
- **Itens novíssimos** (entre publicação CMED e CSV ANVISA pode haver lag)

Para esses, mantém-se as Camadas 1+2 da v1 do plano como fallback:

- **Camada 1 — Dicionário curado** `scripts/data/principio_ativo_to_group.json` com ~50 princípios ativos mais comuns que escapam CMED (vitaminas, manipulados típicos)
- **Camada 2 — Heurística keyword** `scripts/data/group_keywords.json` (sufixos `cilina`, `profeno`, `sona` etc.) — aplicada no `principio_ativo` tokenizado por `+`, `,`, espaço

Ordem de precedência no ingest:

1. CMED `CLASSE TERAPÊUTICA` (via EAN match) → `cmed_class` + `group_id` derivado
2. Se não há linha CMED para o EAN: Camada 1 (dicionário) sobre `principio_ativo` tokenizado
3. Camada 2 (keyword) sobre `principio_ativo` tokenizado
4. Se nada match: `group_id = 'outro'`, `cmed_class = NULL`

### 5.4 Tokenização do princípio ativo (resposta à Pergunta 1 do user)

Importante: Clavulin tem `principio_ativo = "Amoxicilina + Clavulanato de Potássio"`. Quando CMED não casa (raro) e cai no fallback, a Camada 1 precisa **tokenizar** o princípio:

```js
// Pseudocódigo
function categorizeByPrinciple(principioAtivo, dictionary) {
  const tokens = principioAtivo
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')   // sem acento
    .split(/[+,;]|\s+e\s+/)                            // separadores
    .map(t => t.trim())
    .filter(Boolean);
  // testa cada token; primeiro match vence (geralmente é o ativo principal)
  for (const t of tokens) {
    if (dictionary[t]) return dictionary[t];
  }
  return null;
}

// Exemplo Clavulin:
// "Amoxicilina + Clavulanato de Potássio"
// → tokens: ["amoxicilina", "clavulanato de potassio"]
// → "amoxicilina" → match → "antibiotico"
```

Mesmo se CMED fizer match direto (caso comum), essa tokenização cobre casos limítrofes (Tylenol Sinus = paracetamol + pseudoefedrina, etc.).

---

## 6. Mudanças na UI

### 6.1 Componente novo — `CategoryPicker.jsx`

`src/components/dosy/CategoryPicker.jsx`

- Aceita props: `value`, `onChange`, `disabled`, `required`, `helperText`
- Render: chip com a categoria atual (cor + nome) → ao clicar abre Sheet com lista das 16 categorias + "Outro" + busca rápida no topo
- Modo readonly quando `value` veio de autofill (mostra ícone 🔒 + texto "Detectado automaticamente — toque para alterar")
- Cor do chip vem da constante `medCategories.js`
- Componente vai pro barrel `src/components/dosy/index.js`

### 6.2 `TreatmentForm.jsx`

Novo campo entre "Medicamento" e "Dose/Unidade":

```
┌─────────────────────────────────────┐
│ Medicamento *                       │
│ [Dipirona Sódica 500mg          ▼] │ ← MedNameInput
├─────────────────────────────────────┤
│ Categoria                            │
│ [🟧 Antitérmico/Analgésico  🔒]    │ ← CategoryPicker readonly (autofill)
│ Detectado automaticamente           │
├─────────────────────────────────────┤
│ Dose *                               │
│ ...                                  │
```

Comportamento:

1. User digita "Dip..." em Medicamento → MedNameInput sugere "Dipirona Sódica 500mg" (do catálogo)
2. User seleciona sugestão → `onSelect({ name, principio_ativo, category })` → form preenche `medName` e `category` automaticamente
3. CategoryPicker fica em modo readonly (ícone cadeado) — clicar abre Sheet pra override
4. **Se** o medicamento digitado for texto livre **e não match nada** → CategoryPicker fica em modo `required` (asterisco vermelho, validação no submit)
5. Ao salvar, se categoria foi escolhida manualmente E nome não estava no catálogo global → upsert em `user_medications` com `name + category + usage_count++`

### 6.3 `SOS.jsx`

Mesma adição do TreatmentForm, com o mesmo comportamento. Campo fica entre "Medicamento" e "Unidade".

### 6.4 `MedNameInput.jsx`

Mudança mínima:

- A função `onSelect` passa a receber `{ name, principio_ativo, category, source }` (source: `"catalog" | "user" | "free_text"`)
- Item no dropdown mostra chip de categoria pequeno do lado direito quando disponível
- Quando vier de `user_medications`, prefer essa categoria sobre a do catálogo (user já personalizou)

### 6.5 `useUserMedications.js`

Novos métodos:

- `upsertUserMedication(name, category, principio_ativo?)` — chamado ao salvar treatment
- `getCategoryHint(name)` — consulta cache local + user_medications + catálogo, retorna categoria sugerida ou null
- Sync com `medcontrol.user_medications` via Realtime (mesmo padrão de patients/treatments)

### 6.6 Edição de tratamento existente

Tela edit-treatment ganha o mesmo CategoryPicker. Treatments antigos com `category IS NULL` aparecem com "Não classificado" + sugestão automática vinda do backfill. User pode aceitar ou trocar.

---

## 7. Backfill de tratamentos e doses históricos

Estratégia de backfill em 2 ondas:

### Onda A — Catálogo global (uma vez)

Quando Migration 1+2 sobem, roda script `scripts/backfill-catalog-categories.mjs`:

1. Conecta no Supabase com service role
2. SELECT todas linhas de `medications_catalog` com `category IS NULL`
3. Para cada uma, aplica Camadas 1+2 (dicionário + keyword heurística)
4. UPDATE em batch (1000 linhas/transação) com a categoria descoberta
5. Linhas que escapam ficam NULL (~5% esperado)
6. Log final: "X linhas categorizadas, Y ficaram não-classificadas"

### Onda B — Tratamentos/doses dos usuários (uma vez)

Edge Function `backfill-user-treatment-categories`:

1. SELECT distinct `lower(medName)` de `treatments` onde `category IS NULL`
2. Pra cada nome: tenta join com `medications_catalog` (LIKE/trigram) → se match único e tem categoria → aplica
3. Se múltiplo match ou ambíguo → aplica Camadas 1+2 da heurística diretamente sobre `medName`
4. Se ainda não match → `category = NULL` (UI mostra "Não classificado", user pode editar)
5. UPDATE em batch nos treatments + cascata: UPDATE doses SET category = treatment.category WHERE doses.treatment_id = treatment.id
6. Log + linha em `medcontrol.app_releases` ou tabela `migrations_history` (rastreabilidade)

**Decisão importante:** SOS não tem treatment_id (cada SOS é avulso). Aplica heurística direto no `medName` da sos_rule e do dose-sos correspondente.

---

## 8. Analytics, Histórico e Relatórios

Esta é a entrega que justifica a feature. Mudanças por tela:

### 8.1 `Analytics.jsx`

Adicionar card novo entre os atuais:

```
┌─ Doses por categoria — últimos 90 dias ──────────┐
│                                                   │
│        ╭───╮                                      │
│       ╱     ╲    Antibiótico       12  ████      │
│      │  47   │   Antitérmico       18  ██████    │
│       ╲     ╱    Anti-inflamatório  8  ███       │
│        ╰───╯     Vitamina           5  ██        │
│                  Outras             4  █         │
│                                                   │
│  [Ver detalhes →]                                │
└───────────────────────────────────────────────────┘
```

- Donut chart no canto + lista top 5 com barra horizontal
- Chip clicável → leva a Histórico filtrado por categoria
- Query: `groupDosesByCategory(userId, period, patientId?)`
- Reusa `useDosyQuery` da Fase 1 do Refactor

A heurística `FLAGGED_CLASSES` atual (Corticoide/Opioide/Benzo/AINE → flags de risco) **permanece** mas agora alimenta-se da coluna `category` real em vez do substring matching. Mais robusto.

### 8.2 `DoseHistory.jsx`

Adicionar chip de filtro "Categoria" no FilterBar (ao lado do filtro de paciente):

- Bottom sheet com lista de categorias
- Multi-select permitido (pode marcar Antibiótico + Anti-inflamatório)
- URL params: `?category=Antibiótico,Anti-inflamatório` para deep link
- Cada item da lista de dose ganha chip pequeno de categoria do lado direito

### 8.3 `Reports.jsx`

- Novo grupo no relatório: "Resumo por categoria — período X a Y"
- Tabela: Categoria | Total doses | % do total | Top medicamento da categoria
- PDF + CSV exportam o novo grupo
- Pode-se filtrar relatório por categoria(s) específica(s) antes de gerar

### 8.4 Query helper

Novo arquivo `src/services/categoryAnalyticsService.js`:

- `getDoseCountsByCategory(userId, periodStart, periodEnd, patientId?)` → `{ Antibiótico: 12, ... }`
- `getTopMedicationsPerCategory(userId, period, patientId?, topN=3)` → `{ Antibiótico: [{name, count}, ...], ... }`
- `getCategoryTrend(userId, periodStart, periodEnd, granularity)` → série temporal pra gráfico de linha

Tudo via RPC server-side (PostgreSQL agrupa muito mais rápido que cliente).

---

## 9. Implementação em fases

Estilo igual ao `Refactor_Full.md`: fases incrementais, cada uma com QA antes da próxima.

### Fase 1 — Foundation + ingest CMED (estimado 1-2 semanas)

**Entregáveis:**

- [ ] Migrations 1 a 4 aplicadas em dev + prod (apply via Supabase MCP, rollback testado)
- [ ] `src/constants/medCategories.js` com `MED_GROUPS` (16 + 1) e `CMED_CLASS_TO_GROUP` (de-para ~90 entradas) + cores
- [ ] `scripts/data/principio_ativo_to_group.json` (fallback curado top 50, para itens fora CMED)
- [ ] `scripts/data/group_keywords.json` (fallback heurística keyword)
- [ ] **`scripts/ingest-cmed.mjs` novo** — baixa XLSX mensal CMED, parse, upsert no catálogo via EAN, popula `cmed_class` + `group_id`
- [ ] `scripts/ingest-anvisa.mjs` atualizado — passa a complementar `principio_ativo_normalizado` (caso de fallback)
- [ ] `scripts/backfill-catalog-groups.mjs` (one-shot) — roda CMED + fallbacks contra catálogo existente
- [ ] Edge Function `cron-cmed-monthly-sync` agendada via pg_cron (dia 5 às 4h BRT)
- [ ] RPC `search_medications` retorna `group_id`, `cmed_class` (backward-compatible — clientes antigos ignoram)
- [ ] Unit tests para tokenização do princípio ativo + de-para CMED→Grupo (Vitest)
- [ ] Build greenfield + lint + types

**QA:**

- Unit tests passando
- Validação manual: query `SELECT group_id, cmed_class, COUNT(*) FROM medications_catalog GROUP BY 1,2 ORDER BY 3 DESC` mostra distribuição razoável (Antitérmico/Analgésico + Antibiótico + Anti-hipertensivo são os top 3 esperados)
- Validação manual: buscar "Clavulin" no Supabase SQL editor via RPC `search_medications('Clavu', 5)` — primeiro resultado deve ter `group_id = 'antibiotico'`, `cmed_class = 'Penicilinas de espectro ampliado'` (ou similar)
- Validação manual: buscar "Novalgina" → `group_id = 'antitermico_analgesico'`
- Validação manual: buscar "Tylenol" → `group_id = 'antitermico_analgesico'`
- Cobertura: <5% das linhas de `medications_catalog` com `group_id IS NULL` ou `group_id = 'outro'` (alvo)

### Fase 2 — UI cadastro (estimado 1 semana)

**Entregáveis:**

- [ ] `src/components/dosy/CategoryPicker.jsx` + export no barrel
- [ ] `TreatmentForm.jsx` integrado com CategoryPicker + autofill + required-when-not-autofilled
- [ ] `SOS.jsx` mesma integração
- [ ] `MedNameInput.jsx` retorna `category` + chip na dropdown
- [ ] `useUserMedications.js` ganha `upsertUserMedication` + `getCategoryHint`
- [ ] Edição de tratamento existente também mostra CategoryPicker
- [ ] Edge Function `backfill-user-treatment-categories` deployada (one-shot, idempotente)

**QA:** 2-emulator test (teste-plus + teste-free) com fluxo completo:
1. Cadastrar tratamento de Dipirona → categoria preenche auto "Antitérmico/Analgésico"
2. Cadastrar tratamento de "Remédio fictício XYZ" → CategoryPicker obrigatório, user escolhe "Outro"
3. Cadastrar SOS de Buscopan → categoria preenche auto "Gastrointestinal" (ou Outro, conforme dicionário)
4. Editar tratamento antigo "Amoxicilina" → categoria aparece "Antibiótico" via backfill
5. Verificar `user_medications` foi populada para nomes não-catalogados

### Fase 3 — Analytics e Relatórios (estimado 1-2 semanas)

**Entregáveis:**

- [ ] `src/services/categoryAnalyticsService.js` + RPCs no Supabase
- [ ] Card "Doses por categoria" em `Analytics.jsx` (donut + top 5)
- [ ] Filtro "Categoria" em `DoseHistory.jsx` (multi-select bottom sheet)
- [ ] Chip de categoria visível nos itens de `DoseList`
- [ ] Grupo "Resumo por categoria" em `Reports.jsx` (PDF + CSV)
- [ ] Migração da heurística `FLAGGED_CLASSES` para usar coluna `category` real
- [ ] Deep links: `/historico?category=Antibiótico` funciona

**QA:** validar com dados reais do teste-plus:
1. Marcar 5 doses de Antibiótico no histórico recente
2. Ir em Analytics → donut mostra fatia de Antibiótico
3. Clicar no chip → leva pro Histórico filtrado
4. Gerar relatório PDF → ver grupo categoria preenchido

### Fase 4 — Refinamentos opcionais (estimado 1 semana, pode adiar)

**Entregáveis:**

- [ ] Telemetria: contar quantos cadastros tiveram categoria auto-detectada vs. manual (Sentry breadcrumb ou Supabase tabela `feature_metrics`)
- [ ] Rotina mensal de curadoria: relatório por e-mail listando categorias mais aprendidas pelos users → revisar pra possivelmente seed-ar no catálogo global
- [ ] Notificação leve "Você usou Antibiótico 3 vezes este mês" (oportunidade — não bloqueante)
- [ ] Card de Antibiótico no PatientDetail (pra cuidador ver rápido)

**QA:** opcional, somente smoke test.

---

## 10. Decisões pendentes (preciso da sua aprovação antes de começar)

| # | Pergunta | Opção A (recomendada) | Opção B | Risco se errar |
|---|---|---|---|---|
| 1 | **Hierarquia em 2 níveis (16 grupos amigáveis + ~90 classes CMED) está boa?** | Sim, hierarquia. Grupo visível, Classe técnica oculta na UI principal mas disponível em filtros avançados e CSV/PDF. | Plano: usar SÓ Nível 1 (16 grupos) e descartar Nível 2. Mais simples mas perde granularidade. | Opção B torna analytics avançado impossível (ex: "Macrolídeos vs Cefalosporinas"). |
| 2 | **"Outro" deve permitir texto livre complementar?** | Não — só os 16 grupos fechados + Classe CMED quando disponível. Mantém analytics agregável. | Sim — campo `group_other_label text` para texto livre. | Texto livre quebra analytics ("Antibioticos" vs "Antibiótico" vira buckets separados). |
| 3 | **Quando CMED não cobre (~3-5%), aplica fallback heurístico agressivo ou conservador?** | Agressivo — Camadas 1+2 marcam tudo que casar. User edita se errado. | Conservador — só Camada 1 (dicionário). Resto fica `group_id = 'outro'`. | Agressivo erra ~3-5%. Conservador deixa muita coisa em "Outro". |
| 4 | **Categoria de treatment afeta doses futuras?** | Sim — ao salvar treatment, doses agendadas a partir daquele momento herdam `group_id` e `cmed_class`. | Não — dose só recebe categoria quando user marca como tomada. | Opção B desativa filtros de Analytics pra doses pendentes (perde funcionalidade). |
| 5 | **Versão de release** | `v0.2.4.0` (bump segundo dígito do segmento de feature). | `v0.2.3.18` (continua numeração patch). | Versionar como patch confunde quem lê changelog — feature merece bump visível. |
| 6 | **Quando shipar?** | Depois das 5 fases do Refactor_Full estarem todas em prod estável. Esta feature requer fundação Fase 1 (RealtimeGate) pra Realtime de `user_medications` funcionar sem race. | Em paralelo, branch própria. | Em paralelo aumenta merge conflict risk. |
| 7 | **PRD em `dosy-app/docs/` precisa atualizar antes?** | Sim — adicionar seção no PRD descrevendo a feature como decidida, mover Interação Medicamentosa pra "depende de categorização". | Não — implementar primeiro, documentar depois. | Sem atualizar PRD, futuro contexto pode duplicar trabalho ou divergir. |
| 8 | **Source-of-truth da Classe Terapêutica** | **CMED** (planilha XLSX mensal ANVISA, ~30k apresentações, grátis, oficial). | Curadoria manual (dicionário top 150 princípios). | Sem CMED, cobertura cai de ~95% pra ~80% e exige manutenção contínua manual. |
| 9 | **Ingest CMED roda como?** | Edge Function agendada via `pg_cron` (dia 5 do mês às 4h BRT). Executa idempotente: download → parse → upsert via EAN → log. | Script local rodado manual no dia 1 de cada mês. | Manual quebra se eu esquecer. Edge automatiza. |

---

## 11. Não-objetivos (fora deste plano)

Coisas que parecem relacionadas mas **NÃO entram**:

- **Interação medicamentosa** (anticoagulante + AINE = alerta) — depende dessa fundação mas é feature separada, futura.
- **Alergia a princípio ativo** — cadastro de alergia do paciente cruzando com category ou principio_ativo. Feature futura.
- **Dosagem segura** — sugerir mg/dia máximo por categoria. NÃO. App não recomenda dosagem (regulatório — não somos médico).
- **ATC code completo** (5 níveis WHO) — over-engineering. As 16 categorias amigáveis bastam pro uso.
- **Bula automática** — texto da bula ANVISA puxado da API. Mencionado no PRD v2.0, mas é outra feature.
- **Categorização de SOS automática por contexto** (ex: "se foi tomado às 3h da manhã, é Ansiolítico") — adivinhação por horário não funciona, ignorar.

---

## 12. Métricas de sucesso

Como saber se a feature está funcionando 30 dias após shipping:

- **>70% dos novos tratamentos** têm categoria preenchida automaticamente (via Camada 1+2 do catálogo)
- **<5% dos cadastros** ficam com "Não classificado"
- **>20% dos usuários ativos** usam o filtro de categoria em DoseHistory ou Analytics ao menos 1× por semana
- **Card "Doses por categoria"** tem tap-rate >15% no Analytics
- **Zero issues no Sentry** relacionados a category NULL inesperado ou CHECK constraint violation

---

## 13. Próximos passos imediatos (após sua aprovação)

1. Você responde as 9 decisões pendentes da §10
2. Eu atualizo este plano com as decisões consolidadas (vira "v3")
3. Eu adiciono uma seção sobre a feature no PRD (`dosy-app/docs/`) — se decisão #7 for "sim"
4. Abro branch `release/v0.2.4.0-categorias-medicamentos` (ou conforme decisão #5)
5. Começo pela Fase 1 — Foundation + ingest CMED

Documento fica em `Plano_Categorias_Medicamentos.md` na raiz até estar 100% executado, depois move pra `context/archive/`.

---

## 13.1 Delta v0.2.4.0 (MVP entregue) vs PRD oficial

PRD em `dosy-app/docs/01-PRD.md` §4.1 (Tratamentos) descreve versão **mais ambiciosa** da feature:

| Aspecto | PRD oficial | v0.2.4.0 entregue (MVP) | Evolução prevista |
|---|---|---|---|
| **Quantidade de categorias** | 33 + "Outro" com texto livre | 16 grupos + "Outro" sem texto livre | v0.2.4.1: expandir pra 33 |
| **Multi-categoria** | Sim — chips multi-select (Tylenol = `{Analgésico, Antitérmico}`) | Single — uma categoria por med | v0.2.4.1: array `text[]` em vez de `text` |
| **6 grupos clínicos** | UI organiza por: Sintomas agudos / Infecção / Cardiovascular-metabólico / Saúde mental / Hormonal-suplementação / Outros sistemas | Lista plana sem agrupamento UI | v0.2.4.1: section headers no Sheet |
| **Fonte da classificação** | ATC code da OMS via `Plano_Categorias_Medicamentos` recomenda | CMED (mesma camada terapêutica, melhor cobertura BR) | OK — CMED é melhor pra BR; ATC era heurística do PRD |
| **Multi-categoria em SOS** | Sim — mesma mecânica de Tratamento | Single | v0.2.4.1 |

**Decisão MVP:** entregar com 16/single porque:
1. Hierarquia 2 níveis (grupos amigáveis + classe CMED técnica) já cobre os casos críticos de Analytics.
2. Schema com `text` é mais simples; migração `text → text[]` é não-destrutiva (`ARRAY[group_id]` pra todos os existentes).
3. Multi-categoria adiciona complexidade no CategoryPicker (chips + dropdown vs single chip + sheet) — testar UX em 16 antes de subir pra 33 multi.

**Evolução planejada (v0.2.4.1 ou v0.2.5.0):**
- Migration: `ALTER ... ALTER COLUMN group_id TYPE text[]` + backfill ARRAY[antigo] + CHECK constraint por elemento
- Expandir constante MED_GROUPS de 16 → 33
- Reorganizar CategoryPicker em 6 grupos clínicos colapsáveis
- ATC mapping suplementar pra casos onde CMED não atribui múltiplas classes corretamente
- Multi-categoria propaga em RPCs + analytics agregação por elemento de array

---

## 14. Changelog do plano

### v2 — 2026-05-22 (revisão pós perguntas do user)

**Mudanças motivadas por 2 perguntas:**

> "O que acontece se eu digitar Clavu... ? Aparece no dropdown? Entra em categoria automática?"

→ Resposta: sim, encontra (Clavulin existe no catálogo ANVISA via CSV). Mas o dicionário Camada 1 da v1 fazia lookup exato (`principio == "amoxicilina"`), não casava com `principio = "Amoxicilina + Clavulanato de Potássio"`. **Adicionada tokenização do princípio ativo** na §5.4 — separa por `+`, `,`, `e`, espaço, testa cada token.

> "16 categorias é pouco. Cada uma com poucos exemplos. Existe API completa pronta?"

→ Resposta: investigação revelou **planilha CMED da ANVISA** com classe terapêutica oficial por apresentação (~30k linhas, atualizada mensalmente, grátis, formato XLSX, EAN para match preciso).

**Decisões revisadas:**

- §3 **virou hierarquia 2 níveis**: 16 grupos amigáveis (Nível 1, visível na UI) + ~90 classes CMED (Nível 2, oficial técnica, oculta em UI principal mas disponível em filtros/exportações)
- §4.1 migration do catálogo ganha `ean`, `group_id`, `cmed_class`, `tarja`, `tipo_produto`, `updated_from_cmed_at`
- §4.3 migrations de `treatments`, `doses`, `sos_rules` ganham `group_id` E `cmed_class` (não mais só `category`)
- §5 **reescrita completa**: CMED vira fonte primária; dicionário manual + heurística viraram fallback para os ~3-5% que escapam CMED
- §9 Fase 1 estimativa subiu de 1 semana pra 1-2 semanas (incluir ingest CMED + Edge Function cron)
- §10 **decisões pendentes passaram de 7 pra 9** (adicionadas #8 source-of-truth e #9 modo de ingest CMED)

### v1 — 2026-05-22 (versão inicial)

- Estrutura inicial proposta com 16 categorias planas
- Estratégia baseada em dicionário manual de ~150 princípios ativos + heurística keyword
- 7 decisões pendentes para validação
