/**
 * classify-medication — v0.2.4.0 Categorias de Medicamentos
 *
 * Função única de classificação. Usada por:
 *   - scripts/ingest-cmed.mjs (ingest mensal CMED)
 *   - scripts/backfill-catalog-groups.mjs (one-shot pra catálogo existente)
 *   - supabase/functions/backfill-user-treatment-categories (edge function)
 *
 * Ordem de precedência (Plano §5.3):
 *   1. CMED class oficial (lookup CMED_CLASS_TO_GROUP)
 *   2. Dicionário curado (principio_ativo_to_group.json)
 *   3. Heurística keyword (group_keywords.json)
 *   4. 'outro' (fallback final)
 *
 * Tokenização (Plano §5.4): princípio composto "Amoxicilina + Clavulanato" vira
 * ["amoxicilina", "clavulanato"] e cada token testa contra dicionário/keywords.
 * Primeiro match vence (ativo principal geralmente vem primeiro).
 */

import principioMap from '../data/principio_ativo_to_group.json' with { type: 'json' }
import keywordMap from '../data/group_keywords.json' with { type: 'json' }

const VALID_GROUPS = new Set([
  'antibiotico', 'antifungico', 'antiviral', 'antitermico_analgesico',
  'anti_inflamatorio', 'corticoide', 'anti_hipertensivo', 'antidiabetico',
  'antialergico', 'antidepressivo', 'ansiolitico', 'anticoagulante',
  'gastrointestinal', 'broncodilatador', 'vitamina', 'outro',
])

// Mantido em sync com src/constants/medCategories.js CMED_CLASS_TO_GROUP.
// Duplicação intencional: Node script não importa front-end ES modules sem build step.
const CMED_CLASS_TO_GROUP = {
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
  'antimicoticos para uso sistemico': 'antifungico',
  'antifungicos topicos': 'antifungico',
  'derivados imidazolicos': 'antifungico',
  'derivados triazolicos': 'antifungico',
  'antimicoticos de uso topico': 'antifungico',
  'antivirais de acao direta': 'antiviral',
  'antivirais para tratamento da hiv': 'antiviral',
  'antivirais para tratamento da hepatite': 'antiviral',
  'nucleosideos e nucleotideos': 'antiviral',
  'outros analgesicos e antipireticos': 'antitermico_analgesico',
  'analgesicos opioides': 'antitermico_analgesico',
  'analgesicos nao opioides': 'antitermico_analgesico',
  'anilidas': 'antitermico_analgesico',
  'pirazolonas': 'antitermico_analgesico',
  'salicilatos': 'antitermico_analgesico',
  'anti-inflamatorios nao esteroides': 'anti_inflamatorio',
  'anti-inflamatorios e antirreumaticos': 'anti_inflamatorio',
  'derivados do acido propionico': 'anti_inflamatorio',
  'derivados do acido acetico': 'anti_inflamatorio',
  'coxibes': 'anti_inflamatorio',
  'oxicans': 'anti_inflamatorio',
  'glicocorticoides': 'corticoide',
  'corticosteroides para uso sistemico': 'corticoide',
  'corticosteroides simples': 'corticoide',
  'corticosteroides topicos': 'corticoide',
  'corticosteroides oftalmicos': 'corticoide',
  'corticosteroides nasais': 'corticoide',
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
  'anti-histaminicos para uso sistemico': 'antialergico',
  'anti-histaminicos sedativos': 'antialergico',
  'anti-histaminicos nao sedativos': 'antialergico',
  'descongestionantes nasais': 'antialergico',
  'inibidores seletivos da recaptacao de serotonina': 'antidepressivo',
  'inibidores nao seletivos da recaptacao da monoamina': 'antidepressivo',
  'inibidores da recaptacao de serotonina e noradrenalina': 'antidepressivo',
  'antidepressivos triciclicos': 'antidepressivo',
  'outros antidepressivos': 'antidepressivo',
  'benzodiazepinicos': 'ansiolitico',
  'derivados benzodiazepinicos': 'ansiolitico',
  'ansioliticos': 'ansiolitico',
  'hipnoticos e sedativos': 'ansiolitico',
  'derivados de azaspirodecanodiona': 'ansiolitico',
  'antagonistas da vitamina k': 'anticoagulante',
  'inibidores diretos do fator xa': 'anticoagulante',
  'inibidores diretos da trombina': 'anticoagulante',
  'heparinas e analogos': 'anticoagulante',
  'antiagregantes plaquetarios excluindo heparina': 'anticoagulante',
  'inibidores da agregacao plaquetaria': 'anticoagulante',
  'antitromboticos': 'anticoagulante',
  'inibidores da bomba de protons': 'gastrointestinal',
  'antagonistas dos receptores h2': 'gastrointestinal',
  'antiacidos': 'gastrointestinal',
  'antieméticos': 'gastrointestinal',
  'antiespasmodicos': 'gastrointestinal',
  'procineticos': 'gastrointestinal',
  'laxativos': 'gastrointestinal',
  'antidiarreicos': 'gastrointestinal',
  'farmacos para distubios funcionais do trato gastrointestinal': 'gastrointestinal',
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

export function normalize(text) {
  if (!text) return ''
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tokeniza princípio composto.
 * "Amoxicilina + Clavulanato de Potássio" → ["amoxicilina", "clavulanato de potassio"]
 * "Paracetamol, Fosfato de Codeína" → ["paracetamol", "fosfato de codeina"]
 */
export function tokenize(principio) {
  const norm = normalize(principio)
  if (!norm) return []
  return norm
    .split(/[+,;]|\s+e\s+|\s+&\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/**
 * Resolve group_id a partir de cmed_class (lookup direto + fallback 'outro').
 */
export function groupFromCmedClass(cmedClass) {
  if (!cmedClass) return null
  const normalized = normalize(cmedClass)
  if (CMED_CLASS_TO_GROUP[normalized]) return CMED_CLASS_TO_GROUP[normalized]
  return 'outro'
}

/**
 * Resolve group_id a partir de princípio ativo.
 * Camada 1: dicionário curado por token
 * Camada 2: heurística keyword por substring no princípio inteiro
 */
export function groupFromPrincipio(principio) {
  if (!principio) return null

  const tokens = tokenize(principio)
  const fullNorm = normalize(principio)

  // Camada 1 — dicionário token-by-token (primeiro match vence)
  for (const token of tokens) {
    if (principioMap[token]) {
      const group = principioMap[token]
      if (VALID_GROUPS.has(group)) return group
    }
    // Tentar princípio sem prefixo "fosfato de", "sulfato de", "cloridrato de" etc.
    const stripped = token.replace(/^(fosfato|sulfato|cloridrato|maleato|tartarato|nitrato|acetato|succinato|hemifumarato|fumarato|brometo|cloridrato|mesilato|besilato|citrato|hidrogenocitrato|trihidratado|monoidrato|diidratado|sodico|sodica|potassico|potassica|calcica|magnesico)\s+(de\s+)?/i, '')
    if (stripped !== token && principioMap[stripped]) {
      const group = principioMap[stripped]
      if (VALID_GROUPS.has(group)) return group
    }
  }

  // Camada 2 — keyword substring no princípio normalizado
  for (const [group, keywords] of Object.entries(keywordMap)) {
    if (group.startsWith('_')) continue
    for (const kw of keywords) {
      if (fullNorm.includes(kw)) {
        if (VALID_GROUPS.has(group)) return group
      }
    }
  }

  return null
}

/**
 * Classificação composta: tenta CMED class → principio → fallback null.
 *
 * @param {object} med
 * @param {string} [med.cmed_class] — Classe CMED oficial (preferida)
 * @param {string} [med.principio_ativo] — Princípio ativo (fallback)
 * @returns {{ group_id: string|null, cmed_class: string|null, source: 'cmed'|'principio_dict'|'principio_keyword'|'none' }}
 */
export function classifyMedication({ cmed_class = null, principio_ativo = null } = {}) {
  // Caminho 1: CMED class provida
  if (cmed_class) {
    const fromCmed = groupFromCmedClass(cmed_class)
    if (fromCmed) {
      return { group_id: fromCmed, cmed_class, source: 'cmed' }
    }
  }

  // Caminho 2: princípio ativo via dicionário token + keyword
  if (principio_ativo) {
    const fromPrincipio = groupFromPrincipio(principio_ativo)
    if (fromPrincipio) {
      return { group_id: fromPrincipio, cmed_class: cmed_class || null, source: 'principio_dict' }
    }
  }

  return { group_id: null, cmed_class: cmed_class || null, source: 'none' }
}
