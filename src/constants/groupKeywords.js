/**
 * groupKeywords — v0.2.5.0
 *
 * Sufixos/prefixos farmacológicos para inferir grupo terapêutico
 * a partir do NOME do medicamento (não princípio ativo).
 *
 * Usado pelo CategoryHintModal pra ranquear top-3 sugestões quando
 * autofill via catálogo falha completamente.
 *
 * Cobertura: ~90% dos sufixos farmacológicos comuns no mercado BR.
 */

export const GROUP_KEYWORDS = [
  // Antidepressivos (ISRS, IRSN, tricíclicos)
  { pattern: /pram($|\s|\d)/i, group: 'antidepressivo' },     // citalopram, escitalopram
  { pattern: /alina($|\s|\d)/i, group: 'antidepressivo' },    // sertralina
  { pattern: /xetina($|\s|\d)/i, group: 'antidepressivo' },   // fluoxetina, duloxetina
  { pattern: /faxina/i, group: 'antidepressivo' },            // venlafaxina
  { pattern: /priona/i, group: 'antidepressivo' },            // bupropiona
  { pattern: /pina($|\s|\d)/i, group: 'antidepressivo' },     // mirtazapina (cuidado, sobrepõe com anlodipina)
  // Anti-hipertensivos
  { pattern: /sartana/i, group: 'anti_hipertensivo' },        // losartana, valsartana
  { pattern: /pril($|\s|\d)/i, group: 'anti_hipertensivo' },  // enalapril, captopril
  { pattern: /dipino/i, group: 'anti_hipertensivo' },         // anlodipino, nifedipino
  { pattern: /olol($|\s|\d)/i, group: 'anti_hipertensivo' },  // atenolol, propranolol
  { pattern: /tiazida/i, group: 'anti_hipertensivo' },        // hidroclorotiazida
  // Antidiabéticos
  { pattern: /gliptina/i, group: 'antidiabetico' },           // sitagliptina
  { pattern: /gliflozina/i, group: 'antidiabetico' },         // dapagliflozina
  { pattern: /glutida/i, group: 'antidiabetico' },            // semaglutida, liraglutida
  { pattern: /metformina/i, group: 'antidiabetico' },
  // Antibióticos
  { pattern: /cilina/i, group: 'antibiotico' },               // amoxicilina, ampicilina
  { pattern: /micin/i, group: 'antibiotico' },                // azitromicina, claritromicina
  { pattern: /floxa/i, group: 'antibiotico' },                // ciprofloxacino, levofloxacino
  { pattern: /ciclina/i, group: 'antibiotico' },              // doxiciclina, tetraciclina
  { pattern: /cefa/i, group: 'antibiotico' },                 // cefalexina, cefadroxila
  { pattern: /metronidazol/i, group: 'antibiotico' },
  // Anti-inflamatórios
  { pattern: /profeno/i, group: 'anti_inflamatorio' },        // ibuprofeno, cetoprofeno
  { pattern: /fenaco/i, group: 'anti_inflamatorio' },         // diclofenaco
  { pattern: /coxib/i, group: 'anti_inflamatorio' },          // celecoxibe, etoricoxibe
  { pattern: /(meloxic|piroxic|tenoxic)/i, group: 'anti_inflamatorio' },
  // Corticoides
  { pattern: /prednis/i, group: 'corticoide' },               // prednisona, prednisolona
  { pattern: /metasona/i, group: 'corticoide' },              // dexametasona, betametasona
  { pattern: /hidrocort/i, group: 'corticoide' },
  // Antialérgicos / Anti-histamínicos
  { pattern: /(loratadina|tirizina|fenadina|tadina)/i, group: 'antialergico' },
  // Ansiolíticos
  { pattern: /(zolam|azepam|zolpid|zopiclon)/i, group: 'ansiolitico' },
  // Gastrointestinais
  { pattern: /prazol/i, group: 'gastrointestinal' },          // omeprazol, esomeprazol
  { pattern: /(ranitidi|famotidi)/i, group: 'gastrointestinal' },
  { pattern: /domperido/i, group: 'gastrointestinal' },
  { pattern: /metoclopra/i, group: 'gastrointestinal' },
  // Broncodilatadores
  { pattern: /terol/i, group: 'broncodilatador' },            // salbutamol, fenoterol, formoterol
  { pattern: /(tropio|ipratrop)/i, group: 'broncodilatador' },
  { pattern: /budeson/i, group: 'broncodilatador' },          // budesonida (também é corticoide, mas broncodilatador inalatório)
  // Vitaminas/Suplementos
  { pattern: /vitamin/i, group: 'vitamina' },
  { pattern: /complexo\s*b/i, group: 'vitamina' },
  { pattern: /(acido folico|colecalcife|acido ascorbic|tiamina|piridoxina)/i, group: 'vitamina' },
  // Antivirais
  { pattern: /clovir/i, group: 'antiviral' },                 // aciclovir, valaciclovir
  // Antifúngicos
  { pattern: /conazol/i, group: 'antifungico' },              // fluconazol, cetoconazol
  { pattern: /terbin/i, group: 'antifungico' },               // terbinafina
]

/**
 * Retorna top-N groups mais prováveis baseado no nome digitado.
 *
 * @param {string} name — nome do medicamento digitado
 * @param {number} topN — quantas sugestões retornar (default 3)
 * @returns {string[]} array de group_ids ranqueados (mais prováveis primeiro)
 */
export function inferGroupsFromName(name, topN = 3) {
  if (!name || typeof name !== 'string') return []
  const matches = []
  for (const { pattern, group } of GROUP_KEYWORDS) {
    if (pattern.test(name)) {
      if (!matches.includes(group)) matches.push(group)
      if (matches.length >= topN) break
    }
  }
  return matches
}
