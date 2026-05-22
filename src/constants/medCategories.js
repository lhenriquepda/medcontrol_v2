/**
 * medCategories — v0.2.4.0 Feature Categorias de Medicamentos
 *
 * Hierarquia em 2 níveis:
 *  • Nível 1 (group_id): grupo amigável visível em chip/filtro/donut.
 *    Lista FECHADA com CHECK constraint no DB. Não inventar valores.
 *  • Nível 2 (cmed_class): classe terapêutica oficial CMED (texto livre).
 *    Mapeada via CMED_CLASS_TO_GROUP pra cair em um group_id.
 *
 * Ver Plano_Categorias_Medicamentos.md raiz §3 para racional completo.
 */

export const MED_GROUPS = [
  { id: 'antibiotico',              label: 'Antibiótico',                color: 'var(--dosy-red-500)' },
  { id: 'antifungico',              label: 'Antifúngico',                color: 'var(--dosy-red-400)' },
  { id: 'antiviral',                label: 'Antiviral',                  color: 'var(--dosy-red-300)' },
  { id: 'antitermico_analgesico',   label: 'Antitérmico/Analgésico',     color: 'var(--dosy-orange-500)' },
  { id: 'anti_inflamatorio',        label: 'Anti-inflamatório',          color: 'var(--dosy-orange-400)' },
  { id: 'corticoide',               label: 'Corticoide',                 color: 'var(--dosy-purple-500)' },
  { id: 'anti_hipertensivo',        label: 'Anti-hipertensivo',          color: 'var(--dosy-blue-500)' },
  { id: 'antidiabetico',            label: 'Antidiabético',              color: 'var(--dosy-blue-400)' },
  { id: 'antialergico',             label: 'Antialérgico',               color: 'var(--dosy-cyan-500)' },
  { id: 'antidepressivo',           label: 'Antidepressivo',             color: 'var(--dosy-indigo-500)' },
  { id: 'ansiolitico',              label: 'Ansiolítico/Sedativo',       color: 'var(--dosy-indigo-400)' },
  { id: 'anticoagulante',           label: 'Anticoagulante',             color: 'var(--dosy-pink-500)' },
  { id: 'gastrointestinal',         label: 'Gastrointestinal',           color: 'var(--dosy-amber-500)' },
  { id: 'broncodilatador',          label: 'Broncodilatador',            color: 'var(--dosy-teal-500)' },
  { id: 'vitamina',                 label: 'Vitamina/Suplemento',        color: 'var(--dosy-green-500)' },
  { id: 'outro',                    label: 'Outro',                      color: 'var(--dosy-gray-500)' },
]

// Estado especial visualmente — não é group_id válido no DB
export const GROUP_UNCLASSIFIED = {
  id: null,
  label: 'Não classificado',
  color: 'var(--dosy-gray-300)',
}

const _byId = Object.fromEntries(MED_GROUPS.map((g) => [g.id, g]))

export function getGroup(groupId) {
  if (!groupId) return GROUP_UNCLASSIFIED
  return _byId[groupId] || GROUP_UNCLASSIFIED
}

export function getGroupLabel(groupId) {
  return getGroup(groupId).label
}

export function getGroupColor(groupId) {
  return getGroup(groupId).color
}

export const VALID_GROUP_IDS = new Set(MED_GROUPS.map((g) => g.id))

/**
 * De-para Classe CMED (Nível 2) → group_id (Nível 1).
 * Lookup case-insensitive + sem acento (ver normalizeCmedClass).
 *
 * Chaves: variantes normalizadas das classes terapêuticas CMED.
 * Atualização: quando CMED publica classe nova/renomeia, adicionar aqui.
 *
 * Fonte: tabela XLSX mensal CMED ANVISA — coluna `CLASSE TERAPÊUTICA`.
 * Cobertura inicial: ~90 classes mais frequentes que cobrem ~95% das apresentações BR.
 */
export const CMED_CLASS_TO_GROUP = {
  // ── Antibióticos ────────────────────────────────────────────────────────
  'penicilinas de espectro ampliado': 'antibiotico',
  'penicilinas com inibidor de betalactamase': 'antibiotico',
  'penicilinas resistentes a betalactamase': 'antibiotico',
  'penicilinas sensiveis a betalactamase': 'antibiotico',
  'macrolideos': 'antibiotico',
  'cefalosporinas de 1a geracao': 'antibiotico',
  'cefalosporinas de 2a geracao': 'antibiotico',
  'cefalosporinas de 3a geracao': 'antibiotico',
  'cefalosporinas de 4a geracao': 'antibiotico',
  'quinolonas': 'antibiotico',
  'fluoroquinolonas': 'antibiotico',
  'tetraciclinas': 'antibiotico',
  'sulfonamidas': 'antibiotico',
  'sulfonamidas e trimetoprima': 'antibiotico',
  'lincosamidas': 'antibiotico',
  'aminoglicosideos': 'antibiotico',
  'glicopeptideos': 'antibiotico',
  'nitroimidazolicos': 'antibiotico',
  'antibacterianos polipeptidicos': 'antibiotico',
  'outros antibacterianos': 'antibiotico',

  // ── Antifúngicos ────────────────────────────────────────────────────────
  'antimicoticos para uso sistemico': 'antifungico',
  'antifungicos topicos': 'antifungico',
  'derivados imidazolicos': 'antifungico',
  'derivados triazolicos': 'antifungico',
  'antimicoticos de uso topico': 'antifungico',

  // ── Antivirais ──────────────────────────────────────────────────────────
  'antivirais de acao direta': 'antiviral',
  'antivirais para tratamento da hiv': 'antiviral',
  'antivirais para tratamento da hepatite': 'antiviral',
  'nucleosideos e nucleotideos': 'antiviral',

  // ── Antitérmicos / Analgésicos ──────────────────────────────────────────
  'outros analgesicos e antipireticos': 'antitermico_analgesico',
  'analgesicos opioides': 'antitermico_analgesico',
  'analgesicos nao opioides': 'antitermico_analgesico',
  'anilidas': 'antitermico_analgesico',
  'pirazolonas': 'antitermico_analgesico',
  'salicilatos': 'antitermico_analgesico',

  // ── Anti-inflamatórios ─────────────────────────────────────────────────
  'anti-inflamatorios nao esteroides': 'anti_inflamatorio',
  'anti-inflamatorios e antirreumaticos': 'anti_inflamatorio',
  'derivados do acido propionico': 'anti_inflamatorio',
  'derivados do acido acetico': 'anti_inflamatorio',
  'coxibes': 'anti_inflamatorio',
  'oxicans': 'anti_inflamatorio',

  // ── Corticoides ─────────────────────────────────────────────────────────
  'glicocorticoides': 'corticoide',
  'corticosteroides para uso sistemico': 'corticoide',
  'corticosteroides simples': 'corticoide',
  'corticosteroides topicos': 'corticoide',
  'corticosteroides oftalmicos': 'corticoide',
  'corticosteroides nasais': 'corticoide',

  // ── Anti-hipertensivos ──────────────────────────────────────────────────
  'antagonistas da angiotensina ii': 'anti_hipertensivo',
  'inibidores da eca simples': 'anti_hipertensivo',
  'inibidores da enzima conversora da angiotensina': 'anti_hipertensivo',
  'bloqueadores dos canais de calcio': 'anti_hipertensivo',
  'bloqueadores dos canais de calcio seletivos com efeitos vasculares': 'anti_hipertensivo',
  'betabloqueadores': 'anti_hipertensivo',
  'betabloqueadores seletivos': 'anti_hipertensivo',
  'diureticos tiazidicos': 'anti_hipertensivo',
  'diureticos de alca': 'anti_hipertensivo',
  'diureticos poupadores de potassio': 'anti_hipertensivo',
  'agentes anti-hipertensivos': 'anti_hipertensivo',
  'inibidores adrenergicos': 'anti_hipertensivo',
  'antagonistas alfa-adrenergicos': 'anti_hipertensivo',
  'agentes que atuam no sistema renina-angiotensina': 'anti_hipertensivo',

  // ── Antidiabéticos ──────────────────────────────────────────────────────
  'biguanidas': 'antidiabetico',
  'sulfonilureias': 'antidiabetico',
  'insulinas e analogos': 'antidiabetico',
  'inibidores da dpp-4': 'antidiabetico',
  'inibidores da sglt2': 'antidiabetico',
  'agonistas do glp-1': 'antidiabetico',
  'glinidas': 'antidiabetico',
  'tiazolidinedionas': 'antidiabetico',
  'outros antidiabeticos': 'antidiabetico',
  'farmacos usados no diabetes': 'antidiabetico',

  // ── Antialérgicos ───────────────────────────────────────────────────────
  'anti-histaminicos para uso sistemico': 'antialergico',
  'anti-histaminicos sedativos': 'antialergico',
  'anti-histaminicos nao sedativos': 'antialergico',
  'descongestionantes nasais': 'antialergico',

  // ── Antidepressivos ─────────────────────────────────────────────────────
  'inibidores seletivos da recaptacao de serotonina': 'antidepressivo',
  'inibidores nao seletivos da recaptacao da monoamina': 'antidepressivo',
  'inibidores da recaptacao de serotonina e noradrenalina': 'antidepressivo',
  'antidepressivos triciclicos': 'antidepressivo',
  'outros antidepressivos': 'antidepressivo',

  // ── Ansiolíticos ────────────────────────────────────────────────────────
  'benzodiazepinicos': 'ansiolitico',
  'derivados benzodiazepinicos': 'ansiolitico',
  'ansioliticos': 'ansiolitico',
  'hipnoticos e sedativos': 'ansiolitico',
  'derivados de azaspirodecanodiona': 'ansiolitico',

  // ── Anticoagulantes ─────────────────────────────────────────────────────
  'antagonistas da vitamina k': 'anticoagulante',
  'inibidores diretos do fator xa': 'anticoagulante',
  'inibidores diretos da trombina': 'anticoagulante',
  'heparinas e analogos': 'anticoagulante',
  'antiagregantes plaquetarios excluindo heparina': 'anticoagulante',
  'inibidores da agregacao plaquetaria': 'anticoagulante',
  'antitromboticos': 'anticoagulante',

  // ── Gastrointestinais ───────────────────────────────────────────────────
  'inibidores da bomba de protons': 'gastrointestinal',
  'antagonistas dos receptores h2': 'gastrointestinal',
  'antiacidos': 'gastrointestinal',
  'antieméticos': 'gastrointestinal',
  'antiespasmodicos': 'gastrointestinal',
  'procineticos': 'gastrointestinal',
  'laxativos': 'gastrointestinal',
  'antidiarreicos': 'gastrointestinal',
  'farmacos para distubios funcionais do trato gastrointestinal': 'gastrointestinal',

  // ── Broncodilatadores / Respiratórios ───────────────────────────────────
  'agonistas adrenergicos beta-2 seletivos': 'broncodilatador',
  'beta-2 adrenergicos de curta duracao': 'broncodilatador',
  'beta-2 adrenergicos de longa duracao': 'broncodilatador',
  'corticosteroides inalatorios': 'broncodilatador',
  'antagonistas dos receptores muscarinicos': 'broncodilatador',
  'antiasmaticos': 'broncodilatador',
  'farmacos para doencas obstrutivas das vias aereas': 'broncodilatador',
  'mucoliticos': 'broncodilatador',
  'antitussigenos': 'broncodilatador',
  'expectorantes': 'broncodilatador',

  // ── Vitaminas / Suplementos ────────────────────────────────────────────
  'vitamina d e analogos': 'vitamina',
  'vitamina a e d em combinacao': 'vitamina',
  'vitaminas do complexo b': 'vitamina',
  'vitamina b12 e acido folico': 'vitamina',
  'vitamina c isolada': 'vitamina',
  'vitamina c em combinacao': 'vitamina',
  'multivitaminicos': 'vitamina',
  'multivitaminicos e minerais': 'vitamina',
  'suplementos minerais': 'vitamina',
  'calcio': 'vitamina',
  'magnesio': 'vitamina',
  'ferro': 'vitamina',
  'zinco': 'vitamina',
}

/**
 * Normaliza texto pra lookup case/acento-insensitive.
 * "Penicilinas de Espectro Ampliado" → "penicilinas de espectro ampliado"
 * "Inibidores da ECA" → "inibidores da eca"
 */
export function normalizeCmedClass(text) {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolve cmed_class → group_id via de-para CMED_CLASS_TO_GROUP.
 * Retorna 'outro' se classe não mapeada (não NULL — distingue de "ainda não classificado").
 */
export function resolveGroupFromCmedClass(cmedClass) {
  if (!cmedClass) return null
  const normalized = normalizeCmedClass(cmedClass)
  return CMED_CLASS_TO_GROUP[normalized] || 'outro'
}
