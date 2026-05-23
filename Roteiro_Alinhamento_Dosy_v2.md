# Roteiro Alinhamento medcontrol_v2 ↔ Dosy v2 — versão AMBICIOSA

> **Status:** Roteiro executável criado 2026-05-22 por análise comparativa medcontrol_v2 (v0.2.5.0 vc 83) vs Dosy v2 (rewrite documentado em 22 docs + 15 ADRs).
> **Última atualização:** 2026-05-22 22:30 BRT — **adicionado P9 Categorização funcionando em prod + promoção emergencial P4.1 → P0.7 MedicationPicker BottomSheet**
> 2026-05-22 18:30 BRT — adicionado P8 Hardening de escala (gate obrigatório pré-launch público)
> **Audiência:** IA executora trabalhando no medcontrol_v2.
> **Self-contained:** este documento contém todo contexto necessário pra executar sem depender da sessão de análise.
> **Meta:** levar medcontrol_v2 o mais próximo possível da perfeição — incorporando TUDO de melhor que existe nos docs Dosy v2 + preservando TUDO de bom que medcontrol já tem em prod. **NADA fica "pra Dosy v2 fazer".**

---

## 🚨 ADENDO 2026-05-22 22:30 BRT — P9 Categorização funcionando em prod + MedicationPicker URGENTE

> **Origem:** user testou v0.2.5.0 SHIPPED em device e reportou 2 problemas críticos:
> 1. **"Antibióticos dados aos meus filhos não aparecem categorizados — em Analytics só aparece 'Outros'"**
> 2. **"MedNameInput dropdown CONTINUA quebrado — campo some, teclado cobre, sugestões não visíveis, arrastar fecha"**
>
> Análise revelou que **Bloco B v0.2.5.0 NÃO resolveu estruturalmente** o autocomplete (patches superficiais — dropdown inline em mobile é o anti-pattern raiz). E que **catálogo medcontrol cobre só 900 entries** (não os 30k prometidos pela spec Dosy v2), com **17 brand-names validados** todos do caso pessoal Henrique — pediatria, idoso, polifarmácia ficam de fora.
>
> **Esta seção:** decisão arquitetural sobre catálogo + 10 fixes priorizados + **promoção emergencial P4.1 → P0.7 (MedicationPicker BottomSheet)**.

---

### 🧭 Decisão arquitetural: API live vs catálogo próprio Supabase

User perguntou: *"cadastrar manualmente todos os 30k medicamentos é a melhor opção? Não tenho API ANVISA pra passar por lá?"*

**Resposta honesta após pesquisa (2026-05-22):**

#### Opções avaliadas

| Opção | Custo | Cobertura BR | Latência | Offline | Manutenção |
|---|---|---|---|---|---|
| **A. ANVISA API oficial** `api.anvisa.gov.br` | Grátis (mas requer auth oficial) | Completa | ~200ms rede | ❌ quebra | Zero |
| **B. PharmaDB API** (third-party BR) | **R$62-280/mês** (5k-300k req/mês) | 28.935 produtos ANVISA + 192k interações | ~150ms | ❌ quebra | Zero |
| **C. Infosimples / Netrin** | Pay-per-query (~R$0,05-0,15/req) | Boa | ~300ms | ❌ quebra | Zero |
| **D. CMED XLSX mensal import + Supabase próprio** | **$0** (cabe free tier) | 100% BR (~30k apresentações) | <50ms (GIN trgm) | ✅ funciona | Cron mensal automático |
| **E. Hybrid: catálogo Supabase + PharmaDB fallback long-tail** | $0-62/mês | 100% + auto-expand | <50ms hit / 150ms miss | ✅ partial | Cron + lazy growth |

#### Tamanho real do catálogo Supabase

> *"Criar BD próprio só pra isso me parece exagero"* — **NÃO É EXAGERO**. Faz a conta:

- 30.000 rows × ~500 bytes/row = **~15 MB no DB**
- Supabase free tier: **500 MB** (você usa 3% só pra catálogo)
- GIN trgm index = autocomplete <50ms
- CMED XLSX mensal (10-15 MB compactado) baixado por Edge cron, processado e inserido em batches

**15 MB num DB Postgres é peanut.** É menos que 1 foto de paciente. Não tem nenhum motivo técnico ou financeiro pra evitar.

#### Por que opção D (catálogo próprio) ganha

1. **Custo zero recorrente** vs R$62-280/mês PharmaDB
2. **Offline funciona** — você está construindo app healthcare onde alarme dispara mesmo offline. Autocomplete que quebra sem rede = inconsistência UX
3. **Latência <50ms vs 150-300ms** — UX picker depende disso (3-6× mais rápido)
4. **Zero dependência de terceiros** — PharmaDB pode aumentar preço, virar serviço pago obrigatório, quebrar API, etc. medcontrol já passou por isso com Supabase upgrade reativo
5. **Padrão da indústria BR** — CUCO (líder BR healthcare) usa próprio catálogo, não API externa. Medisafe, MyTherapy idem
6. **Classe terapêutica vem direto da planilha CMED** — coluna `CLASSE TERAPÊUTICA` na XLSX mensal já tem categorização ANVISA oficial. Você não precisa "categorizar manualmente", **só importar a planilha**
7. **Você terá acesso pra validar** — pode rodar `SELECT * FROM medications_catalog WHERE commercial_name ILIKE '%amox%'` direto no Supabase Studio e ver as 50+ apresentações com classe terapêutica oficial

#### Recomendação final

**Implementar opção D (catálogo Supabase com import CMED XLSX mensal).** Cancela a ideia de "BD próprio é exagero" — não é. É a melhor escolha técnica E financeira E operacional.

**Opcionalmente:** opção E (hybrid) como evolução v1.1+ se long-tail aparecer (medicamentos manipulados, importados, suplementos sem registro CMED) — PharmaDB fallback chamado apenas em RPC `search_medications` quando local retorna 0.

**O que o medcontrol fez de errado em v0.2.4.0+v0.2.5.0:**
- Parou em 764 entries (não importou os 30k)
- Validou só 17 brand-names (do caso Henrique)
- Não criou cron mensal CMED
- Não tem RPC fallback pra long-tail

**Fix:** P9.1 abaixo.

---

### 🚨 PROMOÇÃO EMERGENCIAL — MedicationPicker BottomSheet de P4.1 → P0.7

**Razão:** user está sofrendo HOJE. Não dá pra esperar 14 semanas (Sprint 7-8 do roteiro original).

Spec Dosy v2 completa em `dosy-app/docs/07-DESIGN_SYSTEM.md §3.13` + 7 estados em `08-ESTADOS_UI.md` + 7 validações device em `workflow/VALIDATIONS.md`. **Implementar AGORA, antes de qualquer outro P0-P8 não-LGPD.**

#### P0.7 — Implementar `<MedicationPicker>` BottomSheet em mobile (substituir MedNameInput dropdown)

**Onde:** criar `src/components/dosy/MedicationPicker.jsx` substituindo uso de `MedNameInput.jsx` em `TreatmentForm.jsx` e `SOSForm.jsx`.

**Comportamento crítico (não-negociável):**
- Trigger: input text comum no form → tap abre BottomSheet 80vh
- Sheet header: back arrow + "Buscar medicamento" + X close (NÃO outside-click — anti-bug medcontrol)
- Search input autofocus + teclado abre automaticamente acima do sheet
- Debounce 250ms com loading textual "⌛ Buscando..." (não skeleton)
- Lista scrollable de result rows: `commercial_name (16sp bold)` + `principio_ativo (12sp gray)` + `<CategoryBadge sm>` colorido
- **`onPointerDown` em result rows** (NÃO `onClick` — race condition blur/click foi a causa do "preenche errado")
- Footer SEMPRE visível: `+ Continuar com "{query}" digitado` em sunset gradient
- Cap 20 results + sentinel "Refine busca pra ver mais"
- Estados explícitos: idle / searching / results / empty / error / offline / loading_too_long (>10s)
- Tap targets ≥56dp (Persona 6)

**Validações device obrigatórias (gate):**
1. Pixel 6 — Sheet permanece aberto durante scroll dentro da lista (anti-bug "some quando arrasta")
2. Samsung A54 — teclado virtual NÃO cobre resultados (Sheet acima do teclado)
3. Xiaomi Redmi 12 — `onPointerDown` registra ANTES do blur (anti-bug "preenche errado")
4. Voice input — query preservada após dictation
5. Font scaling 1.5× (Persona 6 idoso) — targets ≥56dp + labels não cortados

**Componentes auxiliares a criar em `src/components/dosy/`:**
- `MedicationPicker.jsx` (entry point)
- `MedicationSearchSheet.jsx` (Sheet body)
- `MedicationResultRow.jsx` (row com CategoryBadge integrado)
- `MedicationFreeTextFooter.jsx` (botão "Continuar com nome livre")
- `MedicationPickerLoading.jsx` (estado loading explícito)

**Aceite:** 0 incidências dos 3 bugs reproduzíveis (some/cobre/preenche errado) em 7 dias prod + métrica PostHog `Taxa de conclusão cadastro tratamento >85%` (era ?% — medir antes/depois).

**Branch:** `feat/medication-picker-bottomsheet-EMERGENCIAL`

**Não esperar P1-P8.** Branch paralela com P0 LGPD/segurança. Ship junto na próxima release.

---

### P9.1 — CMED XLSX import completo (~30k entries) substituindo backfill manual 900

**Origem:** sample validation real mostrou que catálogo medcontrol cobre só 900 entries (17 brand-names validados = 100% caso Henrique, ~0% pediatria/idoso/contraceptivo).

**Onde:** novo arquivo `scripts/automation/fetch-cmed-dataset.mjs` + `scripts/automation/import-cmed.mjs`.

**Implementação:**

```javascript
// scripts/automation/fetch-cmed-dataset.mjs
import * as fs from 'fs/promises';
import * as https from 'https';

const CMED_BASE = 'https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos';

async function findLatestXlsxUrl() {
  // Scrape /precos page pra encontrar último link XLSX (`xls_conformidade_site_YYYYMMDD_*.xlsx`)
  // OU hardcode URL atual + cron mensal verifica novo
}

async function download(url, outPath) {
  // Stream XLSX pra disco (~10-15 MB)
}

const url = await findLatestXlsxUrl();
await download(url, `supabase/seeds/medications-cmed-${new Date().toISOString().slice(0, 7)}.xlsx`);
```

```javascript
// scripts/automation/import-cmed.mjs
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const wb = xlsx.readFile('supabase/seeds/medications-cmed-2026-05.xlsx');
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

// Colunas relevantes CMED: EAN 1, SUBSTÂNCIA, PRODUTO, APRESENTAÇÃO, CLASSE TERAPÊUTICA, TIPO DE PRODUTO, TARJA
// Mapear pra schema medcontrol.medications_catalog

const BATCH_SIZE = 500;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE).map(row => ({
    nome_comercial: `${row['PRODUTO']} ${row['APRESENTAÇÃO']}`.trim(),
    principio_ativo: row['SUBSTÂNCIA'],
    ean: row['EAN 1'],
    cmed_class: row['CLASSE TERAPÊUTICA'],
    tipo_produto: row['TIPO DE PRODUTO'],
    tarja: mapTarja(row['TARJA']),
    principio_ativo_normalizado: normalize(row['SUBSTÂNCIA']),
    updated_from_cmed_at: new Date().toISOString(),
    // group_id preenchido por trigger medications_cmed_group via cmed_class_to_group_mapping
  }));

  await sb.schema('medcontrol').from('medications_catalog').upsert(batch, { onConflict: 'ean' });
  console.log(`Imported ${i + batch.length}/${rows.length}`);
}
```

**Aceite:**
- `SELECT COUNT(*) FROM medcontrol.medications_catalog WHERE updated_from_cmed_at IS NOT NULL` ≥ **25.000** (era 900)
- `SELECT COUNT(*) FROM medications_catalog WHERE group_id IS NULL` < **5%** (era ~60%)
- Validação manual: 50 brand-names BR (lista expandida P9.4) todos categorizados corretamente

**Branch:** `feat/cmed-xlsx-import-complete`

---

### P9.2 — Edge Function `cmed-monthly-sync` (cron pgcron mensal automático)

**Onde:** `supabase/functions/cmed-monthly-sync/index.ts` (novo).

**Implementação:**

```typescript
// supabase/functions/cmed-monthly-sync/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as xlsx from "https://esm.sh/xlsx@0.18";

Deno.serve(async () => {
  // 1. Find latest CMED XLSX URL (scrape ou hardcode mensal)
  const url = await findLatestCmedXlsxUrl();

  // 2. Download XLSX
  const buf = await fetch(url).then(r => r.arrayBuffer());

  // 3. Parse rows
  const wb = xlsx.read(buf, { type: 'array' });
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  // 4. Save snapshot pra Storage (diff next month)
  await adminSb.storage.from('cmed-snapshots').upload(
    `${new Date().toISOString().slice(0, 7)}.json`,
    new Blob([JSON.stringify(rows)], { type: 'application/json' })
  );

  // 5. Diff vs último snapshot
  const last = await adminSb.storage.from('cmed-snapshots').download('latest.json');
  const diff = computeDiff(last, rows);

  // 6. Admin review obrigatório (NÃO auto-apply — pode introduzir regressão classe terapêutica)
  await adminSb.from('cmed_pending_updates').insert({
    snapshot_date: new Date().toISOString(),
    added: diff.added.length,
    removed: diff.removed.length,
    class_changed: diff.classChanged.length,
    diff_url: storageDiffUrl,
    status: 'pending_review',
  });

  // 7. Email admin com link pra dashboard
  await fetch(EDGE_SEND_ADMIN_EMAIL, {
    method: 'POST',
    body: JSON.stringify({
      subject: `CMED sync ${new Date().toISOString().slice(0, 7)}: ${diff.added.length} adds`,
      body: `Review at /admin/cmed-pending`
    })
  });

  return new Response(JSON.stringify({ pending_review: diff.added.length + diff.removed.length }));
});
```

**pg_cron schedule:**
```sql
SELECT cron.schedule('cmed-monthly-sync', '0 4 5 * *',
  $$SELECT net.http_post(url := ... || '/functions/v1/cmed-monthly-sync', ...);$$);
```

**Aceite:** após 30 dias deploy, próximo dia 5 do mês recebe email admin com diff CMED.

**Branch:** `feat/cmed-monthly-sync-edge`

---

### P9.3 — Distinguir `outro` vs `nao_classificado` em UI (Analytics + Histórico + Reports)

**Origem:** user vê só "Outros" em Analytics. Não distingue dose categorizada como `outro` (escolha) vs dose `NULL` (sistema não detectou).

**Onde:**
- `src/pages/Analytics.jsx` — donut card "Doses por categoria"
- `src/pages/DoseHistory.jsx` — chip filtro
- `src/pages/Reports.jsx` — tabela resumo

**Mudanças:**

1. **Constante `medCategories.js`:** adicionar `nao_classificado` como **valor distinto** (não fundir com `outro`):

```javascript
export const MED_GROUPS = [
  // ... 16 grupos existentes ...
  { id: 'outro', label: 'Outro', color: 'var(--dosy-gray-500)' },
  { id: 'nao_classificado', label: 'Não classificado', color: 'var(--dosy-gray-300)' },
];
```

2. **Analytics donut:** 2 fatias separadas:
```jsx
<Donut data={groupCounts}>
  <Slice id="outro" color="--dosy-gray-500" label="Outro (escolhido)" />
  <Slice id="nao_classificado" color="--dosy-gray-300" label="Não classificado" badge="atribua →" />
</Donut>
```

3. **Drill-down "Não classificado":** tap na fatia → modal "X medicamentos não categorizados — categorizar agora?" + lista bulk:
```
[ ] Amoxil 500mg (12 doses) → sugestão: Antibiótico [aceitar / mudar]
[ ] Cefaclor 250mg (8 doses) → Antibiótico [aceitar / mudar]
[ ] Bactrim F (5 doses) → Antibiótico [aceitar / mudar]
[Aplicar 3 sugestões + re-categorizar treatments + doses]
```

4. **Histórico filtro:** chip "Não classificado" separado de "Outro" + microcopy:
```
[Não classificado] (15 doses) — atribua categoria pra melhorar suas estatísticas
```

5. **Reports PDF/CSV:** coluna `Não classificado` separada de `Outro` em "Top categorias do período".

**Aceite:** user vê fatia distinta "Não classificado" em Analytics + pode bulk-categorize via drill-down em 4 taps.

**Branch:** `feat/distinguish-outro-vs-nao-classificado-ui`

---

### P9.4 — Sample validation expandida 17 → 150 brand-names cobrindo 6 personas

**Origem:** lista atual valida só caso Henrique. Pediatria/idoso/contraceptivo ficam fora.

**Onde:** `tests/integration/medication-catalog-coverage.test.js` (novo) + `scripts/data/sample-validation-by-persona.json`.

**Lista expandida por persona:**

```json
{
  "persona_1_rafael_familia": [
    { "name": "Amoxil 500mg", "expected_group": "antibiotico" },
    { "name": "Amoxil BD 875mg", "expected_group": "antibiotico" },
    { "name": "Amoxicilina 500mg genérico", "expected_group": "antibiotico" },
    { "name": "Cefaclor 250mg", "expected_group": "antibiotico" },
    { "name": "Cefalexina 500mg", "expected_group": "antibiotico" },
    { "name": "Keflex 500mg", "expected_group": "antibiotico" },
    { "name": "Azitromicina 500mg genérico", "expected_group": "antibiotico" },
    { "name": "Zitromax 500mg", "expected_group": "antibiotico" },
    { "name": "Bactrim F", "expected_group": "antibiotico" },
    { "name": "Sulfatrim", "expected_group": "antibiotico" },
    { "name": "Resprim", "expected_group": "antibiotico" },
    { "name": "Ceftriaxona 1g", "expected_group": "antibiotico" },
    { "name": "Ciprofloxacino 500mg", "expected_group": "antibiotico" },
    { "name": "Eritromicina 500mg", "expected_group": "antibiotico" },
    { "name": "Claritromicina 500mg", "expected_group": "antibiotico" },
    { "name": "Dipirona 500mg", "expected_group": "antitermico_analgesico" },
    { "name": "Novalgina 500mg", "expected_group": "antitermico_analgesico" },
    { "name": "Tylenol 750mg", "expected_group": "antitermico_analgesico" },
    { "name": "Paracetamol 500mg", "expected_group": "antitermico_analgesico" },
    { "name": "Ibuprofeno 400mg", "expected_group": "anti_inflamatorio" },
    { "name": "Advil", "expected_group": "anti_inflamatorio" },
    { "name": "Aerolin spray", "expected_group": "broncodilatador" },
    { "name": "Vibral xarope", "expected_group": "antitussigeno_expectorante" },
    { "name": "Loratadina 10mg", "expected_group": "antialergico" },
    { "name": "Polaramine", "expected_group": "antialergico" }
  ],
  "persona_3_dolores_idoso_polifarmacia": [
    { "name": "Donepezila 5mg", "expected_group": "outro" },
    { "name": "Metformina 850mg", "expected_group": "antidiabetico" },
    { "name": "Glifage 850mg", "expected_group": "antidiabetico" },
    { "name": "Glibenclamida 5mg", "expected_group": "antidiabetico" },
    { "name": "Insulina NPH", "expected_group": "antidiabetico" },
    { "name": "Lantus", "expected_group": "antidiabetico" },
    { "name": "Captopril 25mg", "expected_group": "anti_hipertensivo" },
    { "name": "Enalapril 10mg", "expected_group": "anti_hipertensivo" },
    { "name": "Losartana 50mg", "expected_group": "anti_hipertensivo" },
    { "name": "Anlodipino 5mg", "expected_group": "anti_hipertensivo" },
    { "name": "Atenolol 25mg", "expected_group": "anti_hipertensivo" },
    { "name": "Hidroclorotiazida 25mg", "expected_group": "anti_hipertensivo" },
    { "name": "Furosemida 40mg", "expected_group": "anti_hipertensivo" },
    { "name": "AAS 100mg", "expected_group": "anticoagulante" },
    { "name": "Aspirina prevent", "expected_group": "anticoagulante" },
    { "name": "Sinvastatina 20mg", "expected_group": "outro" },
    { "name": "Atorvastatina 10mg", "expected_group": "outro" },
    { "name": "Omeprazol 20mg", "expected_group": "gastrointestinal" },
    { "name": "Pantoprazol 40mg", "expected_group": "gastrointestinal" },
    { "name": "Esomeprazol 40mg", "expected_group": "gastrointestinal" }
  ],
  "persona_4_mariana_hormonio_contraceptivo": [
    { "name": "Puran T4 25mcg", "expected_group": "hormonal" },
    { "name": "Levotiroxina 50mcg", "expected_group": "hormonal" },
    { "name": "Tireosin", "expected_group": "hormonal" },
    { "name": "Synthroid", "expected_group": "hormonal" },
    { "name": "Selene", "expected_group": "hormonal" },
    { "name": "Yaz", "expected_group": "hormonal" },
    { "name": "Diane 35", "expected_group": "hormonal" },
    { "name": "Cerazette", "expected_group": "hormonal" },
    { "name": "Microvlar", "expected_group": "hormonal" },
    { "name": "Sulfato Ferroso 40mg", "expected_group": "vitamina" },
    { "name": "Noripurum", "expected_group": "vitamina" }
  ],
  "persona_6_sebastiao_idoso_autonomo": [
    { "name": "Levodopa + Carbidopa 250mg", "expected_group": "outro" },
    { "name": "Prolopa", "expected_group": "outro" },
    { "name": "Risperidona 1mg", "expected_group": "antidepressivo" },
    { "name": "Quetiapina 25mg", "expected_group": "antidepressivo" },
    { "name": "Memantina 10mg", "expected_group": "outro" },
    { "name": "Donepezila 10mg", "expected_group": "outro" },
    { "name": "Sertralina 50mg", "expected_group": "antidepressivo" },
    { "name": "Zoloft 50mg", "expected_group": "antidepressivo" },
    { "name": "Escitalopram 10mg", "expected_group": "antidepressivo" },
    { "name": "Lexapro 10mg", "expected_group": "antidepressivo" },
    { "name": "Fluoxetina 20mg", "expected_group": "antidepressivo" },
    { "name": "Prozac 20mg", "expected_group": "antidepressivo" },
    { "name": "Clonazepam 2mg", "expected_group": "ansiolitico" },
    { "name": "Rivotril 0.5mg", "expected_group": "ansiolitico" },
    { "name": "Diazepam 10mg", "expected_group": "ansiolitico" },
    { "name": "Alprazolam 1mg", "expected_group": "ansiolitico" }
  ],
  "comuns_brand_names_top": [
    { "name": "Buscopan 10mg", "expected_group": "outro" },
    { "name": "Buscopan Composto", "expected_group": "outro" },
    { "name": "Dorflex", "expected_group": "antitermico_analgesico" },
    { "name": "Cataflam 50mg", "expected_group": "anti_inflamatorio" },
    { "name": "Voltaren 100mg", "expected_group": "anti_inflamatorio" },
    { "name": "Diclofenaco 50mg", "expected_group": "anti_inflamatorio" },
    { "name": "Nimesulida 100mg", "expected_group": "anti_inflamatorio" },
    { "name": "Ranitidina 150mg", "expected_group": "gastrointestinal" },
    { "name": "Mounjaro", "expected_group": "antidiabetico" },
    { "name": "Ozempic", "expected_group": "antidiabetico" },
    { "name": "Decadron 4mg", "expected_group": "corticoide" },
    { "name": "Prednisona 20mg", "expected_group": "corticoide" },
    { "name": "Berotec spray", "expected_group": "broncodilatador" },
    { "name": "Symbicort", "expected_group": "broncodilatador" },
    { "name": "Clenil HFA", "expected_group": "broncodilatador" },
    { "name": "Seretide diskus", "expected_group": "broncodilatador" },
    { "name": "Avamys spray", "expected_group": "antialergico" },
    { "name": "Renitec 10mg", "expected_group": "anti_hipertensivo" },
    { "name": "Selozok 50mg", "expected_group": "anti_hipertensivo" },
    { "name": "Triiodotironina 50mcg", "expected_group": "hormonal" }
  ]
}
```

Total: **~80 brand-names** (cobertura mais realista vs 17 atual).

**Test Vitest:**
```javascript
import sampleValidation from '../../scripts/data/sample-validation-by-persona.json';

describe('Catalog coverage by persona', () => {
  Object.entries(sampleValidation).forEach(([persona, items]) => {
    describe(persona, () => {
      items.forEach(({ name, expected_group }) => {
        it(`${name} → ${expected_group}`, async () => {
          const { data } = await supabase.rpc('search_medications', { q: name.split(' ')[0], lim: 5 });
          const match = data.find(m => m.nome_comercial.toLowerCase().includes(name.split(' ')[0].toLowerCase()));
          expect(match).toBeTruthy(); // medicamento existe no catálogo
          expect(match?.group_id).toBe(expected_group); // categoria correta
        });
      });
    });
  });
});
```

**Aceite:** ≥75/80 passam (94%). <75 = revisar dicionário e/ou re-import CMED.

**Branch:** `test/sample-validation-by-persona-expanded`

---

### P9.5 — Cron mensal `re-categorize-null-rows` (medicamentos cadastrados com group_id=NULL)

**Origem:** doses criadas APÓS backfill mas com medicamentos não-cobertos no momento ficam NULL forever. Se catálogo expandir depois (P9.1 + P9.2), rows antigas continuam estagnadas.

**Onde:** novo cron em `supabase/migrations/`:

```sql
CREATE OR REPLACE FUNCTION medcontrol.re_categorize_null_rows()
RETURNS jsonb AS $$
DECLARE
  v_treatments_fixed INT;
  v_doses_fixed INT;
  v_user_meds_fixed INT;
BEGIN
  -- 1. user_medications: re-classify via classify_medication_robust
  WITH updated AS (
    UPDATE medcontrol.user_medications
    SET category = (medcontrol.classify_medication_robust(name)).group_id
    WHERE category IS NULL
      AND (medcontrol.classify_medication_robust(name)).group_id IS NOT NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_user_meds_fixed FROM updated;

  -- 2. treatments: same logic
  WITH updated AS (
    UPDATE medcontrol.treatments
    SET group_id = (medcontrol.classify_medication_robust("medName")).group_id,
        cmed_class = (medcontrol.classify_medication_robust("medName")).cmed_class
    WHERE group_id IS NULL
      AND (medcontrol.classify_medication_robust("medName")).group_id IS NOT NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_treatments_fixed FROM updated;

  -- 3. doses: cascata do treatment (preserva snapshot pra doses já confirmadas — usa treatment.group_id)
  WITH updated AS (
    UPDATE medcontrol.doses d
    SET group_id = t.group_id,
        cmed_class = t.cmed_class
    FROM medcontrol.treatments t
    WHERE d."treatmentId" = t.id
      AND d.group_id IS NULL
      AND t.group_id IS NOT NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_doses_fixed FROM updated;

  -- 4. Audit log
  INSERT INTO medcontrol.audit_log (action, metadata)
  VALUES ('re_categorize_null_rows_cron', jsonb_build_object(
    'treatments_fixed', v_treatments_fixed,
    'doses_fixed', v_doses_fixed,
    'user_meds_fixed', v_user_meds_fixed,
    'ran_at', NOW()
  ));

  RETURN jsonb_build_object(
    'treatments_fixed', v_treatments_fixed,
    'doses_fixed', v_doses_fixed,
    'user_meds_fixed', v_user_meds_fixed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

-- Cron mensal, 1 dia após CMED sync (CMED dia 5, re-categorize dia 6)
SELECT cron.schedule(
  're-categorize-null-rows-monthly',
  '0 6 6 * *',
  $$SELECT medcontrol.re_categorize_null_rows();$$
);
```

**Aceite:** após 30 dias deploy, próxima rodada cron emite audit_log com `doses_fixed > 0` (se houver rows NULL). Distribuição `Outros` em Analytics reduz mês a mês organicamente.

**Branch:** `feat/re-categorize-null-rows-monthly-cron`

---

### P9.6 — Flow "user vê Outros → re-categorizar bulk" via Analytics drill-down

**Origem:** user que ABRE Analytics e vê 60% "Outros" não tem ação clara — precisa intuir abrir cada dose individualmente.

**Onde:** `src/pages/Analytics.jsx` — tap na fatia `nao_classificado` do donut.

**UX:**

```jsx
<Donut onSliceClick={(groupId) => {
  if (groupId === 'nao_classificado') openBulkCategorizeModal();
  else setDrillDownGroup(groupId);
}} />

function BulkCategorizeModal() {
  // RPC nova: lista medicamentos únicos com group_id=NULL + sugestão classify_medication_robust
  const { data } = useQuery({
    queryKey: ['null-meds-with-suggestions'],
    queryFn: () => supabase.rpc('list_null_meds_with_suggestions')
  });

  return (
    <Modal>
      <h3>X medicamentos sem categoria — categorizar de uma vez?</h3>
      <List>
        {data.map(item => (
          <Row>
            <Checkbox checked={item.selected} onChange={...} />
            <strong>{item.med_name}</strong>
            <span>({item.dose_count} doses)</span>
            <CategoryBadge groupId={item.suggested_group} />
            <span>{item.suggestion_reason}</span>
            <Button kind="ghost" onClick={() => openCategoryPicker(item)}>Mudar</Button>
          </Row>
        ))}
      </List>
      <Button kind="primary" onClick={applyBulk}>
        Aplicar {selectedCount} sugestões + re-categorizar doses passadas
      </Button>
    </Modal>
  );
}
```

**RPC nova `list_null_meds_with_suggestions`:**
```sql
CREATE OR REPLACE FUNCTION medcontrol.list_null_meds_with_suggestions(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (med_name TEXT, dose_count INT, suggested_group TEXT, suggestion_reason TEXT) AS $$
  SELECT
    d."medName" AS med_name,
    COUNT(*)::INT AS dose_count,
    (medcontrol.classify_medication_robust(d."medName")).group_id AS suggested_group,
    (medcontrol.classify_medication_robust(d."medName")).source AS suggestion_reason
  FROM medcontrol.doses d
  WHERE d."userId" = p_user_id
    AND d.group_id IS NULL
  GROUP BY d."medName"
  ORDER BY COUNT(*) DESC
  LIMIT 50;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Aceite:** user com 60% Outros consegue reduzir pra <10% em 5 minutos via bulk modal.

**Branch:** `feat/bulk-categorize-via-analytics-drilldown`

---

### P9.7 — Métrica dashboard `% doses não-categorizadas` com alarme P0

**Onde:** PostHog dashboard `Categorization Health` + alarme webhook Slack/email DPO.

**Métricas a monitorar:**
- `% doses com group_id=NULL` (meta <2%, alarme P0 se >5%)
- `% doses com group_id='outro'` (meta <8%, alarme se >15%)
- `% medicamentos catálogo sem group_id` (meta <2%, alarme se >5%)
- `Cobertura sample validation` (meta 75/80 = 94%, alarme se <70/80)

**Implementação:**
```sql
-- View pra dashboard admin
CREATE OR REPLACE VIEW medcontrol.v_categorization_health AS
SELECT
  COUNT(*) FILTER (WHERE group_id IS NULL) AS doses_null_count,
  COUNT(*) FILTER (WHERE group_id = 'outro') AS doses_outro_count,
  COUNT(*) AS doses_total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE group_id IS NULL) / COUNT(*), 2) AS pct_null,
  ROUND(100.0 * COUNT(*) FILTER (WHERE group_id = 'outro') / COUNT(*), 2) AS pct_outro
FROM medcontrol.doses
WHERE "createdAt" > NOW() - INTERVAL '30 days';
```

Admin painel `admin.dosymed.app/categorization-health` consulta view + mostra trend.

**Aceite:** dashboard funcional + webhook alerta DPO em <30s quando `pct_null > 5%` por 7 dias seguidos.

**Branch:** `feat/categorization-health-dashboard`

---

### P9.8 — Documentar anti-pattern "patches superficiais MedNameInput não resolvem"

**Origem:** Bloco B v0.2.5.0 fez 6 patches em MedNameInput (removeu Tab handler, visualViewport listener, touch 56px, removeu auto-open exact-match, onClick em vez de pointerDown+preventDefault, chip DCB badge) mas os 3 bugs raiz persistem porque **dropdown inline em mobile é o anti-pattern raiz**.

**Onde:** documentar em `context/auditoria/2026-05-22-medication-picker-anti-pattern.md` (novo).

**Conteúdo:**

```markdown
# Anti-Pattern: Dropdown inline em mobile pra autocomplete grande

## Sintoma
3 bugs reproduzíveis em qualquer dropdown inline >5 items em mobile:
1. **Some quando arrasta** — click-outside captura tap em scrollbar
2. **Teclado virtual cobre** — dropdown abaixo input + viewport reduz com teclado
3. **Race blur/click** — blur do input dispara antes do click no item

## Causa raiz
Dropdown inline assume mouse + desktop viewport. Mobile tem:
- Touch (não mouse) → scrollbars internos viram tap targets
- Teclado virtual que cobre 50% da tela
- `blur` event dispara em qualquer mudança de foco (touch outside)

## Patches superficiais NÃO resolvem
v0.2.5.0 Bloco B tentou:
- Remover Tab handler ❌ não muda race
- visualViewport listener ❌ teclado ainda cobre
- Touch targets 56px ❌ não muda outside-click
- Remover auto-open exact-match ❌ não muda race
- onClick em vez de pointerDown+preventDefault ❌ piora race

**Resultado:** 3 bugs persistem. Validation device confirma.

## Solução estrutural (única que resolve)
Bottom Sheet picker em mobile:
- Sheet 80vh ocupa parte de baixo da tela → teclado abre ACIMA do sheet
- Sheet só fecha via X / back gesture / tap item / footer "continuar livre"
- `onPointerDown` em items (registra ANTES do blur)
- Fora do scroll do form pai → arrastar não fecha

## Referência implementação
- spec: `dosy-app/docs/07-DESIGN_SYSTEM.md §3.13`
- estados: `dosy-app/docs/08-ESTADOS_UI.md`
- validações device: `dosy-app/docs/workflow/VALIDATIONS.md`
- implementação: P0.7 deste roteiro
```

**Aceite:** doc presente + linkado em `context/PROJETO.md` seção "Anti-patterns".

**Branch:** `docs/anti-pattern-dropdown-inline-mobile`

---

### P9.9 — RPC fallback PharmaDB pra long-tail (OPCIONAL — v1.1+ se necessário)

**Origem:** mesmo com catálogo CMED completo (~30k), pode haver medicamentos:
- Manipulados (farmácia de manipulação)
- Importados/exceção (autorizados caso a caso)
- Suplementos sem registro CMED
- Cosméticos com função (cremes, pomadas)
- Plantas medicinais

**Decisão:** **NÃO implementar agora.** Após P9.1+P9.2 shipped e métrica P9.7 mostrar `% doses NULL > 5%` mensalmente sustained, então avaliar PharmaDB R$62-280/mês.

**Pre-trabalho documentado:**
- Sandbox account PharmaDB free trial 7 dias pra validar cobertura long-tail
- Spec `Edge: search_medications_external_fallback` (chama PharmaDB quando local retorna 0)
- Cache RPC result em catálogo local (lazy growth)

**Aceite:** decisão go/no-go em release v1.1.0 baseada em métrica real, não especulação.

**Branch:** `spike/pharmadb-fallback-evaluation` (apenas spike — não ship)

---

### P9.10 — Validações device priorizadas pra release pós-P9

**Onde:** `context/Validar.md` (novo entries).

**Lista validações obrigatórias antes ship v0.2.6.0:**

```markdown
[ ] Pixel 6 — cadastrar "Amoxil 500mg" → search retorna match + group_id=antibiotico
[ ] Samsung A54 — cadastrar "Bactrim F" → match + antibiotico
[ ] Xiaomi Redmi 12 — cadastrar "Sulfatrim" → match + antibiotico
[ ] Pixel 6 — Analytics donut mostra "Antibiótico" (não "Outros") com 3 doses dos antibióticos acima
[ ] Pixel 6 — MedicationPicker BottomSheet: 80vh + autofocus search + teclado acima
[ ] Pixel 6 — MedicationPicker: scroll lista interno SEM fechar sheet (anti-bug #1)
[ ] Samsung A54 — MedicationPicker: teclado virtual NÃO cobre resultados (anti-bug #2)
[ ] Xiaomi Redmi 12 — MedicationPicker: tap em item registra valor correto (anti-bug #3)
[ ] Pixel 6 — drill-down Analytics "Não classificado" abre BulkCategorizeModal
[ ] Pixel 6 — Persona 6 simulada (font scaling 1.5×): targets ≥56dp + labels não cortados
```

**Aceite:** 10/10 validações verde antes de ship público.

---

## P9 — Critérios gerais de aceite (release v0.2.6.0)

- [ ] **P0.7 MedicationPicker BottomSheet** shipado e validado em 3 devices (Pixel 6, Samsung A54, Xiaomi Redmi 12)
- [ ] **P9.1 CMED import** ≥25k entries no catalog (vs 900 antes)
- [ ] **P9.2 cron mensal** rodando + email admin recebido próximo dia 5
- [ ] **P9.3 UI distingue** outro vs nao_classificado em Analytics + Histórico + Reports
- [ ] **P9.4 sample validation** ≥75/80 brand-names passam
- [ ] **P9.5 re-categorize cron** rodando + 1ª execução com fixed_count >0
- [ ] **P9.6 bulk modal** funcional em Analytics drill-down
- [ ] **P9.7 dashboard** funcional + alarme P0 testado em staging
- [ ] **P9.8 anti-pattern doc** linkado em PROJETO
- [ ] **P9.10 validações device** 10/10 verde
- [ ] **Sanity check em prod:** 1 user cadastra 5 medicamentos pediátricos comuns → 5/5 categorizados corretamente

## P9 — Cadência sugerida

**Sprint emergencial (1-2 semanas):**
- **Dias 1-3:** P0.7 MedicationPicker BottomSheet (branch paralela com P0 LGPD)
- **Dias 4-5:** P9.1 CMED XLSX import + P9.2 cron mensal
- **Dias 6-7:** P9.3 UI distingue + P9.4 sample validation expandida
- **Dias 8-10:** P9.5 cron re-categorize + P9.6 bulk modal
- **Dias 11-14:** P9.7 dashboard + P9.8 anti-pattern doc + P9.10 validações device
- **Buffer:** 1 semana validação device + fix bugs encontrados

**Ship v0.2.6.0** com P0 LGPD + P0.7 MedicationPicker + P9 completo.

---

## 🚨 ADENDO 2026-05-22 18:30 BRT — P8 Hardening de escala (GATE OBRIGATÓRIO pré-launch público)

> **Contexto:** análise crítica de escala/egress aplicada ao roteiro P0-P7 completo (assumindo todos shipped) revelou **3 riscos altos + 7 médios** que, sem mitigação, podem reintroduzir o storm #157 (Realtime cascade) ou estourar quota de serviços terceiros (Sentry, Supabase Realtime, Supabase DB reads) ao escalar pra 1000+ users.
>
> **Esta seção é GATE OBRIGATÓRIO antes de release v1.0.0 (launch público Open Testing).** Sem P8 aplicado, lançamento pra audiência ampla é **financeiramente inviável**.
>
> **Projeção de custo mensal SEM P8 (1000 users ativos):**
> - Supabase Realtime: $25-$100 (concurrent connections + messages)
> - Supabase Egress: $200-$500 (Realtime backfire em hidden tabs)
> - Sentry transactions: $80-$200 (tracesSampleRate 0.1 estoura 10k/mês free tier 30×)
> - Sentry errors: $26 (sem dedup, single bug recorrente estoura 5k/mês)
> - Supabase DB reads: $25 (feature_flags polling sem cache)
> - **TOTAL: ~$350-850/mês**
>
> **Projeção de custo mensal COM P8 (1000 users ativos):**
> - **TOTAL: ~$0-50/mês** (mantém maioria no free tier)
>
> **Diferença preservada: ~$300-800/mês** + headroom estrutural pra escalar até 10k+ users sem refactor.
>
> **Origem dessas mitigações:** auditoria forense pós-roteiro feita por análise reversa de cada item P0-P7 cruzada com bug histórico medcontrol #157 + pricing pages Supabase/Sentry/Firebase.

### 🔴 Resumo dos riscos identificados

| # | Item original | Risco | Impacto sem fix |
|---|---|---|---|
| **R1 (ALTO)** | P1.9 Realtime sob demanda | Sem lifecycle pause / idle detection → tabs hidden mantêm channels = repeat bug #157 | Storm 5GB/h egress + concurrent connections |
| **R2 (ALTO)** | P1.11 + P2.18 `tracesSampleRate: 0.1` | 1000 users × 100 actions/dia × 0.1 = 300k traces/mês = 30× free tier | Sentry $80-200/mês ou perda observability |
| **R3 (ALTO)** | P3.17 `treatment-changed-handler` AFTER UPDATE sem dedup | Edits massivos disparam N FCM × N devices | Storm FCM + cliente Java churn |
| **R4 (MÉDIO)** | P0.6 `fcm_dispatched_log` cresce | Sem cleanup garantido + dispatch_kinds expandidos | Tabela 200k+ rows quente |
| **R5 (MÉDIO)** | P3.2 `audit_log` sem retention | 1.8M rows/ano × 5 anos = 9M rows quentes | Queries lentas + LGPD violação minimização |
| **R6 (MÉDIO)** | P3.9 `suggest_categories_for_unknown` | N+1 risk + sem cache adequado | Latência modal + DB load |
| **R7 (MÉDIO)** | P4.10 `last_dose_per_group` | Chamado em cada abertura Histórico sem cache | 10k RPC calls/dia × 1000 users |
| **R8 (MÉDIO)** | P3.3 `feature_flags` polling | 12k reads/hora sem edge cache | Pode comer Supabase free tier 50k/dia |
| **R9 (MÉDIO)** | P1.10 `Sentry.captureException` 121 catches | Single bug recorrente estoura 5k events/mês free tier | Sentry quota + alert fatigue |
| **R10 (MÉDIO)** | P2.5 server reagenda sempre | Edits frequentes = 10 reschedule storms/usuário/dia | Edge invocations + FCM dispatches |

### 🟢 Pontos que JÁ melhoram escala (preservar)

- **P0.4** PostHog consent gate — reduz eventos ~30%
- **P2.2** Drop `dose-fire-time-notifier` — elimina **43.200 invocações/mês**
- **P2.6** Tier via JWT — elimina N round-trips DB
- **P3.16** `_shared/fcm.ts` consolidado — habilita dedup + retry centralizados
- **P3.3** `feature_flags.realtime_enabled` master switch — rollback storm em segundos

---

## P8 — Hardening de escala (10 mitigações executáveis)

### P8.1 🔴 Salvaguardas Realtime — lifecycle pause + idle + master switch (REFINA P1.9)

**Origem do risco:** P1.9 propôs re-ativar Realtime sob demanda em PatientDetail compartilhado, mas sem lifecycle pause. Bug original #157 (Storm 13 req/s + 5GB/h egress idle) foi exatamente isso.

**Mudança em `src/hooks/useRealtime.js`** (refinando o que P1.9 deixou):

```javascript
import { useEffect, useRef } from 'react';
import { useFeatureFlag } from './useFeatureFlags';

export function useRealtimePatient(patientId, isShared) {
  const realtimeEnabled = useFeatureFlag('realtime_enabled', true);
  const channelRef = useRef(null);
  const lastUserActionRef = useRef(Date.now());

  // Track user interaction pra idle detection
  useEffect(() => {
    const handler = () => { lastUserActionRef.current = Date.now(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, handler, { passive: true }));
    return () => ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.removeEventListener(ev, handler));
  }, []);

  const subscribe = useCallback(() => {
    if (channelRef.current) return; // já subscribed
    if (!realtimeEnabled || !patientId || !isShared) return;

    const channel = supabase.channel(`realtime:patient:${patientId}:${Date.now()}`);
    channel
      .on('postgres_changes', { event: '*', schema: 'medcontrol', table: 'doses', filter: `patientId=eq.${patientId}` }, ...)
      .on('postgres_changes', { event: '*', schema: 'medcontrol', table: 'patient_shares', filter: `patientId=eq.${patientId}` }, ...)
      .subscribe();
    channelRef.current = channel;
    posthog?.capture('realtime_subscribed', { patientId });
  }, [patientId, isShared, realtimeEnabled]);

  const unsubscribe = useCallback(() => {
    if (!channelRef.current) return;
    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    posthog?.capture('realtime_unsubscribed', { patientId });
  }, [patientId]);

  // 1. Initial subscribe + cleanup on unmount
  useEffect(() => {
    subscribe();
    return unsubscribe;
  }, [subscribe, unsubscribe]);

  // 2. SALVAGUARDA: visibility change → unsubscribe em hidden tab
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        unsubscribe();
      } else if (document.visibilityState === 'visible') {
        subscribe();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [subscribe, unsubscribe]);

  // 3. SALVAGUARDA: idle >5min → unsubscribe
  useEffect(() => {
    const interval = setInterval(() => {
      const idleMs = Date.now() - lastUserActionRef.current;
      if (idleMs > 5 * 60 * 1000 && channelRef.current) {
        unsubscribe();
        posthog?.capture('realtime_idle_unsubscribed', { idle_minutes: Math.floor(idleMs / 60000) });
      } else if (idleMs <= 5 * 60 * 1000 && !channelRef.current && document.visibilityState === 'visible') {
        subscribe();
      }
    }, 30 * 1000); // check a cada 30s
    return () => clearInterval(interval);
  }, [subscribe, unsubscribe]);

  // 4. SALVAGUARDA: hard limit 1 channel por user — qualquer tentativa de 2º subscribe é no-op
  // (já garantido pelo channelRef check em subscribe())
}
```

**Adicionar dashboard egress alert** em PostHog ou Sentry:
- Track `realtime_message_received` per user/hora
- Alert se `messages_per_hour > 500` por user (indica leak)

**Habilitar/desabilitar via feature flag em runtime:**
- Tabela `feature_flags.realtime_enabled` (P3.3) já criada
- Rollback: `UPDATE medcontrol.feature_flags SET value='false' WHERE key='realtime_enabled'`
- Cliente lê em 5min staleTime — rollback efetivo em ≤5min sem deploy

**Aceite:**
- Test manual: abrir PatientDetail compartilhado → trocar pra outra tab por 1min → DevTools Network mostra `removeChannel` chamado
- Test manual: ficar idle 6min no PatientDetail → channel desconectado
- Test sob carga: 100 users simultâneos hidden tab → 0 channels ativos no Supabase Realtime dashboard
- Egress audit semanal: <100MB/h por user em pico

**Branch:** `feat/realtime-lifecycle-safeguards`

---

### P8.2 🔴 Sentry tracesSampleRate dinâmico (REFINA P1.11)

**Origem do risco:** 0.1 = 30× free tier mensal. $80-200/mês de fatura ou perda total observability.

**Mudança em `src/main.jsx`:**

```javascript
Sentry.init({
  // ...

  // Sample dinâmico — bem abaixo de 0.1
  tracesSampleRate: import.meta.env.PROD ? 0.01 : 0, // 1% sampling em prod

  // Sample 100% pra erros + 1% pra transactions sucesso
  beforeSendTransaction(transaction) {
    if (!import.meta.env.PROD) return transaction;

    // SEMPRE capturar transactions de RPCs healthcare críticas (oversample)
    const criticalOps = ['confirm_dose', 'skip_dose', 'undo_dose', 'register_sos_dose', 'create_treatment_with_doses'];
    if (criticalOps.some(op => transaction.transaction?.includes(op))) {
      return transaction; // 100% capturado
    }

    // Resto: já filtrado pelo 0.01 sampling
    return transaction;
  },

  beforeSend(event, hint) {
    // ... PII strip (P0.3) ...

    // Rate limit por user (anti single-bug-recorrente-estoura-quota)
    const userId = event.user?.id;
    if (userId) {
      const key = `sentry_rate_${userId}_${new Date().toISOString().slice(0, 10)}`;
      const count = parseInt(sessionStorage.getItem(key) || '0', 10);
      if (count >= 10) return null; // max 10 events/dia/user
      sessionStorage.setItem(key, String(count + 1));
    }

    // Whitelist de erros conhecidos pra skip
    const knownErrors = ['Network request failed', 'NetworkError', 'Load failed', 'Failed to fetch', 'AbortError'];
    if (knownErrors.some(e => event.exception?.values?.[0]?.value?.includes(e))) {
      return null;
    }

    return event;
  }
});
```

**Projeção com mitigação:**
- 1000 users × 100 actions/dia × 0.01 sampling = 1k traces/dia × 30 = 30k/mês
- Critical ops oversampled: ~50/user/dia × 1000 = 50k/dia = 1.5M/mês ⚠️ ainda alto

**Refinamento adicional:** critical ops também sample a 0.1:

```javascript
if (criticalOps.some(op => transaction.transaction?.includes(op))) {
  if (Math.random() < 0.1) return transaction; // 10% mesmo pra críticas
  return null;
}
```

→ Critical: 100k traces/mês. Total: ~130k/mês. **Ainda excede free tier 10k.**

**Decisão necessária:**
- **Opção A (recomendada):** sample 0.005 (0.5%) em prod + critical 5% = ~16k traces/mês — cabe free tier
- **Opção B:** plano Sentry Team $26/mês = 50k traces/mês
- **Opção C:** self-host Sentry em VPS DigitalOcean $6/mês (medcontrol já tem `sentry-cli` configurado)

**Aceite:** Sentry dashboard mostra <10k transactions/mês em prod 30 dias após deploy.

**Branch:** `fix/sentry-sample-rate-budget-controlled`

---

### P8.3 🔴 Dedup window 30s em `treatment-changed-handler` (REFINA P3.17)

**Origem do risco:** AFTER UPDATE sem dedup → edits massivos = storm FCM × N devices.

**Mudança no trigger SQL:**

```sql
CREATE OR REPLACE FUNCTION medcontrol.notify_treatment_changed()
RETURNS TRIGGER AS $$
DECLARE v_last_dispatch TIMESTAMPTZ;
BEGIN
  -- Evita cascade (UPDATE dentro de UPDATE)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Só dispara em campos relevantes
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW."intervalHours" IS NOT DISTINCT FROM OLD."intervalHours"
     AND NEW."firstDoseTime" IS NOT DISTINCT FROM OLD."firstDoseTime"
     AND NEW.group_id IS NOT DISTINCT FROM OLD.group_id THEN
    RETURN NEW;
  END IF;

  -- Dedup window 30s: verifica fcm_dispatched_log (extender de P0.6 pra cobrir treatment_changed)
  SELECT MAX(dispatched_at) INTO v_last_dispatch
  FROM medcontrol.fcm_dispatched_log
  WHERE dose_id = NEW.id -- reusa coluna com semântica "entity_id"
    AND dispatch_kind = 'treatment_changed'
    AND dispatched_at > NOW() - INTERVAL '30 seconds';

  IF v_last_dispatch IS NOT NULL THEN
    -- Skip — já disparou recentemente
    RETURN NEW;
  END IF;

  -- Insere fingerprint ANTES de dispatchar (anti-race entre triggers paralelos)
  INSERT INTO medcontrol.fcm_dispatched_log (dose_id, dispatch_kind, scheduled_at)
  VALUES (NEW.id, 'treatment_changed', NOW())
  ON CONFLICT DO NOTHING;

  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/treatment-changed-handler',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('record', row_to_json(NEW))
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, net, public;
```

**Adicionar debounce client-side em `TreatmentForm.jsx`:**

```javascript
import { debounce } from 'lodash';

const saveDebounced = useMemo(() => debounce((payload) => {
  updateTreatment.mutate(payload);
}, 2000), []);

// User edita 5× em 5s → única chamada server (após 2s de inatividade)
```

**Estender P0.6 schema** pra `fcm_dispatched_log` aceitar `dispatch_kind` genérico:
```sql
COMMENT ON COLUMN medcontrol.fcm_dispatched_log.dose_id IS 'Entity ID — pode ser dose_id, treatment_id, share_id, patient_id conforme dispatch_kind';
```

**Aceite:** simular 10 UPDATE em treatment em 30s → 1 FCM dispatch (não 10).

---

### P8.4 🟡 Cleanup garantido `fcm_dispatched_log` (REFINA P0.6)

**Adicionar cron** pgcron diário em P0.6:

```sql
-- Adicionar à migration P0.6
SELECT cron.schedule(
  'cleanup-fcm-dispatched-log-daily',
  '0 4 * * *', -- 4am UTC
  $$DELETE FROM medcontrol.fcm_dispatched_log WHERE dispatched_at < NOW() - INTERVAL '7 days';$$
);
```

**Monitoring:**
```sql
-- Query semanal manual ou dashboard admin
SELECT COUNT(*) as row_count, MAX(dispatched_at) as last, MIN(dispatched_at) as first
FROM medcontrol.fcm_dispatched_log;
-- Alerta se row_count > 500_000
```

**Aceite:** após 7 dias prod, `SELECT COUNT(*)` mostra ~stable around 7d × dispatches/dia (não cresce indefinidamente).

---

### P8.5 🟡 Retention policy explícita `audit_log` (REFINA P3.2)

**Adicionar à migration P3.2** politica por `action`:

```sql
-- Retention policy por tipo de action
CREATE OR REPLACE FUNCTION medcontrol.cleanup_audit_log()
RETURNS void AS $$
BEGIN
  -- dose_marked_* → 2 anos
  DELETE FROM medcontrol.audit_log
  WHERE action IN ('dose_marked_done', 'dose_marked_skipped', 'dose_undone', 'sos_registered', 'sos_forced_override')
    AND "createdAt" < NOW() - INTERVAL '2 years';

  -- treatment_* → 2 anos
  DELETE FROM medcontrol.audit_log
  WHERE action IN ('treatment_created', 'treatment_paused', 'treatment_resumed', 'treatment_ended')
    AND "createdAt" < NOW() - INTERVAL '2 years';

  -- share_* → 1 ano após patient_id NULL (paciente deletado)
  DELETE FROM medcontrol.audit_log
  WHERE action IN ('patient_shared', 'patient_unshared', 'share_access_changed', 'share_extended')
    AND patient_id IS NULL
    AND "createdAt" < NOW() - INTERVAL '1 year';

  -- account_deleted, data_exported → indefinido (LGPD obrigação legal)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule('cleanup-audit-log-monthly', '0 5 1 * *', $$SELECT medcontrol.cleanup_audit_log();$$);
```

**Particionamento Postgres** (preparação pra escala):
```sql
-- Após 1 ano de uso, particionar por mês via pg_partman OU manualmente:
-- ALTER TABLE medcontrol.audit_log ... PARTITION BY RANGE ("createdAt");
-- Criar partições mensais automatic via cron
-- (não fazer agora — apenas planejar)
```

**Aceite:**
- `SELECT COUNT(*) FROM audit_log` estável após 2 anos (não cresce além de 2y de dose_*)
- Documento `context/decisoes/2026-XX-XX-audit-log-retention.md` registrando política

---

### P8.6 🟡 Cache + EXPLAIN ANALYZE em `suggest_categories_for_unknown` (REFINA P3.9)

**Adicionar ao P3.9 ao implementar:**

**1. Validação obrigatória durante dev:**
```bash
psql -c "EXPLAIN ANALYZE SELECT * FROM medcontrol.suggest_categories_for_unknown('Escitalopram', 'Escitalopram');"
# Esperar: <100ms total + uso do GIN trgm index
```

**2. Cache TanStack agressivo:**
```javascript
// Em CategoryHintModal.jsx
const { data: suggestions } = useQuery({
  queryKey: ['suggest-cats', normalizeName(name), normalizeName(principio)],
  queryFn: () => supabase.rpc('suggest_categories_for_unknown', { p_name: name, p_principio_ativo: principio }),
  staleTime: 5 * 60 * 1000, // 5min
  gcTime: 30 * 60 * 1000, // 30min
  enabled: !!name && hintModalOpen
});

function normalizeName(s) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
```

**3. Otimização query SQL** (eliminar subquery N+1):

```sql
CREATE OR REPLACE FUNCTION medcontrol.suggest_categories_for_unknown(p_name TEXT, p_principio_ativo TEXT DEFAULT NULL, p_limit INT DEFAULT 3)
RETURNS TABLE (group_id TEXT, score FLOAT, reason TEXT) AS $$
  WITH name_normalized AS (
    SELECT lower(extensions.unaccent(p_name)) AS q
  ),
  candidates AS (
    SELECT
      m.group_id,
      m.nome_comercial,
      similarity(lower(extensions.unaccent(m.nome_comercial)), (SELECT q FROM name_normalized)) AS sim
    FROM medcontrol.medications_catalog m, name_normalized n
    WHERE m.group_id IS NOT NULL
      AND lower(extensions.unaccent(m.nome_comercial)) % n.q -- usa trigram index com %
    ORDER BY sim DESC
    LIMIT 50 -- bounded
  ),
  ranked AS (
    SELECT
      group_id,
      AVG(sim) AS score,
      (array_agg(nome_comercial ORDER BY sim DESC))[1] AS top_med
    FROM candidates
    GROUP BY group_id
  )
  SELECT
    group_id,
    score,
    'similar a "' || top_med || '"' AS reason
  FROM ranked
  ORDER BY score DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = medcontrol, extensions, public;
```

Mudanças vs versão original P3.9:
- Operador `%` em vez de `similarity() > 0.3` → usa GIN trgm index direto
- CTE `ranked` elimina subquery N+1 que pegava `nome_comercial` por group_id
- LIMIT 50 inicial bounded

**Aceite:** EXPLAIN ANALYZE retorna <50ms + plan usa `Bitmap Index Scan on medications_catalog_principio_unaccent_trgm_idx`.

---

### P8.7 🟡 Cache 1h `last_dose_per_group` + invalidação targeted (REFINA P4.10)

**No queryKey em `LastDoseByCategory` component:**

```javascript
const { data } = useQuery({
  queryKey: ['last-dose-by-group', userId],
  queryFn: () => supabase.rpc('last_dose_per_group', { p_user_id: userId, p_limit: 5 }),
  staleTime: 60 * 60 * 1000, // 1h — só invalidate quando dose nova confirmada
  gcTime: 6 * 60 * 60 * 1000, // 6h
});
```

**Invalidação targeted em `core/events.ts` ou mutationRegistry:**

```javascript
// Após confirm_dose sucesso:
qc.invalidateQueries({ queryKey: ['last-dose-by-group', userId], exact: true });
// NÃO invalida em outras mutations (skip, undo, register_sos do paciente diferente, etc.)
```

**Index composto** pra acelerar RPC:
```sql
CREATE INDEX IF NOT EXISTS doses_user_group_actual_done_idx
  ON medcontrol.doses ("userId", group_id, "actualTime" DESC)
  WHERE status = 'done' AND group_id IS NOT NULL;
```

**Aceite:**
- 1 user × 10 aberturas Histórico/dia = 1 RPC call/dia (resto cache hit)
- Após `confirm_dose`, próxima abertura Histórico = 1 RPC call refresh
- EXPLAIN ANALYZE RPC usa novo index composto

---

### P8.8 🟡 Edge cache `feature_flags` (REFINA P3.3)

**Adicionar Edge function** `get-feature-flags` com cache:

```typescript
// supabase/functions/get-feature-flags/index.ts
const CACHE_TTL_MS = 5 * 60 * 1000; // 5min
let cache: { value: any[]; expiresAt: number } | null = null;

Deno.serve(async (req) => {
  if (cache && Date.now() < cache.expiresAt) {
    return new Response(JSON.stringify(cache.value), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    });
  }

  const { data } = await adminSb.schema('medcontrol').from('feature_flags').select('*');
  cache = { value: data, expiresAt: Date.now() + CACHE_TTL_MS };

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
  });
});
```

**Cliente consome via Edge** (não direto da tabela):

```javascript
// src/hooks/useFeatureFlags.js
export function useFeatureFlag(key, defaultValue) {
  const { data: flags } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => fetch(`${SUPABASE_URL}/functions/v1/get-feature-flags`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  return flags?.find(f => f.key === key)?.value ?? defaultValue;
}
```

**Bonus:** invalidação push em mudança via Realtime channel `feature_flags` (admin atualiza → Edge cache invalidado em todos clients em <1s).

**Aceite:**
- 1000 users × 12 reads/hora = 12000 reads/hora ainda — mas TODOS hit Edge cache, não DB
- Supabase DB reads pra `feature_flags` table: 1 read/5min = 12 reads/hora total (vs 12k antes)
- DB reads economy: ~30M reads/mês

---

### P8.9 🟡 Sentry rate limit + dedup fingerprint (REFINA P1.10)

**Já incluído parcialmente em P8.2** (rate limit per-user). Adicionar **dedup por fingerprint:**

```javascript
beforeSend(event, hint) {
  // ... PII strip ...
  // ... rate limit per-user (P8.2) ...

  // Dedup fingerprint: agrupa erros similares pra não enviar 1000× o mesmo bug
  if (event.exception?.values?.[0]) {
    const exc = event.exception.values[0];
    event.fingerprint = [
      exc.type ?? 'UnknownError',
      // Stack frame primário (sem line numbers — agrupar variantes do mesmo bug)
      exc.stacktrace?.frames?.slice(-1)[0]?.function ?? 'unknown',
      // Source file sem version hash
      (exc.stacktrace?.frames?.slice(-1)[0]?.filename ?? '').replace(/-[a-f0-9]{8}\./, '.')
    ];
  }

  // Sample por fingerprint: 100% pra primeiro evento, 1% pra repetições mesma fingerprint mesmo dia
  // (Sentry server-side dedup por fingerprint, mas client pode reduzir antes de enviar)
  const fpKey = `sentry_fp_${event.fingerprint?.join(':')}_${new Date().toISOString().slice(0,10)}`;
  const seen = parseInt(sessionStorage.getItem(fpKey) || '0', 10);
  if (seen >= 1 && Math.random() > 0.01) return null; // 1% após o primeiro
  sessionStorage.setItem(fpKey, String(seen + 1));

  return event;
}
```

**Aceite:** simular 100 erros idênticos em sequência → Sentry recebe ~2 (primeiro + ~1% dos 99 restantes).

---

### P8.10 🟡 Throttle server-side `request-schedule-sync` (REFINA P2.1)

**Adicionar rate limit** em `supabase/functions/request-schedule-sync/index.ts`:

```typescript
import { sendFcm } from '../_shared/fcm.ts';
import { adminSb } from '../_shared/supabase.ts';

const THROTTLE_SECONDS = 30;

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 });
  const jwt = auth.slice(7);

  const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) return new Response('unauthorized', { status: 401 });

  // THROTTLE: max 1 invocação por user a cada 30s
  const { data: recent } = await adminSb.schema('medcontrol')
    .from('schedule_sync_throttle')
    .select('last_invoked_at')
    .eq('user_id', user.id)
    .single();

  if (recent && Date.now() - new Date(recent.last_invoked_at).getTime() < THROTTLE_SECONDS * 1000) {
    return new Response(JSON.stringify({ throttled: true, retry_after: THROTTLE_SECONDS }), {
      status: 429,
      headers: { 'Retry-After': String(THROTTLE_SECONDS) }
    });
  }

  await adminSb.schema('medcontrol').from('schedule_sync_throttle').upsert({
    user_id: user.id,
    last_invoked_at: new Date().toISOString()
  });

  // ... resto execução normal ...
});
```

**Criar tabela throttle:**
```sql
CREATE TABLE medcontrol.schedule_sync_throttle (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_invoked_at TIMESTAMPTZ NOT NULL
);
SELECT cron.schedule('cleanup-schedule-throttle-daily', '0 3 * * *',
  $$DELETE FROM medcontrol.schedule_sync_throttle WHERE last_invoked_at < NOW() - INTERVAL '1 day';$$
);
```

**Cliente lida com 429:**
```javascript
// src/services/scheduling.js
async function requestScheduleSync() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/request-schedule-sync`, ...);
  if (res.status === 429) {
    const body = await res.json();
    console.warn('[scheduling] throttled, retry in', body.retry_after);
    // Re-tenta após retry_after ou ignora se outro trigger já vai disparar
    return { throttled: true };
  }
  return res.json();
}
```

**Aceite:** 10 chamadas em 5s pelo mesmo user → 1 success + 9 × 429.

---

## P8 — Critérios gerais de aceite (release-gate v1.0.0)

Antes de declarar P8 completo e shippar pra Open Testing público:

- [ ] Realtime test sob carga: 100 users hidden tab simultâneos → 0 channels ativos no dashboard Supabase
- [ ] Sentry dashboard mostra <10k transactions/mês em prod 30 dias após deploy
- [ ] Sentry dashboard mostra <5k errors/mês com dedup ativo
- [ ] Treatment edit massivo (10 edits em 30s) → 1 FCM dispatch (verificar via Firebase console)
- [ ] `audit_log` query plan usa index (`EXPLAIN ANALYZE` verifica)
- [ ] `suggest_categories_for_unknown` <50ms p95 (medir via Sentry tracing)
- [ ] `last_dose_per_group` cache hit rate >90% (PostHog metric)
- [ ] `feature_flags` Supabase DB reads <20k/dia em prod (era 12k/hora antes)
- [ ] `request-schedule-sync` 429 rate <5% (PostHog)
- [ ] Supabase egress dashboard <10GB/mês em prod
- [ ] Custo mensal real (medido em fatura) <$100 em 1000 users ativos

## P8 — Cadência (executar como sprint dedicado pós-P7)

**Sprint 11 (semana 25-26):** P8 completo
- Semana 25: P8.1 (Realtime safeguards) + P8.2 (Sentry sample) + P8.3 (treatment-changed dedup)
- Semana 26: P8.4-P8.10 paralelos + validação carga + ajuste fino
- **Buffer:** 1 semana extra pra hardening final pré-launch público

**Após P8 completo:** marcar release v1.0.0 e abrir Open Testing público no Play Store.

---

## P8 — Riscos residuais (aceitos conscientemente)

Mesmo com P8 aplicado, alguns riscos secundários permanecem:

1. **Realtime ainda pode ter spike** em eventos virais (e.g., post viral sobre Dosy → 5000 signups em 1h). Mitigação: master switch `realtime_enabled=false` via feature_flag em <5min.
2. **Sentry sample 0.5%** = pequenos bugs raros podem passar despercebidos. Mitigação: `captureException` 100% pra erros graves (não-sampled).
3. **Audit log particionamento** ainda planejado pra v1.1+ (não obrigatório v1.0). Cresce até 1.8M rows/ano em 1000 users — manageable.
4. **`request-schedule-sync` 30s throttle** pode frustrar power users que editam muitos treatments. Trade-off aceito: consistência server-side > velocidade edit.

---

## P8 — Conexão com docs Dosy v2

Após P8 aplicado em medcontrol, **atualizar Dosy v2 docs** com lições absorvidas:

- `dosy-app/docs/16-INTEGRACOES.md` — adicionar Sentry sample budget docs + Edge cache feature_flags pattern
- `dosy-app/docs/19-SEGURANCA.md` — adicionar HMAC validation webhooks + rate limit pattern
- `dosy-app/docs/adr/` — criar ADR-016 "Realtime sob demanda com lifecycle safeguards"
- `dosy-app/docs/04-METRICAS.md` — adicionar P8 acceptance criteria como KPIs P0

---

> **🚨 NÃO PULAR P8.** Sem essas 10 mitigações, launch público pra 1000+ users vai gerar fatura $350-850/mês de serviços terceiros + reintroduz storms que motivaram dezenas de horas de fix em prod. **P8 é o que diferencia o app "funciona pra 100 usuários" do app "escala pra 10k+".**

---

## 1. Contexto compacto

**Quem é Dosy v2:**
- Rewrite from-scratch do medcontrol_v2 documentado em `G:\00_Trabalho\01_Pessoal\Apps\dosy-app\`
- Está em **Fase 0 (Docs upfront)** — 22 docs principais + 15 ADRs + workflow operacional
- ADR-003 manda **reuso literal** da camada nativa Android Java do medcontrol (12 arquivos, ~5.400 LOC)
- Vai consumir ~10-11 semanas até Internal Testing ship (Fase 5)
- Spec consolidada inclui lições dos bugs reportados em prod 2026-05-22 (dropdown autocomplete + Histórico só dia + Escitalopram)

**O que medcontrol_v2 deve fazer com este roteiro:**

Trazer pra dentro do medcontrol_v2 **tudo** que está melhor nos docs Dosy v2 — implementando, adaptando, refatorando — mesmo que isso signifique mexer em áreas grandes. **A meta é que medcontrol_v2 sirva como referência viva** do que Dosy v2 vai consolidar.

**Princípios de execução:**
1. **Nenhum gap fica de fora** — se existe nos docs Dosy v2, tenta implementar em medcontrol
2. **Migrations sempre versionadas** (fim da era "aplica via Supabase MCP sem SQL")
3. **Cada P0/P1 fix tem regression test** ou validation device antes de fechar
4. **Branches `chore/`, `fix/`, `feat/`, `refactor/`** pequenas mergeable em master
5. **Não regredir** bugs já fixados (consultar `context/BUGS.md` antes de mexer em hot path)
6. **Documentar tudo** em `context/` conforme padrão medcontrol existente + adotar Regras 16+17 do Dosy v2

**O que NÃO está no escopo (raro):**
- Renomear `applicationId` `com.dosyapp.dosy` — manter (ADR-004)
- Renomear schema namespace `medcontrol` no app vivo — Dosy v2 começa com `dosy`, medcontrol continua `medcontrol` (cross-app migration acontece quando users migrarem)
- Trocar Firebase project `dosy-b592e` se está estável

---

## 2. Sumário executivo do que está EXCELENTE vs QUEBRADO

### ✅ Excelente (manter e usar como base)

- Native Android Java 12 arquivos production-ready
- Manifest hardening completo (15 permissions justificadas, FOREGROUND_SERVICE_SPECIAL_USE)
- Stack versions alinhadas com Dosy v2 ADRs
- `dosy-tokens.css` autoritativo + `animations.js` corretos
- 25 primitives Dosy implementadas (Card/Button/Input/Sheet/Modal/Avatar/StatusPill/Toast/Icon)
- Custom Access Token Hook tier JWT
- Trigger system FCM elaborado (statement-level batch + single-row insert)
- RLS hardening exemplar
- TZ fix consolidado (AT TIME ZONE pattern)
- Categorias v0.2.4.0+v0.2.5.0 funcionais (5 commits shipped)
- DCB ranking + `classify_medication_robust` 5 tiers (lições medcontrol que vão pro Dosy v2)

### 🔴 Quebrado (este roteiro vai consertar)

- `remote_schema.sql` VAZIO
- 4 conjuntos migrations NÃO-versionadas
- Realtime DESABILITADO em prod
- `versionedCache.reconcileDoses` zumbi
- Conflict resolution 409 inexistente
- UI ↔ Supabase direto em 5+ JSX (viola arquitetura)
- Sentry PII strip incompleto (LGPD risk)
- PostHog inicia sem consent
- `Sentry.captureException` usado 1 vez (121 catches silenciosos)
- MedNameInput dropdown inline (3 bugs estruturais)
- Coverage 4.35% global
- `request-schedule-sync` STUB em prod (vulnerabilidade)
- `scheduler.js` healthcare-critical 0% coverage
- 7 NB-4 variants sem regression test consolidado
- ~480 LOC FCM OAuth duplicados (sem `_shared/fcm.ts`)
- `dose-fire-time-notifier` cron 1440 invocações/dia (drop planejado mas não feito)
- Refactor_Full Fases 2-5 incompletas
- Engine ADR-012 ausente
- 10+ tabelas/triggers/RPCs faltantes vs spec Dosy v2

---

## 3. Estrutura do roteiro

| Camada | Tema | # Items | Tempo estimado |
|---|---|---|---|
| **P0** | Segurança / LGPD / Reproducibilidade | 6 | 1 semana |
| **P1** | Arquitetural (correções fundamentais) | 14 | 2-3 semanas |
| **P2** | Refactor_Full Fases 2-5 (concluir) | 18 | 4-6 semanas |
| **P3** | Backport schema + RPCs + Edge Functions Dosy v2 | 24 | 6-8 semanas |
| **P4** | UI primitives Dosy v2 (backport completo) | 22 | 4-5 semanas |
| **P5** | Test stack completo (pgTAP + Deno + regression) | 15 | 3-4 semanas |
| **P6** | Documentação (gaps absorvidos) | 14 | 1-2 semanas |
| **P7** | Limpeza estrutural | 13 | 1-2 semanas |
| | **TOTAL** | **126** | **~5-7 meses solo dev** |

Esta é uma jornada de meses, mas cada item é independente e mergeable. Pode parar em qualquer momento e continuar — o app permanece sempre shippable.

---

## 4. P0 — Críticos (segurança, LGPD, reproducibilidade)

### P0.1 Versionar SQL das migrations v0.2.4.0+ aplicadas via MCP em prod

**Rationale:** Schema-as-code restaurado. Sem isso, recriação from scratch impossível, deploy em novo projeto Supabase impossível.

```bash
cd "G:\00_Trabalho\01_Pessoal\Apps\medcontrol_v2"
git checkout -b chore/versionar-migrations-categorias
supabase db diff --use-migra > supabase/migrations/$(date +%Y%m%d%H%M%S)_categorias_v0_2_4_0_to_v0_2_5_0_replay.sql

# Revisar diff manualmente. Deve conter:
# - ALTER medications_catalog +ean+group_id+cmed_class+tarja+tipo_produto+principio_ativo_normalizado+updated_from_cmed_at+is_dcb
# - CREATE user_medications (RLS owner-only)
# - ALTER treatments+doses+sos_rules +group_id+cmed_class
# - CHECK constraint chk_*_group 17 valores (incluindo hormonal)
# - RPC search_medications nova (retorna group_id+cmed_class+is_dcb, ORDER BY is_dcb DESC)
# - RPC upsert_user_medication, get_user_medications, doses_by_group, top_meds_per_group
# - RPC classify_medication_robust 5 tiers
# - Seed DCBs top-50 com group_id correto
# - Brand_map BR (Aerolin/Clenil/Decadron/Mounjaro/Ozempic/Zoloft/Lexapro/Tylenol/Buscopan/Cataflam/Clavulin/Rivotril/etc.) 70+ entries

# Validar localmente
supabase db reset --debug

git add supabase/migrations/
git commit -m "chore(db): versionar migrations v0.2.4.0-v0.2.5.0 aplicadas via MCP"
git push -u origin chore/versionar-migrations-categorias
```

**Aceite:** `supabase db reset` recria estado prod idêntico + `supabase db lint` 0 errors + colunas/RPCs/CHECK/seeds confirmados via `\d medications_catalog` no psql.

---

### P0.2 Snapshot completo schema atual

**Rationale:** `remote_schema.sql` (0 bytes) atualmente. Necessário pra `supabase db reset`.

```bash
git checkout -b chore/snapshot-remote-schema
supabase db dump --data-only=false > supabase/migrations/20260428172242_remote_schema.sql

# Validar
wc -l supabase/migrations/20260428172242_remote_schema.sql  # >2000 lines
grep -E "is_dcb|classify_medication_robust|user_medications|hormonal" supabase/migrations/20260428172242_remote_schema.sql

git add supabase/migrations/20260428172242_remote_schema.sql
git commit -m "chore(db): snapshot completo schema medcontrol prod"
```

**Aceite:** arquivo >50KB + grep retorna matches pras colunas v0.2.5.0. Pode rodar em paralelo com P0.1.

---

### P0.3 Sentry PII strip exhaustivo (LGPD)

**Rationale:** Atualmente strip apenas 4 campos. Falta strip de 11+ campos sensíveis healthcare BR em `event.contexts`, `event.extra`, `event.breadcrumbs[].data`, `event.tags`.

**Editar `src/main.jsx` linhas 40-50:**

```javascript
const SENSITIVE_FIELDS = [
  'name', 'email', 'username', 'ip_address',
  'condition', 'allergies', 'doctor', 'insurance', 'insurance_card',
  'phone', 'emergency_contact', 'emergency_phone',
  'weight', 'height', 'blood_type',
  'medName', 'patientName', 'observation',
  'access_token', 'refresh_token', 'jwt', 'apiKey',
  'password', 'service_role', 'anon_key'
];

function stripPII(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  Object.keys(obj).forEach(key => {
    const lower = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(f => lower.includes(f.toLowerCase()))) {
      obj[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      stripPII(obj[key]);
    }
  });
  return obj;
}

beforeSend(event, hint) {
  if (event.user) stripPII(event.user);
  if (event.request) stripPII(event.request);
  if (event.contexts) stripPII(event.contexts);
  if (event.extra) stripPII(event.extra);
  if (event.tags) stripPII(event.tags);
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(b => {
      if (b.data) stripPII(b.data);
      if (b.message) {
        SENSITIVE_FIELDS.forEach(f => {
          const re = new RegExp(f, 'gi');
          if (re.test(b.message)) {
            b.message = b.message.replace(re, '[REDACTED]');
          }
        });
      }
      return b;
    });
  }
  return event;
}
```

**Criar `src/main.test.js`** com testes pra cada caminho.

**Aceite:** teste unitário passa + manual check 5 eventos Sentry últimos 7 dias sem PII.

**Branch:** `fix/sentry-pii-strip-exhaustivo`

---

### P0.4 PostHog consent gate (LGPD)

**Rationale:** PostHog inicia em `src/services/analytics.js` sem consent. Viola LGPD-first + docs Dosy v2.

**Em `src/services/analytics.js:26-75`:**

```javascript
export function initAnalytics() {
  if (!POSTHOG_KEY) return;
  const consent = localStorage.getItem('dosy_consent_telemetry');
  if (consent !== 'true') {
    console.info('[analytics] PostHog NÃO inicializado — consent telemetria pendente');
    return;
  }
  // ... resto existente
}

export function setConsent(value) {
  localStorage.setItem('dosy_consent_telemetry', value ? 'true' : 'false');
  if (value && !window.posthog) initAnalytics();
  if (!value && window.posthog) {
    window.posthog.opt_out_capturing();
    window.posthog.reset();
  }
}

export function getConsent() {
  return localStorage.getItem('dosy_consent_telemetry');
}
```

**Criar `src/components/ConsentBanner.jsx`** + montar em `App.jsx` antes do `MainAppContent`.

**Adicionar toggle em `src/pages/Settings/sections.jsx`** seção `DataPrivacySection`.

**Aceite:** banner aparece em user novo + opt-out remove eventos do PostHog (verificar dashboard 5min).

**Branch:** `feat/posthog-consent-gate`

---

### P0.5 Keystore exposure check + rotação se necessária

```bash
git log --all --full-history -- "*.keystore"
git log --all --full-history -- "*.jks"
git ls-files | grep -E "\.keystore|\.jks"

# Se TUDO vazio: OK
# Se RETORNAR commits: ROTAÇÃO IMEDIATA
# 1. keytool -genkey -v -keystore ~/.keystores/dosy-release-new.keystore -alias dosy -keyalg RSA -keysize 4096 -validity 10000
# 2. Backup nova em 3 locais offline (cofre 1Password + drive + USB)
# 3. Play Console → app → Setup → App integrity → Upload key certificate → upload novo .pem
# 4. Atualizar android/keystore.properties pra path absoluto fora do repo
```

**Aceite:** git history limpo + keystore fora do repo + Play Console upload key atualizado se houve exposure.

---

### P0.6 `dose-trigger-handler` anti-duplicate pre-check

**Rationale:** Atualmente, mesma dose com múltiplos UPDATEs em sequência dispara FCM N vezes. Sem dedup transacional. Flood risk em retry storms.

**Em `supabase/functions/dose-trigger-handler/index.ts`** (linhas 327-374 UPDATE pending→non-pending):

Adicionar advisory lock no Postgres trigger OU tabela de fingerprint:

```sql
-- Migration nova: anti-dup pre-check via tabela
CREATE TABLE IF NOT EXISTS medcontrol.fcm_dispatched_log (
  dose_id UUID NOT NULL,
  dispatch_kind TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dose_id, dispatch_kind, scheduled_at)
);
CREATE INDEX fcm_dispatched_log_dispatched_at_idx ON medcontrol.fcm_dispatched_log(dispatched_at);
-- Cleanup cron diário >7d
```

Na Edge function, antes de dispatch:

```typescript
const recent = await adminSb
  .schema('medcontrol')
  .from('fcm_dispatched_log')
  .select('dose_id')
  .eq('dose_id', doseId)
  .eq('dispatch_kind', dispatchKind)
  .gte('dispatched_at', new Date(Date.now() - 60_000).toISOString())
  .maybeSingle();

if (recent.data) {
  console.warn('[dose-trigger] skip dup dispatch', { doseId, dispatchKind });
  return new Response(JSON.stringify({ skipped: 'duplicate' }), { status: 200 });
}

// ... dispatch ...

await adminSb.schema('medcontrol').from('fcm_dispatched_log').insert({
  dose_id: doseId,
  dispatch_kind: dispatchKind,
  scheduled_at: scheduledAt,
});
```

**Aceite:** simular 2 UPDATEs <60s na mesma dose → segunda dispara `skipped: duplicate`.

---

## 5. P1 — Arquitetural (correções fundamentais)

### P1.1 Sincronizar `package-lock.json`
```bash
rm package-lock.json
npm install --legacy-peer-deps
git commit -m "chore: sync lockfile com package.json 0.2.5.0"
```

### P1.2 Adicionar `engines` em `package.json`
```json
"engines": { "node": ">=22.0.0 <23", "npm": ">=10.0.0" }
```

### P1.3 `@sentry/react` com `^`
`package.json:50` → `"@sentry/react": "^10.43.0"`

### P1.4 `prettier --check` em pre-commit
`package.json` lint-staged config + `src/**/*.{js,jsx}` → `["eslint --max-warnings=80", "prettier --check"]`

### P1.5 Ativar `versionedCache.reconcileDoses` (resolve bug "status volta")

**Em `src/hooks/useDashboardPayload.js`:**

```javascript
import { reconcileDoses } from '../state/versionedCache';

// Após o useQuery:
const reconciled = useMemo(() => {
  if (!query.data?.doses) return query.data;
  const current = qc.getQueryData(['dashboard-payload', keyFilter]);
  if (!current?.doses) return query.data;
  return { ...query.data, doses: reconcileDoses(current.doses, query.data.doses) };
}, [query.data, qc, keyFilter]);
```

**Em `src/services/dosesService.js` (confirmDose, skipDose, undoDose, registerSos):**

```javascript
const { data, error } = await supabase.rpc('confirm_dose', { ... });
if (data) data._serverConfirmedAt = Date.now();
return data;
```

Adicionar PostHog event `sync_conflict_explicit_resolution` quando reconcile rejeita server payload.

**Aceite:** bug "status volta" não se manifesta em test cellular ruim (validation device NB-4 pattern).

**Branch:** `fix/ativar-reconcile-doses-status-volta`

---

### P1.6 Conflict resolution 409 — RPCs healthcare retornam `current_state`

**Rationale:** Hoje `confirm_dose`, `skip_dose`, `undo_dose` retornam erro genérico em estado terminal. Cliente faz rollback silencioso (viola ADR-013).

**Editar RPCs SQL:**

```sql
CREATE OR REPLACE FUNCTION medcontrol.confirm_dose(
  p_dose_id UUID, p_actual_time TIMESTAMPTZ, p_observation TEXT
) RETURNS JSONB AS $$
DECLARE v_current RECORD;
BEGIN
  SELECT * INTO v_current FROM medcontrol.doses WHERE id = p_dose_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND', 'code', 404);
  END IF;
  IF v_current.status NOT IN ('pending', 'overdue') THEN
    RETURN jsonb_build_object(
      'error', 'INVALID_TRANSITION',
      'code', 409,
      'current_state', row_to_json(v_current)
    );
  END IF;
  UPDATE medcontrol.doses SET status='done', "actualTime"=p_actual_time, observation=p_observation, "updatedAt"=NOW() WHERE id=p_dose_id;
  RETURN jsonb_build_object('ok', true, 'dose', row_to_json(v_current));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, extensions, public;
```

**Aplicar mesma estrutura em** `skip_dose`, `undo_dose`, `register_sos_dose`, `update_treatment_schedule`.

**Em `src/services/mutationRegistry.js`, no `onError`:**

```javascript
onError: (error, variables, context) => {
  if (error?.code === 409 && error?.current_state) {
    toast.show({
      kind: 'warning',
      message: 'Essa dose foi alterada em outro dispositivo. Aceitar?',
      action: 'Aceitar',
      onAction: () => {
        qc.setQueryData(['dashboard-payload', '*'], (old) => patchWith(old, error.current_state));
      }
    });
  } else {
    toast.show({
      kind: 'error',
      message: 'Não foi possível registrar. Toque pra tentar de novo.',
      onUndo: () => mutate(variables)
    });
  }
  rollback(qc, context?.snapshots);
}
```

**Aceite:** simular 2 devices marcando mesma dose → segundo recebe prompt 409 (não rollback silencioso).

**Branch:** `feat/conflict-resolution-409-explicit`

---

### P1.7 Snackbar persistente em `onError` de mutations healthcare

Já parcialmente em P1.6. Para mutations não-healthcare (createPatient, updateTreatment, etc.), adicionar feedback explícito em todos os `onError`.

**Lista de mutations a tratar:**
- `confirmDose`, `skipDose`, `undoDose`, `registerSos` (já em P1.6)
- `createPatient`, `updatePatient`, `deletePatient`
- `createTreatment`, `updateTreatment`, `deleteTreatment`, `pauseTreatment`, `resumeTreatment`, `endTreatment`
- `useUpdateUserPrefs`, `useUpsertSosRule`, `useDeleteSosRule`, `useSharePatient`, `useUnsharePatient`

**Aceite:** simular 5xx em cada mutation → toast persistente aparece com botão Retry.

---

### P1.8 UI ↔ Supabase enforcement — mover 5 JSX pra services

**Arquivos a refatorar:**
- `pages/Dashboard.jsx:305` — extrair `extend_continuous_treatments` pra `dashboardService.js`
- `pages/Settings/index.jsx:129-131,190` — 4 chamadas pra `subscriptionService.js`, `dosesService.js`, `treatmentsService.js`
- `components/DoseModal.jsx:44` — lazy-load `observation` em `dosesService.fetchObservation(doseId)`
- `components/ForceNewPasswordModal.jsx` + `ChangePasswordModal.jsx` — `supabase.auth.updateUser` em `authService.updatePassword(newPwd)`

**Adicionar ESLint rule** em `eslint.config.js`:

```javascript
{
  files: ['src/pages/**', 'src/components/**', 'src/hooks/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['@supabase/*'], message: 'Import via core/entities/* — Regra 5 RULES.md' }
      ]
    }]
  }
}
```

Com exceções pra `src/services/**` e `src/utils/**`.

**Aceite:** `npm run lint` retorna 0 violações + os 5 JSX não importam supabase direto.

**Branch:** `refactor/ui-supabase-boundary`

---

### P1.9 Realtime sob demanda (re-ativar restrito a PatientDetail compartilhado)

**Rationale:** Realtime DESABILITADO em prod desde v0.2.1.0 #157 (storm 5GB/h). ADR-011 Dosy v2 propõe re-ativar APENAS em PatientDetail de paciente compartilhado.

**Refatorar `src/hooks/useRealtime.js`:**

```javascript
export function useRealtimePatient(patientId, isShared) {
  useEffect(() => {
    if (!patientId || !isShared) return; // só ativa em paciente compartilhado
    const channel = supabase.channel(`realtime:patient:${patientId}:${Date.now()}`);
    channel
      .on('postgres_changes', { event: '*', schema: 'medcontrol', table: 'doses', filter: `patientId=eq.${patientId}` },
        () => debouncedInvalidate(['dashboard-payload']))
      .on('postgres_changes', { event: '*', schema: 'medcontrol', table: 'patient_shares', filter: `patientId=eq.${patientId}` },
        () => debouncedInvalidate(['patient_shares', patientId]))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [patientId, isShared]);
}
```

**Usar em `pages/PatientDetail.jsx`:**

```javascript
const patient = usePatient(patientId);
useRealtimePatient(patientId, patient?.is_shared);
```

**Configurar publication Supabase** pra incluir apenas `doses` + `patient_shares` (não `patients`/`treatments`/`sos_rules`).

**Aceite:** egress < 100MB/h por user idle (era 5GB/h). Validação: deixar app em hidden tab 1h, medir egress via Supabase dashboard.

**Branch:** `feat/realtime-sob-demanda-shared-patient`

---

### P1.10 `Sentry.captureException` nos 121 catches silenciosos

Adicionar em:
- `src/services/mutationRegistry.js` onError de cada mutation (healthcare-critical)
- `src/services/notifications/scheduler.js` catch linha 280+
- `src/services/notifications/fcm.js` registration failure
- `src/hooks/useAuth.jsx` todos os catches
- `src/services/notifications/auditLog.js` insert fails
- Todos `} catch {}` silenciosos (Grep retorna 20+ ocorrências)

**Configurar ESLint:**

```javascript
'no-empty': ['error', { allowEmptyCatch: false }]
```

E criar custom rule (eslint-plugin local) que detecta `.catch(() => {})` patterns.

**Aceite:** Sentry mostra eventos categorizados por `tags.source` nos próximos 7 dias.

**Branch:** `fix/sentry-capture-exception-critical-paths`

---

### P1.11 `tracesSampleRate: 0.1` em prod

`src/main.jsx`:
```javascript
tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
```

Habilita performance monitoring (10% sampling cabe Sentry Free tier 10k transactions/mês).

---

### P1.12 Timeouts em TODAS as mutations (15s padrão)

**Refatorar `src/services/mutationRegistry.js`** wrapping cada mutationFn:

```javascript
function withTimeout(fn, timeoutMs = 15000) {
  return async (...args) => {
    return Promise.race([
      fn(...args),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs))
    ]);
  };
}

// Aplicar:
mutationFn: withTimeout(async ({ id, actualTime }) => { ... })
```

**Aceite:** mutation pendente >15s rejeita com `TIMEOUT` → onError snackbar.

---

### P1.13 `useReducer` em `TreatmentForm.jsx` (14 campos useState único)

**Refatorar `src/pages/TreatmentForm.jsx`:**

```javascript
const initialState = { /* 14 fields */ };

function formReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.key]: action.value };
    case 'AUTOFILL_FROM_CATALOG': return { ...state, ...action.payload };
    case 'RESET': return initialState;
    default: throw new Error('Unknown action');
  }
}

const [form, dispatch] = useReducer(formReducer, initialState);
const set = (k, v) => dispatch({ type: 'SET_FIELD', key: k, value: v });
```

Adicionar validação Zod no submit:

```javascript
import { z } from 'zod';
const TreatmentSchema = z.object({
  patientId: z.string().uuid(),
  medName: z.string().min(1).max(200),
  unit: z.string().min(1).max(100),
  intervalHours: z.number().int().min(1).max(168).optional(),
  // ...
});

const parsed = TreatmentSchema.safeParse(form);
if (!parsed.success) { /* show errors */ return; }
```

**Aceite:** form passa testes de validação edge cases + zero re-renders desnecessários em digitação.

**Branch:** `refactor/treatment-form-reducer`

---

### P1.14 Eliminar `theme.css` legacy

**Rationale:** Mistura `--color-brand-*` azul com `--dosy-*` warm coral. Inconsistência (focus rings inputs azul em vez de sunset).

**Substituir referências:**
- `src/index.css` linhas 158-170 (`.input` focus): trocar `var(--color-brand-100)` → `var(--dosy-sunset-1)`
- `src/index.css` linhas 100-105 (`.card`): trocar `var(--color-*)` → `var(--dosy-*)`
- `src/App.jsx` skip-link: `bg-brand-600` → `bg-[var(--dosy-primary)]`

**Deletar `src/styles/theme.css`** após verificar zero referências.

**Aceite:** Grep `--color-brand-` retorna 0 matches em `src/`. Focus visual coral consistente em todos inputs.

**Branch:** `refactor/eliminar-theme-css-legacy`

---

## 6. P2 — Refactor_Full Fases 2-5 (concluir)

### Fase 2 — Consolidação de alarmes

#### P2.1 Edge `request-schedule-sync` REAL (substituir stub)

**Atualmente:** STUB que valida Bearer mas NÃO o JWT.

**Implementar de verdade:**

```typescript
// supabase/functions/request-schedule-sync/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 });
  const jwt = auth.slice(7);

  const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }
  });
  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) return new Response('unauthorized', { status: 401 });

  // Reusar lógica do daily-alarm-sync (extrair pra _shared/scheduling.ts)
  const { schedulePayload } = await import('../_shared/scheduling.ts');
  const result = await schedulePayload(user.id, { horizonHours: clamp(body.horizon_hours, 1, 168) });

  return new Response(JSON.stringify(result), { status: 200 });
});
```

**Extrair lógica comum** de `daily-alarm-sync/index.ts` linhas 117-275 pra `_shared/scheduling.ts` reutilizável.

**Aceite:** POST sem JWT válido → 401. POST com JWT válido → FCM dispatch payload pra device user.

**Branch:** `feat/request-schedule-sync-real-implementation`

---

#### P2.2 Drop `dose-fire-time-notifier` (1440 invocações/dia sem ganho)

**Rationale:** Cron 1×/min defensivo pra caregivers killed. Custou 1440 invocações/dia. Refactor_Full Fase 2 propôs drop em favor de WorkManager 24h + pre-check HTTP.

**Sequência:**

1. **Garantir que WorkManager + AlarmReceiver pre-check HTTP cobrem o caso** (verificar `qa_appium` cenário killed-caregiver com `dose-fire-time-notifier` desativado)
2. `select cron.unschedule('dose-fire-time-1min')` no Supabase SQL Editor
3. `supabase functions delete dose-fire-time-notifier`
4. Remover migration `20260516161000_dose_fire_notified_at_v0_2_3_7` se não usada em mais lugar (verificar grep `fire_notified_at`)
5. Verificar `DosyMessagingService.handleFireNowAlarm` continua sendo invocado por algum cron equivalente (se não, remover)
6. Egress audit: verificar redução ~1440 invocações/dia

**Aceite:** Audit Supabase mostra redução 1440 invocações/dia + caregiver killed test passa.

**Branch:** `refactor/drop-dose-fire-time-notifier`

---

#### P2.3 BootReceiver query NOW-2h..NOW+horizon (catch-up doses perdidas)

**Já parcialmente implementado** em `BootReceiver.java` (grace 2h #224). Verificar e expandir:

```java
// android/.../BootReceiver.java
public void onReceive(Context ctx, Intent intent) {
  // ... atual ...

  // Catch-up: query doses perdidas durante boot
  long now = System.currentTimeMillis();
  long graceStart = now - (2L * 60L * 60L * 1000L);
  long horizonEnd = now + (48L * 60L * 60L * 1000L);

  // Query DB direto via HTTP (boot context, sem JS bridge ainda)
  fetchUpcomingDoses(ctx, graceStart, horizonEnd, (doses) -> {
    for (Dose d : doses) {
      if (d.scheduledAt < now) {
        // Late-fire imediato
        AlarmReceiver.sendBroadcastForLateRecovery(ctx, d);
      } else {
        AlarmScheduler.scheduleDoseAlarm(ctx, d.id, d.scheduledAt, ...);
      }
    }
  });
}
```

**Reusar `DoseSyncWorker.fetchUpcomingDoses()`** pattern.

**Aceite:** Boot em emulator com 5 doses agendadas nas últimas 2h → todas late-fire imediato.

**Branch:** `feat/boot-receiver-catchup-2h`

---

#### P2.4 Drop Capacitor `LocalNotifications` inteiramente

**Rationale:** Consolidar `src/services/notifications/` → `src/services/scheduling/`. Hoje Capacitor LocalNotifications coexiste com Java tray — race condition #215.

**Sequência:**

1. Verificar todos os usos de `@capacitor/local-notifications` em `src/`
2. Substituir cada uso por Java tray (via `CriticalAlarm.scheduleTrayGroup`)
3. Remover plugin de `capacitor.config.ts` + `package.json` + `capacitor.build.gradle`
4. `npx cap sync android` + rebuild

**Aceite:** `grep -r "@capacitor/local-notifications" src/` retorna 0 matches.

**Branch:** `refactor/drop-capacitor-local-notifications`

---

#### P2.5 Cliente JS deixar de reagendar alarmes

Atualmente `App.jsx:233-246` recalcula `dosesSignature` (FNV hash) e chama `scheduleDoses`. Refactor_Full Fase 2 propõe servidor único agendador.

**Refatorar:**
- Mover trigger pra Edge `request-schedule-sync` (P2.1)
- App.jsx useEffect só chama `requestScheduleSync()` em login + treatment change
- Servidor agenda via FCM data-only `schedule_alarms`
- Cliente Java recebe e agenda via `AlarmScheduler.scheduleDoseAlarm`

**Aceite:** App não tem mais `rescheduleAll` JS-side. Test cellular ruim não causa storm.

**Branch:** `refactor/server-side-alarm-scheduling`

---

### Fase 3 — Single source of truth

#### P2.6 Tier 100% via JWT claim (eliminar query DB redundante)

**Já parcialmente:** Custom Access Token Hook #22 injeta tier em `app_metadata`. Mas `useTier` ainda faz query DB.

**Refatorar `src/hooks/useSubscription.js`:**

```javascript
export function useMyTier() {
  const { session } = useAuth();
  const tier = session?.user?.app_metadata?.tier ?? 'free';
  return { data: tier, isLoading: false };
}
```

Remover `useQuery(['my_tier', user?.id])` que faz round-trip.

**Aceite:** PostHog event `tier_check_latency` < 5ms (era ~200ms).

---

#### P2.7 Push token consolidate (SharedPrefs Android como cache de `push_subscriptions`)

Hoje SharedPrefs `dosy_fcm_token` e `dosy_device_id_uuid` são fonte primária — `push_subscriptions` DB é secundário. Reverter: DB é fonte de verdade, SharedPrefs é cache.

**Refatorar fluxo:**
- `subscribeFcm()` em fcm.js insere em DB primeiro, depois cache local
- BootReceiver não confia em SharedPrefs sem verificar DB
- `useAuth` SIGNED_OUT deleta DB row antes de limpar SharedPrefs

**Aceite:** force-clear SharedPrefs Android → next launch re-fetch token de DB e re-cacheia.

**Branch:** `refactor/push-token-db-primary`

---

#### P2.8 `generateDoses.js` removido (RPC server-side única fonte)

**Rationale:** `src/utils/generateDoses.js` é fallback offline duplicado da lógica do RPC `create_treatment_with_doses`. Drift risco.

**Sequência:**
- Verificar onde `generateDoses` é usado (provavelmente em `mutationRegistry.js` createTreatment optimistic patch)
- Substituir por estrutura mínima local (só pra UI patch otimista) que NÃO replica lógica de geração
- Quando RPC volta, server doses sobrescrevem patch local
- `rm src/utils/generateDoses.js` + remover import

**Aceite:** Grep `generateDoses` retorna 0 matches.

**Branch:** `refactor/drop-generate-doses-js`

---

#### P2.9 `useAppLifecycle` merge real (consolidar useAppResume + useAppLock)

Hoje wrapper declarado mas não usado — `App.jsx` chama os 2 hooks diretos.

**Refatorar:**
- `useAppLifecycle.js` torna-se ponto único + chama internamente `useAppResume` + `useAppLock`
- `App.jsx` chama só `useAppLifecycle()`
- Remover chamadas duplicadas

**Aceite:** Grep `useAppResume` + `useAppLock` em pages/components retorna 0 (só `useAppLifecycle.js` usa).

---

#### P2.10 Remover hook órfãos

Deletar arquivos:
- `src/hooks/useDosyQuery.js` (25 LOC, 0 callers)
- `src/hooks/useDosyMutation.js` (22 LOC, 0 callers)
- `src/hooks/usePushNotifications.js` (se órfão)

Verificar com `grep -r "useDosyQuery\|useDosyMutation\|usePushNotifications" src/`.

**Aceite:** files deletados + build verde.

---

### Fase 4 — Componentização completa

#### P2.11 Adoção dos 6 componentes restantes em forms/lists (15+ páginas)

Componentes criados em Fase 4 mas pendente adopção:
- `FormRow.jsx` — adotar em TreatmentForm, PatientForm, Settings
- `TodayDosesStat.jsx` — adotar em Dashboard
- `MedicationHistoryGrid.jsx` — adotar em SOS, Analytics, TreatmentForm sugestões
- `TreatmentCard.jsx` — adotar em TreatmentList (substituir inline)
- `DoseList.jsx` — adotar em Dashboard, PatientDetail (substituir inline)
- `DoseSheet.jsx` — consolidar `DoseModal` + `MultiDoseModal` em wrapper único

**Aceite:** 6 componentes têm pelo menos 1 uso real em página.

**Branch:** `refactor/adopt-fase4-components`

---

#### P2.12 Varredura `legacy|deprecated|REMOVIDO|débito|TODO|FIXME` → cleanup

```bash
grep -rE "legacy|deprecated|REMOVIDO|débito|TODO|FIXME" src/ --include="*.js" --include="*.jsx" > /tmp/cleanup.txt
# Revisar cada match: deletar, refatorar, ou converter em GitHub Issue
```

**Aceite:** `cleanup.txt` < 20 entries (era 42 comentários).

---

#### P2.13 Consolidar 47 scripts QA em `scripts/qa/` parametrizado

Reorganizar:
```
scripts/
├── automation/
│   ├── ingest-anvisa.mjs
│   ├── backfill-catalog-groups.mjs
│   ├── ingest-cmed.mjs                # NOVO P3.5
│   ├── gen-icons.mjs
│   └── copy-apk-to-dist.cjs
├── data/                              # datasets
├── qa/                                # gitignored (.gitkeep)
│   ├── lib/
│   │   ├── appium.mjs                 # consolidado de qa_appium_lib
│   │   └── cdp.mjs                    # 1 cdp_login consolidado
│   └── flows/                         # specs E2E parametrizados
│       ├── owner-flow.spec.mjs
│       ├── caregiver-flow.spec.mjs
│       ├── nb4-force-kill.spec.mjs
│       └── ...
└── tests/                             # validators CI
    ├── validate-medications-seed.ts
    └── validate-cmed-mapping-coverage.ts
```

Deletar redundantes (lista em P7.1).

**Aceite:** <15 scripts ativos em raiz `scripts/`. QA flows parametrizados via argv.

---

#### P2.14 Edge `notify-doses` + `schedule-alarms-fcm` (stubs 410) deletados

```bash
supabase functions delete notify-doses
supabase functions delete schedule-alarms-fcm
git rm -r supabase/functions/notify-doses supabase/functions/schedule-alarms-fcm
git commit -m "chore: delete deprecated Edge stubs (returned 410)"
```

---

#### P2.15 `DoseModal` + `MultiDoseModal` → `DoseSheet` único

Consolidar em wrapper que escolhe internamente single vs multi baseado em `doses.length`.

**Aceite:** `DoseModal.jsx` e `MultiDoseModal.jsx` deletados. Único wrapper em `dosy/DoseSheet.jsx`.

---

### Fase 5 — Performance e instrumentação

#### P2.16 Bundle analysis + lazy load Analytics/Reports/Admin/FAQ/Privacidade/Termos/Install

Em `App.jsx`, garantir lazy:
```javascript
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports = lazy(() => import('./pages/Reports'));
const Admin = lazy(() => import('./pages/Admin'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Privacidade = lazy(() => import('./pages/Privacidade'));
const Termos = lazy(() => import('./pages/Termos'));
const Install = lazy(() => import('./pages/Install'));
```

Rodar `npm run build` + analisar `dist/stats.html` (visualizer plugin já configurado em vite.config.js).

**Aceite:** Initial bundle main chunk < 250KB gzipped (era ~400KB).

---

#### P2.17 React.memo audit (DoseCard, PatientAvatar, MiniStat, EmptyState)

```javascript
export default React.memo(DoseCard, (prev, next) => {
  return prev.dose.id === next.dose.id
    && prev.dose.status === next.dose.status
    && prev.dose.actualTime === next.dose.actualTime;
});
```

**Aceite:** Profile React DevTools: <30 re-renders em Dashboard mount com 50 doses.

---

#### P2.18 Web Vitals + Sentry tracing → PostHog

```javascript
// src/main.jsx
import { onCLS, onLCP, onFID, onINP } from 'web-vitals';

onCLS(({ value }) => posthog?.capture('web_vital_cls', { value }));
onLCP(({ value }) => posthog?.capture('web_vital_lcp', { value }));
onFID(({ value }) => posthog?.capture('web_vital_fid', { value }));
onINP(({ value }) => posthog?.capture('web_vital_inp', { value }));
```

Sentry traces (tracesSampleRate 0.1 em P1.11) capturará RPC duration + FCM latency automaticamente.

**Aceite:** PostHog Insights mostra Web Vitals trend nos próximos 14 dias.

---

## 7. P3 — Backport schema + RPCs + Edge Functions Dosy v2

### Tabelas faltantes

#### P3.1 `medcontrol.profiles`

```sql
CREATE TABLE medcontrol.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  consent_version INT NOT NULL DEFAULT 1,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE medcontrol.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_self ON medcontrol.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY profiles_update_self ON medcontrol.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Trigger on signup
CREATE OR REPLACE FUNCTION medcontrol.on_new_user_create_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO medcontrol.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_new_user_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION medcontrol.on_new_user_create_profile();

-- Backfill existing users
INSERT INTO medcontrol.profiles (user_id, name)
SELECT id, COALESCE(raw_user_meta_data->>'name', '') FROM auth.users
ON CONFLICT DO NOTHING;
```

**Aceite:** `SELECT COUNT(*) FROM medcontrol.profiles` == `SELECT COUNT(*) FROM auth.users`.

---

#### P3.2 `medcontrol.audit_log` append-only (LGPD)

```sql
CREATE TABLE medcontrol.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  patient_id UUID REFERENCES medcontrol.patients(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'dose_marked_done', 'dose_marked_skipped', 'dose_undone',
    'sos_registered', 'sos_forced_override',
    'patient_shared', 'patient_unshared', 'share_access_changed', 'share_extended',
    'treatment_created', 'treatment_paused', 'treatment_resumed', 'treatment_ended',
    'account_deleted', 'data_exported'
  )),
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_log_user_idx ON medcontrol.audit_log(user_id, "createdAt" DESC);
CREATE INDEX audit_log_patient_idx ON medcontrol.audit_log(patient_id, "createdAt" DESC);
CREATE INDEX audit_log_action_idx ON medcontrol.audit_log(action);

ALTER TABLE medcontrol.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_admin_or_owner ON medcontrol.audit_log
  FOR SELECT TO authenticated USING (
    medcontrol.is_admin()
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM medcontrol.patients WHERE id = patient_id AND "userId" = auth.uid())
  );
-- INSERT via funções SECURITY DEFINER apenas
```

**Disparar audit em RPCs:** alterar `confirm_dose`, `unshare_patient`, `delete_my_account`, etc., pra INSERT em `audit_log`.

**Aceite:** após confirmar 1 dose, query `SELECT * FROM medcontrol.audit_log WHERE action='dose_marked_done'` retorna 1 row.

**Cron de cleanup** (1 ano após delete share):
```sql
DELETE FROM medcontrol.audit_log
WHERE patient_id NOT IN (SELECT id FROM medcontrol.patients)
AND "createdAt" < NOW() - INTERVAL '365 days';
```

---

#### P3.3 `medcontrol.feature_flags`

```sql
CREATE TABLE medcontrol.feature_flags (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);
ALTER TABLE medcontrol.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY ff_select_public ON medcontrol.feature_flags FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY ff_admin_write ON medcontrol.feature_flags FOR ALL TO authenticated
  USING (medcontrol.is_admin()) WITH CHECK (medcontrol.is_admin());

-- Seed inicial
INSERT INTO medcontrol.feature_flags (key, value, description) VALUES
  ('beta_promo_active', 'false'::jsonb, 'Se true, novos signups ganham tier Plus 30d grátis'),
  ('engine_interactions_enabled', 'false'::jsonb, 'Habilita check_interactions warning UI'),
  ('ocr_enabled', 'false'::jsonb, 'Habilita OCR via Gemini Vision'),
  ('realtime_enabled', 'true'::jsonb, 'Master switch Realtime (rollback rápido se storm)'),
  ('cmed_monthly_sync_enabled', 'true'::jsonb, 'Habilita cron mensal CMED ingest')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION medcontrol.admin_set_feature_flag(p_key TEXT, p_value JSONB)
RETURNS VOID AS $$
BEGIN
  IF NOT medcontrol.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO medcontrol.feature_flags (key, value, updated_by)
  VALUES (p_key, p_value, auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW(), updated_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;
```

**Cliente consome via:**
```javascript
const { data: flags } = useQuery({
  queryKey: ['feature_flags'],
  queryFn: () => supabase.from('feature_flags').select('*'),
  staleTime: 5 * 60 * 1000
});
const isOcrEnabled = flags?.find(f => f.key === 'ocr_enabled')?.value === true;
```

**Aceite:** Admin panel pode toggle flags em runtime sem deploy.

---

#### P3.4 `medcontrol.treatment_user_alert_settings` (per-user-per-treatment)

```sql
CREATE TABLE medcontrol.treatment_user_alert_settings (
  treatment_id UUID NOT NULL REFERENCES medcontrol.treatments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('critical', 'push', 'silent')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (treatment_id, user_id)
);
ALTER TABLE medcontrol.treatment_user_alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_settings_self ON medcontrol.treatment_user_alert_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION medcontrol.update_user_alert_setting(p_treatment_id UUID, p_alert_level TEXT)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT medcontrol.has_patient_access((SELECT "patientId" FROM medcontrol.treatments WHERE id = p_treatment_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO medcontrol.treatment_user_alert_settings (treatment_id, user_id, alert_level)
  VALUES (p_treatment_id, auth.uid(), p_alert_level)
  ON CONFLICT (treatment_id, user_id) DO UPDATE
  SET alert_level = EXCLUDED.alert_level, "updatedAt" = NOW();

  -- Trigger Edge handler pra propagar pro AlarmScheduler nativo
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/treatment-alert-setting-handler',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := jsonb_build_object('treatment_id', p_treatment_id, 'user_id', auth.uid(), 'alert_level', p_alert_level)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;
```

**UI:** Adicionar `<AlertLevelToggle>` em `TreatmentCard.jsx` (3 segmentos crítico/push/silent).

**Aceite:** Toggle per-treatment funciona independente do switch global Alarme Crítico.

---

#### P3.5 `medcontrol.custom_medication_rules` (overrides per-user-per-patient)

```sql
CREATE TABLE medcontrol.custom_medication_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES medcontrol.patients(id) ON DELETE CASCADE,
  med_name TEXT NOT NULL,
  min_interval_hours INT,
  max_doses_24h INT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, patient_id, med_name)
);
ALTER TABLE medcontrol.custom_medication_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_rules_self ON medcontrol.custom_medication_rules
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**Permite ao user** override `sos_rules` quando médico prescreveu diferente do padrão DCB.

---

#### P3.6 Tabelas Engine ADR-012 (medication_principles + medication_interactions)

```sql
CREATE TABLE medcontrol.medication_principles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dcb TEXT UNIQUE NOT NULL,
  name_pt TEXT NOT NULL,
  therapeutic_class TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE medcontrol.medication_principles ENABLE ROW LEVEL SECURITY;
CREATE POLICY mp_select_public ON medcontrol.medication_principles FOR SELECT USING (true);
CREATE POLICY mp_admin_write ON medcontrol.medication_principles FOR ALL USING (medcontrol.is_admin()) WITH CHECK (medcontrol.is_admin());

CREATE TABLE medcontrol.medication_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principle_a_id UUID NOT NULL REFERENCES medcontrol.medication_principles(id),
  principle_b_id UUID NOT NULL REFERENCES medcontrol.medication_principles(id),
  severity TEXT NOT NULL CHECK (severity IN ('leve', 'moderada', 'grave')),
  description TEXT NOT NULL,
  source TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (principle_a_id, principle_b_id),
  CHECK (principle_a_id < principle_b_id) -- evita duplicação simétrica
);
CREATE INDEX mi_a_idx ON medcontrol.medication_interactions(principle_a_id);
CREATE INDEX mi_b_idx ON medcontrol.medication_interactions(principle_b_id);

-- Seed inicial: top 50 interações graves (Anticoagulante x AINE, ISRS x IMAO, etc.)
-- (referência: ANVISA + BNF Brazilian National Formulary)
```

**RPC `check_interactions`:**
```sql
CREATE OR REPLACE FUNCTION medcontrol.check_interactions(p_patient_id UUID, p_med_name TEXT)
RETURNS SETOF JSONB AS $$
  -- Lookup principle_id do med_name via medications_catalog
  -- Cross-join com active treatments do paciente
  -- Buscar interações graves
  -- Retornar [{severity, description, with_med_name}]
$$ LANGUAGE sql SECURITY DEFINER;
```

**UI:** TreatmentForm submit verifica → mostra modal warning se grave (user pode override → audit_log).

**Aceite:** cadastrar Anticoagulante (Varfarina) num paciente que já tem AINE (Ibuprofeno) → modal aparece.

**Branch:** `feat/engine-adr-012-interactions`

---

#### P3.7 `cmed_class_to_group_mapping` (tabela DB — não JS)

```sql
CREATE TABLE medcontrol.cmed_class_to_group_mapping (
  cmed_class_normalized TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cmed_mapping_group_id CHECK (group_id IN (
    'antibiotico','antifungico','antiviral','antitermico_analgesico',
    'anti_inflamatorio','corticoide','anti_hipertensivo','antidiabetico',
    'antialergico','antidepressivo','ansiolitico','anticoagulante',
    'gastrointestinal','broncodilatador','vitamina','hormonal','outro','nao_classificado'
  ))
);

-- Seed: ~90 entries do scripts/lib/classify-medication.mjs CMED_CLASS_TO_GROUP
-- (gerar SQL via script: node -e "console.log(...generate sql)")

CREATE OR REPLACE FUNCTION medcontrol.resolve_group_from_cmed_class(p_cmed_class TEXT)
RETURNS TEXT AS $$
  SELECT group_id FROM medcontrol.cmed_class_to_group_mapping
  WHERE cmed_class_normalized = lower(extensions.unaccent(p_cmed_class))
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION medcontrol.update_medication_group_from_cmed_class()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cmed_class IS NOT NULL THEN
    NEW.group_id := medcontrol.resolve_group_from_cmed_class(NEW.cmed_class);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medications_catalog_cmed_group
  BEFORE INSERT OR UPDATE OF cmed_class ON medcontrol.medications_catalog
  FOR EACH ROW EXECUTE FUNCTION medcontrol.update_medication_group_from_cmed_class();
```

**Aceite:** INSERT em medications_catalog com `cmed_class='Macrolídeos'` → trigger auto-popula `group_id='antibiotico'`.

---

#### P3.8 `medication_categorization_suggestions` (aprendizado coletivo)

```sql
CREATE TABLE medcontrol.medication_categorization_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES medcontrol.medications_catalog(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  suggested_group_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('modal_top3', 'modal_picker_full', 'edit_existing')),
  was_consensual BOOLEAN,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX mcs_med_idx ON medcontrol.medication_categorization_suggestions(medication_id);
CREATE INDEX mcs_user_idx ON medcontrol.medication_categorization_suggestions(user_id);

ALTER TABLE medcontrol.medication_categorization_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcs_self ON medcontrol.medication_categorization_suggestions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY mcs_admin_select ON medcontrol.medication_categorization_suggestions
  FOR SELECT TO authenticated USING (medcontrol.is_admin());
```

**Loop de melhoria:** Admin painel mostra medicamentos com >=10 suggestions same group → propõe UPDATE em catálogo.

---

#### P3.9 RPC `suggest_categories_for_unknown` (pg_trgm fuzzy)

```sql
CREATE OR REPLACE FUNCTION medcontrol.suggest_categories_for_unknown(p_name TEXT, p_principio_ativo TEXT DEFAULT NULL, p_limit INT DEFAULT 3)
RETURNS TABLE (group_id TEXT, score FLOAT, reason TEXT) AS $$
  WITH candidates AS (
    -- Trigram match contra catálogo com group_id populado
    SELECT m.group_id, similarity(lower(extensions.unaccent(m.nome_comercial)), lower(extensions.unaccent(p_name))) AS sim
    FROM medcontrol.medications_catalog m
    WHERE m.group_id IS NOT NULL
    AND similarity(lower(extensions.unaccent(m.nome_comercial)), lower(extensions.unaccent(p_name))) > 0.3
    ORDER BY sim DESC LIMIT 20
  )
  SELECT c.group_id,
         AVG(c.sim) AS score,
         'similar a "' || (SELECT nome_comercial FROM medcontrol.medications_catalog WHERE group_id = c.group_id ORDER BY similarity(lower(extensions.unaccent(nome_comercial)), lower(extensions.unaccent(p_name))) DESC LIMIT 1) || '"' AS reason
  FROM candidates c
  GROUP BY c.group_id
  ORDER BY score DESC LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = medcontrol, extensions, public;
```

**Cliente consome em `CategoryHintModal.jsx`** quando autofill falha.

---

### RPCs faltantes

#### P3.10 `update_treatment_preserving_history`

```sql
CREATE OR REPLACE FUNCTION medcontrol.update_treatment_preserving_history(p_treatment_id UUID, p_patch JSONB)
RETURNS UUID AS $$
DECLARE v_old RECORD; v_new_id UUID;
BEGIN
  SELECT * INTO v_old FROM medcontrol.treatments WHERE id = p_treatment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT medcontrol.has_patient_access(v_old."patientId") THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Versão antiga: status='ended', parent_treatment_id=null já era
  UPDATE medcontrol.treatments SET status='ended', "updatedAt"=NOW() WHERE id = p_treatment_id;

  -- Cancela doses futuras pending da versão antiga
  UPDATE medcontrol.doses SET status='cancelled', "updatedAt"=NOW()
  WHERE "treatmentId" = p_treatment_id AND status='pending' AND "scheduledAt" > NOW();

  -- Versão nova: clone do row antigo + patch + parent_treatment_id + version+1
  INSERT INTO medcontrol.treatments (
    "userId", "patientId", "medName", unit, "intervalHours", "durationDays",
    "isContinuous", "startDate", "firstDoseTime", status,
    parent_treatment_id, version, group_id, cmed_class
  )
  SELECT
    v_old."userId", v_old."patientId",
    COALESCE(p_patch->>'medName', v_old."medName"),
    COALESCE(p_patch->>'unit', v_old.unit),
    COALESCE((p_patch->>'intervalHours')::INT, v_old."intervalHours"),
    COALESCE((p_patch->>'durationDays')::INT, v_old."durationDays"),
    COALESCE((p_patch->>'isContinuous')::BOOLEAN, v_old."isContinuous"),
    NOW(),
    COALESCE(p_patch->>'firstDoseTime', v_old."firstDoseTime"),
    'active',
    p_treatment_id,
    COALESCE(v_old.version, 1) + 1,
    COALESCE(p_patch->>'group_id', v_old.group_id),
    COALESCE(p_patch->>'cmed_class', v_old.cmed_class)
  RETURNING id INTO v_new_id;

  -- Gera doses novas (chamar create_treatment_with_doses internamente seria mais limpo, mas inline aqui)
  -- ... loop generation ...

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;
```

**Adicionar colunas:**
```sql
ALTER TABLE medcontrol.treatments
  ADD COLUMN parent_treatment_id UUID REFERENCES medcontrol.treatments(id),
  ADD COLUMN version INT NOT NULL DEFAULT 1;
CREATE INDEX treatments_parent_idx ON medcontrol.treatments(parent_treatment_id);
```

**Aceite:** Edit treatment → row antiga vira `ended`, nova vira `active v2`. History query retorna 2 rows.

---

#### P3.11 RPCs `end/pause/resume_treatment` dedicados (atualmente UPDATE direto)

```sql
CREATE OR REPLACE FUNCTION medcontrol.end_treatment(p_treatment_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT medcontrol.has_patient_access((SELECT "patientId" FROM medcontrol.treatments WHERE id = p_treatment_id)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE medcontrol.treatments SET status='ended', "updatedAt"=NOW() WHERE id = p_treatment_id;
  UPDATE medcontrol.doses SET status='cancelled', "updatedAt"=NOW()
  WHERE "treatmentId" = p_treatment_id AND status IN ('pending','overdue') AND "scheduledAt" > NOW();
  INSERT INTO medcontrol.audit_log (user_id, patient_id, action, metadata)
  VALUES (auth.uid(), (SELECT "patientId" FROM medcontrol.treatments WHERE id = p_treatment_id), 'treatment_ended', jsonb_build_object('treatment_id', p_treatment_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;

-- pause_treatment: similar, status='paused'
-- resume_treatment: status='active' + UPDATE doses cancelled→pending where scheduledAt > NOW()
```

**Cliente em `treatmentsService.js`** chama via `supabase.rpc('end_treatment', ...)` em vez de UPDATE direto.

---

#### P3.12 `validate_sos` separado de `register_sos_dose`

Atualmente lógica de validação está EMBUTIDA em `register_sos_dose`. Extrair pra permitir preview UI antes do submit.

```sql
CREATE OR REPLACE FUNCTION medcontrol.validate_sos(p_patient_id UUID, p_med_name TEXT, p_scheduled_at TIMESTAMPTZ)
RETURNS JSONB AS $$
DECLARE v_rule RECORD; v_recent_count INT; v_last_dose TIMESTAMPTZ; v_diff_hours FLOAT;
BEGIN
  -- (mesma lógica de register_sos_dose linhas 23-45 mas só retorna {allowed, reason, next_available_at})
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;
```

`register_sos_dose` chama `validate_sos` internamente.

---

#### P3.13 `export_my_data` (LGPD portabilidade)

```sql
CREATE OR REPLACE FUNCTION medcontrol.export_my_data()
RETURNS JSONB AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO medcontrol.audit_log (user_id, action) VALUES (v_uid, 'data_exported');
  RETURN jsonb_build_object(
    'profile', (SELECT row_to_json(p) FROM medcontrol.profiles p WHERE user_id = v_uid),
    'patients', (SELECT jsonb_agg(row_to_json(p)) FROM medcontrol.patients p WHERE "userId" = v_uid),
    'treatments', (SELECT jsonb_agg(row_to_json(t)) FROM medcontrol.treatments t WHERE "userId" = v_uid),
    'doses', (SELECT jsonb_agg(row_to_json(d)) FROM medcontrol.doses d WHERE "userId" = v_uid),
    'sos_rules', (SELECT jsonb_agg(row_to_json(s)) FROM medcontrol.sos_rules s WHERE "userId" = v_uid),
    'shares', (SELECT jsonb_agg(row_to_json(ps)) FROM medcontrol.patient_shares ps WHERE "ownerId" = v_uid OR "sharedWithUserId" = v_uid),
    'user_medications', (SELECT jsonb_agg(row_to_json(um)) FROM medcontrol.user_medications um WHERE user_id = v_uid),
    'subscription', (SELECT row_to_json(s) FROM medcontrol.subscriptions s WHERE "userId" = v_uid),
    'exported_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, public;
```

**Edge function `export-my-data`** wrap pra gerar PDF estruturado + JSON ao Storage temp (TTL 1h).

**UI em Settings → "Exportar meus dados"** botão dispara + email com link download.

---

#### P3.14 `has_patient_full_access` + `has_patient_mark_access` (granularidade share)

```sql
CREATE OR REPLACE FUNCTION medcontrol.has_patient_full_access(p_patient_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM medcontrol.patients WHERE id = p_patient_id AND "userId" = auth.uid())
  OR EXISTS (SELECT 1 FROM medcontrol.patient_shares WHERE "patientId" = p_patient_id AND "sharedWithUserId" = auth.uid() AND access_level = 'full');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION medcontrol.has_patient_mark_access(p_patient_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM medcontrol.patients WHERE id = p_patient_id AND "userId" = auth.uid())
  OR EXISTS (SELECT 1 FROM medcontrol.patient_shares WHERE "patientId" = p_patient_id AND "sharedWithUserId" = auth.uid() AND access_level IN ('mark', 'full'));
$$ LANGUAGE sql STABLE;
```

**Refatorar RLS policies** treatments INSERT/UPDATE → `has_patient_full_access`. doses mark via RPC → `has_patient_mark_access`.

---

#### P3.15 TTL share — `access_level` + `is_temporary` + `expires_at`

```sql
ALTER TABLE medcontrol.patient_shares
  ADD COLUMN access_level TEXT NOT NULL DEFAULT 'full' CHECK (access_level IN ('read','mark','full')),
  ADD COLUMN is_temporary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN last_extended_at TIMESTAMPTZ,
  ADD COLUMN invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD CONSTRAINT ttl_consistency CHECK (
    (is_temporary = false AND expires_at IS NULL) OR
    (is_temporary = true AND expires_at IS NOT NULL AND expires_at > invited_at)
  );

CREATE INDEX shares_expires_idx ON medcontrol.patient_shares(expires_at) WHERE is_temporary = true;
```

**RPCs:**
- `share_patient_by_email(patient_id, email, access_level, expires_at)` — atualizar pra novos params
- `update_share_access(share_id, new_level)` — owner-only
- `extend_temporary_share(share_id, new_expires_at)` — owner-only

**UI:**
- `SharePatientSheet.jsx` adiciona radio "Permanente / Temporário" + datepicker
- `<TemporaryShareBadge>` assimétrico no PatientDetail (owner vê cronômetro, caregiver não)

**Aceite:** Share temporário 1h expira automaticamente, paciente desaparece da lista do cuidador.

---

### Edge Functions faltantes

#### P3.16 `_shared/fcm.ts` consolidado (eliminar ~480 LOC duplicados)

Criar `supabase/functions/_shared/fcm.ts`:

```typescript
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getFcmAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  // ... PKCS8 RS256 signing logic (mover de daily-alarm-sync)
  cachedToken = { value: token, expiresAt: Date.now() + 3500 * 1000 };
  return token;
}

export interface SendOpts {
  token: string;
  data?: Record<string, string>;
  notification?: { title: string; body: string };
  android?: { priority?: 'HIGH'|'NORMAL'; collapse_key?: string; ttl?: string };
}

export async function sendFcm(opts: SendOpts): Promise<{ ok: boolean; error?: string }> {
  const token = await getFcmAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;
  // ... retry exp backoff + classify UNREGISTERED vs INVALID_ARGUMENT
}

export async function sendFcmBatch(opts: SendOpts[]): Promise<{ ok: number; fail: number }> { ... }
```

**Refatorar 6 functions** pra importar de `_shared/fcm.ts`.

**Aceite:** Grep `getFcmAccessToken` em `supabase/functions/` retorna 1 match (apenas em `_shared/fcm.ts`).

**Branch:** `refactor/shared-fcm-consolidation`

---

#### P3.17 Edge `treatment-changed-handler`

Trigger DB → Edge → FCM data-only pra todos devices do user re-agendarem.

```typescript
// supabase/functions/treatment-changed-handler/index.ts
import { sendFcmBatch } from '../_shared/fcm.ts';

Deno.serve(async (req) => {
  const body = await req.json();
  const treatmentId = body.record?.id;
  const userId = body.record?.userId;

  // Buscar push_subscriptions do user
  const { data: subs } = await adminSb.schema('medcontrol').from('push_subscriptions')
    .select('deviceToken').eq('userId', userId);

  const payloads = subs.map(s => ({
    token: s.deviceToken,
    data: { type: 'treatment_changed', treatment_id: treatmentId, user_id: userId },
    android: { priority: 'HIGH' }
  }));

  const result = await sendFcmBatch(payloads);
  return new Response(JSON.stringify(result), { status: 200 });
});
```

**Trigger SQL:**
```sql
CREATE OR REPLACE FUNCTION medcontrol.notify_treatment_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status OR NEW."intervalHours" != OLD."intervalHours" OR NEW."firstDoseTime" != OLD."firstDoseTime" THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/treatment-changed-handler',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = medcontrol, net, public;

CREATE TRIGGER trg_notify_treatment_changed
  AFTER UPDATE OF status, "intervalHours", "firstDoseTime" ON medcontrol.treatments
  FOR EACH ROW EXECUTE FUNCTION medcontrol.notify_treatment_changed();
```

**Java handler em `DosyMessagingService`:** `data.type=treatment_changed` → trigger `DoseSyncWorker.runOnce()` imediato.

**Aceite:** Edit treatment → todos devices recebem FCM em <5s + re-agendam local.

---

#### P3.18 Edge `expire-temporary-shares` (cron hourly)

```typescript
// supabase/functions/expire-temporary-shares/index.ts
Deno.serve(async () => {
  const { data: expired } = await adminSb.schema('medcontrol').from('patient_shares')
    .select('*').eq('is_temporary', true).lte('expires_at', new Date().toISOString());

  for (const share of expired ?? []) {
    // Delete row (trigger patient-unshare-handler dispara FCM)
    await adminSb.schema('medcontrol').from('patient_shares').delete().eq('id', share.id);
  }
  return new Response(JSON.stringify({ expired: expired?.length ?? 0 }));
});
```

**pg_cron schedule:**
```sql
SELECT cron.schedule('expire-temp-shares-hourly', '0 * * * *',
  $$SELECT net.http_post(url := current_setting('app.settings.supabase_url') || '/functions/v1/expire-temporary-shares', ...);$$
);
```

---

#### P3.19 Edge `notify-expiring-shares` (cron hourly)

Alerta owner 1h antes (sempre) + 24h antes (se share > 36h).

```typescript
Deno.serve(async () => {
  const now = new Date();
  const in1h = new Date(now.getTime() + 60*60*1000);
  const in24h = new Date(now.getTime() + 24*60*60*1000);

  // Shares expirando em ~1h: alerta owner
  const { data: nearExpire } = await adminSb.schema('medcontrol').from('patient_shares')
    .select('*').eq('is_temporary', true)
    .gte('expires_at', now.toISOString()).lte('expires_at', in1h.toISOString())
    .is('one_hour_notified_at', null);

  for (const share of nearExpire ?? []) {
    await sendFcmToUser(share.ownerId, {
      data: { type: 'share_expiring_1h', share_id: share.id, patient_id: share.patientId }
    });
    await adminSb.schema('medcontrol').from('patient_shares').update({ one_hour_notified_at: now.toISOString() }).eq('id', share.id);
  }

  // Similar pra 24h
  return new Response(JSON.stringify({ ok: true }));
});
```

**Adicionar colunas:** `one_hour_notified_at`, `twenty_four_hour_notified_at` em `patient_shares`.

---

#### P3.20 Edge `treatment-alert-setting-handler` (per-user-per-treatment)

Trigger AFTER INSERT/UPDATE em `treatment_user_alert_settings` → FCM data-only pro device do user re-agendar AlarmScheduler com novo nível.

---

#### P3.21 Edge `cmed-monthly-sync` (substitui scripts manuais)

```typescript
// supabase/functions/cmed-monthly-sync/index.ts
import { parseXlsx } from 'https://esm.sh/exceljs@4';

Deno.serve(async () => {
  // 1. Download XLSX CMED do mês corrente
  const cmedUrl = `https://www.gov.br/anvisa/.../xls_conformidade_site_${currentMonth}.xlsx`;
  const xlsxBuffer = await fetch(cmedUrl).then(r => r.arrayBuffer());

  // 2. Parse rows
  const rows = await parseXlsx(xlsxBuffer);

  // 3. Diff vs snapshot atual em Storage
  const { data: lastSnapshot } = await adminSb.storage.from('cmed-snapshots').download('latest.json');
  const diff = computeDiff(lastSnapshot, rows);

  // 4. Salva diff pra admin review
  await adminSb.storage.from('cmed-snapshots').upload(`pending-${currentMonth}.json`, JSON.stringify(diff));

  // 5. Email admin com link pra aprovação
  await sendAdminEmail({
    subject: `CMED sync ${currentMonth}: ${diff.added.length} adds, ${diff.removed.length} removes`,
    body: `Review at /admin/cmed-pending`
  });

  return new Response(JSON.stringify({ pending_review: diff }));
});
```

**Admin painel** em `/admin/cmed-pending` aprova → Edge function 2 (`cmed-apply`) executa migration auto-gerada.

---

#### P3.22 Edge `delete-account` audit final

Em `supabase/functions/delete-account/index.ts` após linha 88:

```typescript
const result = await adminSb.rpc('delete_my_account');
const delUser = await adminSb.auth.admin.deleteUser(user.id);

// AUDIT FINAL
await adminSb.schema('medcontrol').from('security_events').insert({
  user_id: user.id,
  event_type: 'delete_account_success',
  metadata: { rpc_ok: !result.error, auth_delete_ok: !delUser.error, ts: new Date().toISOString() },
  ip_address: clientIp,
  user_agent: userAgent
});

await adminSb.schema('medcontrol').from('audit_log').insert({
  user_id: user.id,
  action: 'account_deleted',
  metadata: { rpc_ok: !result.error, auth_delete_ok: !delUser.error }
});
```

---

#### P3.23 HMAC validation em webhooks `pg_net`

Criar `_shared/webhookHmac.ts`:

```typescript
import { crypto } from 'https://deno.land/std/crypto/mod.ts';

export async function validateHmac(req: Request, secret: string): Promise<boolean> {
  const sig = req.headers.get('x-signature');
  if (!sig) return false;
  const body = await req.text();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const computed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const computedHex = Array.from(new Uint8Array(computed)).map(b => b.toString(16).padStart(2, '0')).join('');
  return sig === computedHex;
}
```

**Trigger SQL atualiza pra incluir HMAC:**
```sql
PERFORM net.http_post(
  url := current_setting('app.settings.supabase_url') || '/functions/v1/dose-trigger-handler',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-signature', encode(hmac(payload::text, current_setting('app.settings.webhook_secret'), 'sha256'), 'hex')
  ),
  body := payload
);
```

**Edge function valida HMAC primeiro thing.**

---

#### P3.24 `patient-unshare-handler` defense-in-depth

Atualmente confia 100% em FCM. Adicionar 2 mecanismos:

1. **Server-side invalidation token:** quando unshare acontece, inserir em `pending_cache_invalidations` table. Caregiver app on resume verifica + força cleanup IDB.

```sql
CREATE TABLE medcontrol.pending_cache_invalidations (
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  reason TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, patient_id, "createdAt")
);
```

2. **JWT claim refresh:** após unshare, set custom claim que força client refresh do JWT next call (server rejeita queries com claim antigo).

**Aceite:** simular FCM falha (force-stop app) → na próxima abertura, paciente desaparece em <2s.

---

## 8. P4 — UI primitives Dosy v2 (backport completo)

### P4.1 `<MedicationPicker>` BottomSheet (substituir MedNameInput dropdown)

**Rationale:** 3 bugs estruturais reproduzíveis. Spec completa em `dosy-app/docs/07-DESIGN_SYSTEM.md §3.13`.

**Criar `src/components/dosy/MedicationPicker.jsx`** (novo):

```jsx
import { Sheet } from './surfaces';
import { Input } from './forms';

export default function MedicationPicker({ value, onChange, onSelectFull, patient }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [state, setState] = useState('idle'); // idle/searching/results/empty/error/offline

  // Bottom Sheet 80vh em mobile, dropdown inline em web (responsive)
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return (
      <>
        <Input value={value} onClick={() => setSheetOpen(true)} readOnly placeholder="Digite o medicamento" />
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} height="80vh">
          <SheetHeader title="Buscar medicamento" onClose={() => setSheetOpen(false)} />
          <Input autoFocus value={query} onChange={setQuery} placeholder="Digite nome ou princípio..." />
          {state === 'searching' && <LoadingExplicit text="Buscando..." />}
          {state === 'results' && (
            <ResultList>
              {results.map(r => (
                <MedicationResultRow key={r.id} med={r}
                  onPointerDown={(e) => { e.preventDefault(); onSelectFull(r); setSheetOpen(false); }} />
              ))}
            </ResultList>
          )}
          {state === 'empty' && <EmptyState query={query} />}
          <SheetFooter>
            <Button kind="ghost" onClick={() => { onChange(query); setSheetOpen(false); }}>
              + Continuar com "{query}" digitado
            </Button>
          </SheetFooter>
        </Sheet>
      </>
    );
  }

  // Desktop: dropdown inline com Portal + auto-flip
  return <DesktopAutocomplete ... />;
}
```

**Substituir uso em** `TreatmentForm.jsx`, `SOS.jsx`:
```jsx
- <MedNameInput value={...} onChange={...} />
+ <MedicationPicker value={...} onChange={...} onSelectFull={...} />
```

**Deletar `src/components/MedNameInput.jsx`** após migração.

**Validações device obrigatórias:**
- Pixel 6: teclado virtual NÃO cobre resultados
- Samsung A54: scroll dentro sheet sem fechar
- Xiaomi Redmi 12: tap em result registra
- Persona 6 simulada (font scaling 1.5×): targets ≥56dp
- Voice input: query preservada

**Aceite:** 0 incidências do bug "sheet some quando arrasta" em 7 dias prod.

**Branch:** `refactor/medication-picker-bottomsheet`

---

### P4.2 `<CategoryBadge>` display-only

```jsx
// src/components/dosy/CategoryBadge.jsx
export default function CategoryBadge({ groupId, size = 'md', variant = 'tinted' }) {
  const group = MED_GROUPS.find(g => g.id === groupId) ?? MED_GROUPS.find(g => g.id === 'nao_classificado');
  const colorVar = group.color;

  const styles = {
    md: { height: 26, fontSize: 12, paddingX: 10 },
    sm: { height: 22, fontSize: 11, paddingX: 8 }
  }[size];

  if (variant === 'outlined') {
    return (
      <span style={{
        height: styles.height, fontSize: styles.fontSize, padding: `0 ${styles.paddingX}px`,
        border: `1px solid color-mix(in srgb, ${colorVar} 30%, transparent)`,
        color: colorVar, borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6
      }}>
        <Dot color={colorVar} />{group.label}
      </span>
    );
  }
  return (
    <span style={{
      height: styles.height, fontSize: styles.fontSize, padding: `0 ${styles.paddingX}px`,
      background: `color-mix(in srgb, ${colorVar} 12%, transparent)`,
      color: colorVar, borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6
    }}>
      <Dot color={colorVar} />{group.label}
    </span>
  );
}
```

**Substituir 4+ renderings inline** em MedNameInput, DoseHistory, Analytics.

---

### P4.3 `<Section>` collapsable unificada

Consolidar `TreatmentSection` (PatientDetail), `CollapsibleSection` (TreatmentList), regras section (SOS).

```jsx
// src/components/dosy/Section.jsx
export default function Section({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="dosy-section">
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        <h3>{title}</h3>
        {count !== undefined && <Chip>{count}</Chip>}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
```

---

### P4.4 `<FilterChip>` + `<DataChip>` (consolidar 4 `chipStyle()` locais)

```jsx
// src/components/dosy/Chip.jsx
export function FilterChip({ active, onClick, children, count }) { ... }
export function DataChip({ avatar, label, onRemove }) { ... }
```

**Refatorar Analytics, Reports, TreatmentList, SOS** pra usar.

---

### P4.5 `<Button loading>` inline (substituir `disabled={isPending}`)

```jsx
// Em buttons.jsx, adicionar prop `loading`
export function Button({ kind = 'primary', loading, children, onClick, ...props }) {
  return (
    <button onClick={onClick} aria-busy={loading} {...props}>
      {loading && <Spinner size="sm" />}
      <span style={{ opacity: loading ? 0.7 : 1 }}>{children}</span>
    </button>
  );
}
```

**Refatorar Dashboard, TreatmentForm, SOS, Settings mutations:**
```jsx
- <Button disabled={mutation.isPending}>Criar</Button>
+ <Button loading={mutation.isPending}>Criar</Button>
```

---

### P4.6 `<List>` virtualizado

Consolidar 5 implementações ad hoc (Dashboard, Patients, PatientDetail, DoseHistory, TreatmentList).

```jsx
// src/components/dosy/List.jsx
import { useVirtualizer } from '@tanstack/react-virtual';

export default function List({ items, renderItem, emptyState, loadingState, errorState, virtualizeAt = 50 }) {
  if (loadingState) return loadingState;
  if (errorState) return errorState;
  if (items.length === 0) return emptyState;

  if (items.length < virtualizeAt) {
    return <div>{items.map(renderItem)}</div>;
  }

  // Virtualized
  const parentRef = useRef();
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5
  });
  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map(vRow => (
          <div key={vRow.key} style={{ position: 'absolute', top: vRow.start, width: '100%' }}>
            {renderItem(items[vRow.index])}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### P4.7 3 primitives Dosy NOVOS

#### P4.7a `<AlertLevelToggle>` 3-segmentos
Per-treatment crítico/push/silent. Conecta com `treatment_user_alert_settings` (P3.4).

#### P4.7b `<CriticalInertBadge>`
Quando switch global Alarme Crítico OFF + tratamento marcado Crítico → mostra badge "Crítico inerte" + tooltip.

#### P4.7c `<TemporaryShareBadge>` assimétrico
Owner vê cronômetro `-- 3d 4h 12min`. Caregiver vê apenas badge "Compartilhamento temporário" SEM tempo.

---

### P4.8 `<CategorySuggestionModal>` automático no autofill-fail (mover do submit)

Hoje `CategoryHintModal` dispara NO SUBMIT. Mover pra disparar AUTOMATICAMENTE quando `useClassifyMedication` retorna `group_id=NULL`:

```jsx
// Em TreatmentForm.jsx
const classify = useClassifyMedication(form.medName);

useEffect(() => {
  if (classify.data && !classify.data.group_id && !form.group_id) {
    setHintModalOpen(true); // dispara automaticamente
  }
}, [classify.data]);
```

---

### P4.9 Drill-down Analytics donut → classe CMED

Em `Analytics.jsx` no card "Doses por categoria":

```jsx
<Donut data={groupCounts} onSliceClick={(groupId) => setDrillDownGroup(groupId)} />
{drillDownGroup && (
  <Sheet open onClose={() => setDrillDownGroup(null)}>
    <h3>{MED_GROUPS.find(g => g.id === drillDownGroup).label}</h3>
    <CmedClassBreakdown groupId={drillDownGroup} period={period} />
  </Sheet>
)}
```

`CmedClassBreakdown` chama RPC nova `cmed_class_stats(group_id, period)`.

---

### P4.10 Card "Última dose de cada categoria" no topo Histórico

```jsx
// Em DoseHistory.jsx topo
<LastDoseByCategory userId={user.id} />

// Componente
function LastDoseByCategory({ userId }) {
  const { data } = useQuery({
    queryKey: ['last-dose-by-group', userId],
    queryFn: () => supabase.rpc('last_dose_per_group', { p_user_id: userId, p_limit: 5 })
  });
  return (
    <Card variant="elevated">
      <SectionTitle>Última dose de cada categoria</SectionTitle>
      <List items={data} renderItem={r => (
        <Row>
          <CategoryBadge groupId={r.group_id} />
          <span>{r.med_name}</span>
          <span>{formatRelative(r.last_actual_time)}</span>
        </Row>
      )} />
    </Card>
  );
}
```

RPC nova:
```sql
CREATE OR REPLACE FUNCTION medcontrol.last_dose_per_group(p_user_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (group_id TEXT, med_name TEXT, last_actual_time TIMESTAMPTZ) AS $$
  SELECT DISTINCT ON (group_id) group_id, "medName", "actualTime"
  FROM medcontrol.doses
  WHERE "userId" = p_user_id AND status = 'done' AND group_id IS NOT NULL
  ORDER BY group_id, "actualTime" DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;
```

---

### P4.11 Botão "Compartilhar pro médico" no Histórico

```jsx
// Em DoseHistory.jsx header
<Button kind="primary" onClick={() => setShareSheetOpen(true)}>
  <Icon name="share-2" /> Compartilhar pro médico
</Button>

<Sheet open={shareSheetOpen}>
  <h3>Como compartilhar?</h3>
  <Button onClick={() => shareScreenshot()}>Tirar screenshot</Button>
  <Button onClick={() => sharePdf()}>Gerar PDF</Button>
</Sheet>
```

`sharePdf` reusa jsPDF/html2canvas que Reports.jsx já usa, mas gera PDF compacto 1-2 páginas com filtros atuais aplicados.

---

### P4.12 Reports.jsx integrar categoria (PDF + CSV)

Atualmente Reports.jsx zero menções a categoria. Adicionar:

```jsx
// Reports.jsx
<FilterPanel>
  <CategoryPicker value={filterGroup} onChange={setFilterGroup} mode="filter" multiSelect />
</FilterPanel>

<Card title="Resumo por categoria">
  <Table>
    {groupSummary.map(g => (
      <Row>
        <CategoryBadge groupId={g.group_id} />
        <span>{g.total_doses}</span>
        <span>{g.percentage}%</span>
        <span>Top: {g.top_med}</span>
      </Row>
    ))}
  </Table>
</Card>
```

CSV export adiciona coluna `cmed_class`. PDF inclui breakdown.

---

### P4.13 Tokens / a11y polish (~10 sub-items consolidados)

- Audit cores hex hardcoded → tokens (`#3F9E7E` → `var(--dosy-success)`)
- Audit font-sizes `.5` → escala fixa
- Aplicar `shouldReduceMotion()` em todas animações Dashboard/Analytics/SOS/Onboarding
- Touch targets ≥56dp em BottomNav NavLink, Settings Row, Skip-link
- Skip-link `bg-brand-600` → `var(--dosy-primary)`
- Substituir `window.confirm` em TreatmentList por `<ConfirmDialog>`
- `Analytics.jsx` filtrar cancelled doses (bug #0005 fix)
- Foreground accessibility: `aria-busy`, `aria-live="polite"` em loading states
- Lint rule: banir hex em JSX (`no-restricted-syntax`)
- Lint rule: banir `fontSize: X.5`

---

### P4.14 Eliminar código morto UI

```bash
rm src/hooks/useRealtime.js          # 200+ LOC dead (substituído por useRealtimePatient em P1.9)
rm src/components/BellAlerts.jsx     # 188 LOC, AppHeader optou pelos ícones diretos
rm src/components/AnimatedRoutes.jsx # 56 LOC, não importado
rm src/components/Dropdown.jsx       # 83 LOC, vestigial uso .input legacy
rm src/components/PatientCard.jsx    # 23 LOC, quase não usado
```

Verificar via Grep que nenhum importa antes.

---

## 9. P5 — Test stack completo

### P5.1 pgTAP em `supabase/tests/`

```bash
mkdir -p supabase/tests
cat > supabase/tests/001_confirm_dose.sql <<'EOF'
BEGIN;
SELECT plan(8);

-- Setup test data
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'test@dosy.com');
INSERT INTO medcontrol.patients (id, "userId", name, age) VALUES (...);
INSERT INTO medcontrol.treatments (id, "userId", "patientId", "medName", unit, "startDate", status) VALUES (...);
INSERT INTO medcontrol.doses (id, "userId", "treatmentId", "patientId", "medName", unit, "scheduledAt", status) VALUES (..., 'pending');

-- Test 1: happy path
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001"}';
SELECT ok((SELECT (medcontrol.confirm_dose('...dose_id...', NOW(), null))->>'ok')::boolean, 'confirm_dose happy path returns ok=true');

-- Test 2: idempotência (confirmar já confirmada)
SELECT is((medcontrol.confirm_dose('...dose_id...', NOW(), null))->>'code', '409', 'returns 409 if already done');

-- Test 3: returns current_state em 409
SELECT isnt((medcontrol.confirm_dose('...done_dose...', NOW(), null))->'current_state', null, '409 returns current_state');

-- Test 4: RLS bloqueia user errado
SET LOCAL request.jwt.claims = '{"sub": "...different_user..."}';
SELECT throws_like('SELECT medcontrol.confirm_dose(''...other_user_dose...'', NOW(), null)', '%forbidden%', 'RLS denies other user');

-- ... 4 more tests

SELECT * FROM finish();
ROLLBACK;
EOF

# Rodar
supabase test db
```

Criar tests pra cada RPC: `skip_dose`, `undo_dose`, `register_sos_dose`, `create_treatment_with_doses`, `update_treatment_preserving_history`, `end_treatment`, `share_patient_by_email`, `unshare_patient`, `extend_temporary_share`, `delete_my_account`, `export_my_data`, `effective_tier`, `admin_grant_tier`, `has_patient_access`, `validate_sos`, `check_interactions`.

**Aceite:** `supabase test db` passa 100+ tests + CI gate (PR rejected se RPC nova sem test).

---

### P5.2 Deno test em Edge functions

```typescript
// supabase/functions/dose-trigger-handler/index.test.ts
import { assertEquals } from 'https://deno.land/std/assert/mod.ts';
import { handler } from './index.ts';

Deno.test('dose-trigger-handler INSERT pending → schedule_alarms FCM', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({
      type: 'INSERT',
      record: { id: '...', userId: '...', status: 'pending', scheduledAt: '2026-06-01T10:00:00Z' }
    })
  });
  // Mock sendFcm
  const res = await handler(req);
  const json = await res.json();
  assertEquals(json.ok, true);
  // assert FCM was called with action=schedule_alarms
});
```

Criar tests pra cada function: `daily-alarm-sync`, `dose-trigger-handler`, `patient-share-handler`, `patient-unshare-handler`, `delete-account`, `treatment-changed-handler`, `expire-temporary-shares`, `notify-expiring-shares`, `cmed-monthly-sync`.

---

### P5.3 Vitest cobertura state machines 100%

Criar `src/core/state-machines/doses.ts` (novo):

```typescript
type DoseStatus = 'pending' | 'overdue' | 'done' | 'skipped' | 'cancelled';

const VALID_TRANSITIONS: Record<DoseStatus, DoseStatus[]> = {
  pending: ['overdue', 'done', 'skipped', 'cancelled'],
  overdue: ['done', 'skipped', 'cancelled'],
  done: ['pending'], // undo
  skipped: ['pending'], // undo
  cancelled: ['pending'] // resume_treatment
};

export function canTransition(from: DoseStatus, to: DoseStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

Test:
```typescript
import { describe, it, expect } from 'vitest';
import { canTransition } from './doses';

describe('Dose state machine', () => {
  it.each([
    ['pending', 'done', true],
    ['pending', 'cancelled', true],
    ['done', 'pending', true],
    ['done', 'skipped', false],
    ['cancelled', 'done', false],
    // ... all combinations
  ])('canTransition(%s, %s) == %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});
```

Mesma estrutura para state machines de `treatments`, `subscriptions`, `shares`.

**Configurar threshold** em `vitest.config.js`:
```javascript
coverage: {
  thresholds: {
    'src/core/state-machines/**': { lines: 100, branches: 100, functions: 100, statements: 100 }
  }
}
```

---

### P5.4 Vitest `scheduler.js` (healthcare-critical 0% atual)

`src/services/notifications/scheduler.test.js`:

```javascript
describe('rescheduleAll', () => {
  it('DnD window honrada — não agenda alarme em DnD', async () => {
    setPrefs({ dnd_enabled: true, dnd_start: '22:00', dnd_end: '07:00' });
    const now = new Date('2026-06-01T23:30:00');
    await rescheduleAll([{ id: '1', scheduledAt: '2026-06-02T01:00:00' }]);
    // Assert: tray scheduled, NOT critical alarm
  });

  it('criticalOff count correto — todos tratamentos viram tray', ...);
  it('signature guard previne reagendamento desnecessário', ...);
  it('cancelAll chamado antes de novo agendamento', ...);
  it('Throttle 30s + trailing run', ...);
});
```

**Meta:** ≥60% coverage em `scheduler.js`.

---

### P5.5 Vitest `mutationRegistry.js` (694 LOC, 0% atual)

Test cada mutation: onMutate patch, onSuccess clear gate + invalidate, onError rollback + snackbar.

---

### P5.6 5 cenários E2E top (Dosy v2 §3.8) — gaps 3, 4, 5

Criar `scripts/qa/flows/`:

- `cold-start-alarm-fire.spec.mjs` — Cold start → AlarmActivity → tap "Tomada" → DB confirma
- `offline-queue-drain.spec.mjs` — Offline → Confirm 3 doses → Online → Queue drain → DB tem 3 done
- `end-treatment-cancels-alarm.spec.mjs` — End treatment → Alarm cancelado → Next NÃO dispara

---

### P5.7 5 cenários E2E v1.1 (gaps 7, 9, 10)

- `share-ttl-expira.spec.mjs` — Share temporário 1min → wait → cuidador cleanup
- `update-mandatory-modal.spec.mjs` — Set is_mandatory=true em app_releases → next launch → modal bloqueante
- `logout-cleanup-sharedprefs.spec.mjs` — Logout → SharedPrefs limpos + alarms cancelled

---

### P5.8 Regression tests consolidados por bug

Estrutura `tests/regression/medcontrol-bugs/`:
- `nb4-force-kill-dose.test.js` (consolida 7 NB-4 variants)
- `0001-fcm-token-clear-reload.test.js`
- `0005-cancelled-pollution-stats.test.js`
- `0009-share-sheet-loading-infinite.test.js`
- `0010-banner-version-vs-semver.test.js`
- `157-realtime-storm.test.js` (assert: realtime sob demanda só PatientDetail)
- `205-refresh-token-storm.test.js`
- `215-prefs-race-scheduler.test.js`
- `229-snooze-persist-reboot.test.js`
- `272-default-range-dashboard.test.js`
- `275-throttle-persist-1000ms.test.js`
- `287-killed-caregiver-gap.test.js`
- `297-unshare-lgpd-cleanup.test.js`
- `300-precheck-http-alarm-receiver.test.js`

**DoD §2:** novo bug em prod = regression test escrito antes do fix (red → green).

---

### P5.9 Sample validation 50 brand-names BR

```javascript
// tests/integration/medication-catalog-coverage.test.js
const BRANDS = [
  { name: 'Clavulin BD 875mg', expected_group: 'antibiotico' },
  { name: 'Novalgina 500mg', expected_group: 'antitermico_analgesico' },
  { name: 'Tylenol 750mg', expected_group: 'antitermico_analgesico' },
  { name: 'Dorflex', expected_group: 'antitermico_analgesico' },
  { name: 'Buscopan Composto', expected_group: 'antitermico_analgesico' },
  { name: 'Aerolin Spray', expected_group: 'broncodilatador' },
  { name: 'Losartana 50mg', expected_group: 'anti_hipertensivo' },
  { name: 'Omeprazol 20mg', expected_group: 'gastrointestinal' },
  { name: 'Puran T4 25mcg', expected_group: 'hormonal' },
  { name: 'Selene', expected_group: 'hormonal' },
  // ... 40 mais
];

test.each(BRANDS)('%s deve retornar group_id=%s no autocomplete', async ({ name, expected_group }) => {
  const { data } = await supabase.rpc('search_medications', { q: name.substring(0, 5), lim: 5 });
  const match = data.find(m => m.nome_comercial.toLowerCase().includes(name.toLowerCase().split(' ')[0]));
  expect(match?.group_id).toBe(expected_group);
});
```

---

### P5.10-P5.15 (consolidados)

- CI workflow rodar `npm test` + `supabase test db` + `deno test supabase/functions` em cada PR
- Coverage threshold global `src/core/**` 90%+ + `src/services/**` 60%+
- Sample validation script `validate-medications-seed.ts` em CI
- Test pra Sentry beforeSend strip (validar P0.3)
- Test pra PostHog consent gate (validar P0.4)
- Lighthouse CI (a11y + performance score) em PR

---

## 10. P6 — Documentação (gaps absorvidos)

### P6.1 ADR-005 Google Play "Saúde e fitness" (não Medicina)

Criar `context/decisoes/2026-XX-XX-google-play-categoria-saude.md` documentando:
- Decisão: Console categoria "Saúde e fitness"
- Texto loja: descrever como "medication reminder consumer wellness" (não medical device)
- Disclaimers obrigatórios: "Não substitui orientação médica"
- Permissions justificadas: USE_EXACT_ALARM (medication reminder Play policy permite)
- Histórico: rejection 2026-05-06 + resolução

---

### P6.2 Anti-pattern nomeado `disabled={anyMutationPending}` coletivo

Documentar em `context/PROJETO.md` ou novo `context/anti-patterns.md`:

```markdown
## Anti-pattern: `disabled={anyMutationPending}` coletivo em fila de doses

**Sintoma:** botão "Tomada" preso enquanto outra mutation pending em qualquer dose.

**Causa:** todas mutations compartilham 1 estado `isPending` global.

**Solução:** per-dose `pendingDoseId` ref + checagem `pendingDoseId === thisDose.id`.

**Origem:** `MultiDoseModal.jsx` v0.2.3.13 — fix Fase 1 Refactor_Full.
```

---

### P6.3 Inventário 10 componentes unificáveis (Refactor_Full §11) com props + LOC

Documentar em `context/PROJETO.md` ou `docs/component-inventory.md`:

| Component | LOC atual | LOC após adopção | Economia | Status |
|---|---|---|---|---|
| EmptyState | 4 variantes built-in 115 LOC | 80 LOC | 35 | ✅ adopted |
| DateRangeChips | 62 | 62 | 0 | ✅ adopted |
| StatGrid | 39 | 39 | 0 | ✅ adopted |
| FormRow | 90 | -150 (consolidates) | 60 | 🟡 pending |
| TodayDosesStat | 94 | -50 | 44 | 🟡 pending |
| MedicationHistoryGrid | 136 | -200 | 64 | 🟡 pending |
| TreatmentCard | 102 | -300 | 198 | 🟡 pending |
| DoseList | 87 | -250 | 163 | 🟡 pending |
| FilterPanel | 175 | -200 | 25 | 🟡 pending |
| DoseSheet (DoseModal + MultiDoseModal) | 55 + 306 + 262 | 200 | 423 | 🟡 pending |
| **TOTAL economia** | | | **~1300 LOC** | |

---

### P6.4 Spec técnico alarme+push detalhado

Criar `docs/alarm-scheduling-v0.2.6.md` atualizando `v0.2.3.1`:

- 5 caminhos scheduling (JS rescheduleAll DEPRECATED, mutation cache patch, DB trigger, daily-alarm-sync cron, Java DoseSyncWorker)
- 3 mecanismos fire (M1 AlarmReceiver, M2 TrayNotificationReceiver, M3 Capacitor LocalNotifications REMOVIDO em P2.4)
- Branch logic ALARM_PLUS_PUSH / PUSH_DND / PUSH_CRITICAL_OFF
- Re-rota fire-time consultando SharedPrefs (Fix B)
- Pre-check HTTP (#300)
- Statement-level trigger batch FCM

---

### P6.5 Decisão consciente "não criar cron 1min"

`context/decisoes/2026-XX-XX-no-cron-1min.md`:

> **Decisão:** Não criar cron Edge Function de frequência <5min.
>
> **Origem:** `dose-fire-time-notifier` custou 1440 invocações/dia sem ganho real (substituído por pre-check HTTP em AlarmReceiver + WorkManager 24h).
>
> **Alternativas:** Pre-check HTTP em fire time, WorkManager periodic, trigger DB AFTER UPDATE.

---

### P6.6 ADR-006 single-dev "1 sessão = 1 release branch"

Já existe em `context/decisoes/2026-05-01-001-modelo-1-sessao-1-release-branch.md`. Manter atualizado.

---

### P6.7 Datasets brand_map BR consolidar

Criar `scripts/data/brand_map_br.json`:

```json
{
  "Aerolin": { "principio": "Salbutamol", "group_id": "broncodilatador" },
  "Clenil": { "principio": "Beclometasona", "group_id": "broncodilatador" },
  "Decadron": { "principio": "Dexametasona", "group_id": "corticoide" },
  "Mounjaro": { "principio": "Tirzepatida", "group_id": "antidiabetico" },
  "Ozempic": { "principio": "Semaglutida", "group_id": "antidiabetico" },
  "Zoloft": { "principio": "Sertralina", "group_id": "antidepressivo" },
  "Lexapro": { "principio": "Escitalopram", "group_id": "antidepressivo" }
}
```

Consumido por `ingest-cmed.mjs` (P3.21) como override + por `classify_medication_robust` tier 0.

---

### P6.8 Aplicar Regras 16+17 do Dosy v2

- **Regra 16:** Histórico em ordem reversa cronológica em TODOS docs (prepend no TOPO)
- **Regra 17:** Pendências preliminares no doc destino (não em `context/CHECKLIST.md` gigante)

Auditar cada doc em `context/` e converter histórico pra reverso. Migrar entries `CHECKLIST.md` que são notas preliminares pra docs destino respectivos.

---

### P6.9-P6.14 (consolidados)

- ADR Resend SMTP atualizar com rate limit 2/h Supabase built-in
- Doc beta feedback form Google Forms spec
- Egress audit playbook F1-F8 patterns
- Documentar realidade vs spec contrato bridge JS↔Java
- Adicionar PR template checklist (egress, RLS, cache key, state machine, lint zero)
- Atualizar `STATE.md` header: "Status: Em alinhamento ativo com Dosy v2 docs"

---

## 11. P7 — Limpeza estrutural

### P7.1 Deletar scripts redundantes (17 arquivos)

```bash
cd "G:\00_Trabalho\01_Pessoal\Apps\medcontrol_v2"
rm scripts/qa_tap_mais.mjs scripts/qa_nb4_test.mjs scripts/qa_nb4_open.mjs scripts/qa_nb4_normal.mjs scripts/qa_nb4_kill.mjs scripts/qa_nb4_kill_v2.mjs scripts/qa_bug4_b.mjs scripts/qa_v12_login.mjs scripts/qa_v12_tap.mjs scripts/qa_v12_tap_strong.mjs scripts/qa_v12_patch_capacitor.mjs scripts/qa_unshare.mjs scripts/qa_skip_login.mjs scripts/flow_v3.mjs scripts/caregiver_step2_share.mjs scripts/cdp_click_entrar.mjs scripts/cdp_login_port.mjs
git commit -am "chore(scripts): remove 17 scripts redundantes"
```

### P7.2 Mover scripts pra `_archive/` (11 arquivos)

```bash
mkdir -p scripts/_archive
mv scripts/qa_owner_drill.mjs scripts/qa_seq.mjs scripts/qa_a2_owner_pac.mjs scripts/qa_v12_validate.mjs scripts/qa_v12_inject.mjs scripts/qa_v12_install_observer.mjs scripts/qa_v12_toast_capture.mjs scripts/qa_v12_patch_capacitor2.mjs scripts/qa_final_login.mjs scripts/qa_nb4_final.mjs scripts/qa_nb4_kill_v3.mjs scripts/_archive/
echo "scripts/_archive/**" >> .gitignore  # opcional gitignored
git commit -am "chore(scripts): mover 11 scripts históricos pra _archive/"
```

### P7.3 Renomear `qa_scroll_up.mjs` → `qa_swipe_down.mjs`

(impl faz swipe down — naming confuso)

### P7.4 Fix hard-coded keys em `appium_login.mjs`

Mover `sb_publishable_*` inline → `process.env.SUPABASE_ANON_KEY` em todos os 3 scripts.

### P7.5 Remover AdMob meta-data se não usa

Verificar AdMob ainda ativo. Se não, remover `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" ... />` do Manifest.

### P7.6 Remover `config.xml` Cordova legacy

`rm android/app/src/main/res/xml/config.xml` (Cordova já não usa, vestígio).

### P7.7 Consolidar `scripts/data/` estrutura

```bash
mkdir -p scripts/automation scripts/data scripts/qa scripts/tests
mv scripts/ingest-*.mjs scripts/backfill-*.mjs scripts/gen-icons.mjs scripts/copy-apk-to-dist.cjs scripts/automation/
# qa/ + tests/ conforme P2.13
```

### P7.8 `CHECKLIST.md` 490KB — fragmentar

Estrutura:
```
context/checklist/
├── README.md (índice)
├── 2026-04-fase0.md
├── 2026-05-v0.2.3.x.md
├── 2026-05-v0.2.4.0-categorias.md
├── 2026-05-v0.2.5.0-ux-refactor.md
└── archived/
    └── pre-2026-05.md
```

### P7.9 Mover `dosy-release.keystore` para fora do repo

`mv dosy-release.keystore ~/.keystores/dosy-release.keystore`
`android/keystore.properties` aponta path absoluto.

### P7.10 Adicionar `.editorconfig`

```ini
root = true
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
[*.gradle]
indent_size = 4
[*.java]
indent_size = 4
[*.md]
trim_trailing_whitespace = false
```

### P7.11 ESLint `--max-warnings` 80 → 0 (gradual em 8 PRs)

Branch `chore/eslint-warnings-cleanup` reduzindo 80 → 70 → 60 → 50 → 40 → 30 → 20 → 10 → 0 em PRs separados, cada um corrigindo categorias de warnings.

### P7.12 Paralelizar jobs CI

`.github/workflows/ci.yml`:
```yaml
jobs:
  lint: { ... }
  test: { ... }
  build: { ... }
  gitleaks: { ... }
# Removidos sequenciais
```

CI time -40%.

### P7.13 Adicionar `@sentry/react` `^` + commit-msg hook commitlint

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional
echo "module.exports = { extends: ['@commitlint/config-conventional'] };" > commitlint.config.js
echo "npx commitlint --edit \$1" > .husky/commit-msg
chmod +x .husky/commit-msg
```

---

## 12. Critérios gerais de aceite (release-gate)

Antes de declarar este roteiro "completo" ou parcial pra release, verificar:

### Release v0.2.6.0 — após P0 + P1.1-P1.7 fechados
- [ ] `supabase db reset` recria estado prod sem erros
- [ ] Sentry events 7 dias sem PII (manual check 5 eventos)
- [ ] User novo passa por consent banner
- [ ] `git log --all -- "*.keystore"` vazio
- [ ] `reconcileDoses` ativo (Sentry breadcrumb)
- [ ] Conflict 409 retorna current_state (validar em emulator dual)
- [ ] Snackbar persistente em onError

### Release v0.3.0.0 — após P2 fechado
- [ ] Refactor_Full Fases 2-5 todas completas
- [ ] Cliente JS não reagenda alarmes (server-side único)
- [ ] `dose-fire-time-notifier` deletado
- [ ] Capacitor LocalNotifications removido
- [ ] 6 componentes Dosy adopted em pelo menos 1 página cada
- [ ] CI tempo <5min

### Release v0.4.0.0 — após P3 fechado
- [ ] Engine ADR-012 funcionando (interactions check em UI)
- [ ] TTL share com access_level granular
- [ ] CMED ingest cron mensal automático
- [ ] LGPD compliance: export_my_data + audit_log + consent gate

### Release v0.5.0.0 — após P4 fechado
- [ ] `<MedicationPicker>` BottomSheet em mobile (3 bugs eliminados)
- [ ] Todos primitives Dosy adopted
- [ ] Theme.css legacy eliminado
- [ ] A11y Persona 6 audit passa

### Release v0.6.0.0 — após P5 fechado
- [ ] pgTAP 100+ tests
- [ ] Deno tests cobrem todas Edge functions
- [ ] Coverage `core/state-machines/**` 100%, `services/**` 60%+
- [ ] 10 cenários E2E top + v1.1 cobertos
- [ ] Sample validation 50 brand-names BR passa

### Release v1.0.0 — após P6 + P7 fechados
- [ ] Todos docs Dosy v2 absorvidos (15+ items)
- [ ] Estrutura `scripts/` consolidada (<15 ativos raiz)
- [ ] ESLint `--max-warnings=0`
- [ ] Marca paridade conceitual com Dosy v2 spec

---

## 13. Cadência sugerida

**Sprint 1 (semana 1-2):** P0 completos (6 items)
**Sprint 2 (semana 3-4):** P1.1-P1.7 + começa P1.8-P1.14
**Sprint 3 (semana 5-6):** P1.14 + P2 Fase 2 alarmes (P2.1-P2.5)
**Sprint 4 (semana 7-8):** P2 Fase 3 + Fase 4 (P2.6-P2.15)
**Sprint 5 (semana 9-10):** P2 Fase 5 (P2.16-P2.18) + P3 tabelas (P3.1-P3.9)
**Sprint 6 (semana 11-13):** P3 RPCs + Edges (P3.10-P3.24)
**Sprint 7 (semana 14-16):** P4 UI primitives core (P4.1-P4.6)
**Sprint 8 (semana 17-18):** P4 UI primitives restantes (P4.7-P4.14)
**Sprint 9 (semana 19-21):** P5 testes (15 items)
**Sprint 10 (semana 22-23):** P6 docs + P7 limpeza
**Buffer (semana 24):** validações device exaustivas + ship v1.0.0

**Total estimado:** 6 meses solo dev. Pode acelerar com pair-programming Claude + user revisão.

---

## 14. Referências cruzadas

**Relatório completo de análise:**
`G:\00_Trabalho\01_Pessoal\Apps\dosy-app\docs\_archive\medcontrol-v2-analysis-2026-05-22.md`

**Docs Dosy v2 mais úteis pra referência:**
- `dosy-app/docs/workflow/RULES.md` — 17 regras (Regra 13 Appium W3C, Regra 15 Caveman OFF, Regra 16 histórico reverso, Regra 17 pendências no doc destino)
- `dosy-app/docs/adr/013-optimistic-ui-sync-resiliente.md` — reconcileDoses + 409 explícito
- `dosy-app/docs/adr/015-catalogo-cmed-hierarquia.md` — design Categorias final
- `dosy-app/docs/16-INTEGRACOES.md` §3.1 — Sentry PII strip exhaustivo
- `dosy-app/docs/07-DESIGN_SYSTEM.md` §3.13 — MedicationPicker BottomSheet
- `dosy-app/docs/18-TESTES.md` §3.8 — top 5 cenários E2E
- `dosy-app/docs/11-DB_SCHEMA.md` §4 — triggers + cron jobs
- `dosy-app/docs/19-SEGURANCA.md` §3 — LGPD compliance

**ADRs medcontrol existentes:**
- `context/decisoes/2026-05-01-001-modelo-1-sessao-1-release-branch.md`
- `context/decisoes/2026-05-01-002-comunicacao-user-nao-dev.md`
- `context/decisoes/2026-05-05-resend-smtp-setup.md`
- `context/decisoes/2026-05-06-001-rejection-google-fix.md`

---

> **Princípio guia:** medcontrol_v2 deve ser referência viva do que Dosy v2 vai consolidar. Não há "Dosy v2 vai fazer isso" — se está nos docs, medcontrol tenta implementar primeiro. Único limite: estabilidade de produção (não regredir bugs já fixados).
> **Status do roteiro:** vivo. Atualizar conforme sprints fecham.
> **Origem:** Análise comparativa 10 agentes paralelos 2026-05-22.
