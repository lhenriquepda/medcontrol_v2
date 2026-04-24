// Lista de medicamentos comuns no Brasil (nomes genéricos + comerciais populares)
// Ordenada alfabeticamente para melhor match de prefixo
export const MEDICATIONS = [
  'Acetilcisteína','Aciclovir','Ácido fólico','Ácido úrico','Albendazol',
  'Alopurinol','Alprazolam','Amiodarona','Amitriptilina','Amoxicilina',
  'Amoxicilina + Clavulanato','Anlodipino','Atenolol','Atorvastatina',
  'Azitromicina','Beclometasona','Bromazepam','Budesonida','Captopril',
  'Carbamazepina','Carvedilol','Cefalexina','Cetirizina','Ciprofloxacino',
  'Citalopram','Clindamicina','Clonazepam','Clopidogrel','Clotrimazol',
  'Dexametasona','Dexclorfeniramina','Diclofenaco','Digoxina','Diltiazem',
  'Dipirona','Domperidona','Doxiciclina','Enalapril','Escitalopram',
  'Espironolactona','Esomeprazol','Fenitoína','Fenobarbital','Fluconazol',
  'Fluoxetina','Fluticasona','Furosemida','Gabapentina','Glibenclamida',
  'Glicazida','Haloperidol','Hidroclorotiazida','Hidrocortisona','Ibuprofeno',
  'Insulina NPH','Insulina Regular','Irbesartana','Isossorbida','Isotretinoína',
  'Ivermectina','Lansoprazol','Levofloxacino','Levotiroxina','Lisinopril',
  'Loperamida','Loratadina','Losartana','Lorazepam','Metformina',
  'Metoclopramida','Metoprolol','Metronidazol','Mirtazapina','Montelucaste',
  'Naproxeno','Nitrofurantoína','Nortriptilina','Olanzapina','Omeprazol',
  'Ondansetrona','Paracetamol','Paroxetina','Pioglitazona','Prednisolona',
  'Prednisona','Pregabalina','Propranolol','Quetiapina','Ramipril',
  'Ranitidina','Risperidona','Rosuvastatina','Salmeterol','Sertralina',
  'Sildenafila','Sinvastatina','Sitagliptina','Sulfametoxazol + Trimetoprima',
  'Tamsulosina','Telmisartana','Topiramato','Tramadol','Valproato de sódio',
  'Valsartana','Venlafaxina','Verapamil','Vitamina B12','Vitamina C',
  'Vitamina D','Warfarina','Ziprasidona','Zolpidem',
  // Nomes comerciais populares
  'Aerolin','Adalat','Ácido Acetilsalicílico','Aspirina','Buscopan',
  'Cataflam','Claritin','Concor','Desloratadina','Dorflex','Dramin',
  'Engov','Fioricet','Frontal','Lexotan','Losartec','Motilium',
  'Neosaldina','Novalgina','Plasil','Ponstan','Profenid','Rivotril',
  'Selozok','Sempre Viva','Tadalafila','Tolvon','Trileptal','Zoloft',
].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

/**
 * Retorna a melhor sugestão para o prefixo digitado.
 * Prioridade: inicia com prefixo (case-insensitive) → depois contém.
 */
export function suggestMedication(prefix) {
  if (!prefix || prefix.length < 2) return null
  const lower = prefix.toLowerCase()
  const startsWith = MEDICATIONS.find((m) => m.toLowerCase().startsWith(lower))
  if (startsWith) return startsWith
  const contains = MEDICATIONS.find((m) => m.toLowerCase().includes(lower))
  return contains || null
}
