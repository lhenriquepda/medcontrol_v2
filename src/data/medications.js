// Lista de medicamentos comuns no Brasil (genéricos/princípio ativo + comerciais populares).
// Ordenada alfabeticamente. Cobre principais classes terapêuticas em uso ambulatorial.
// Esta lista é APENAS HINT — usuário pode digitar qualquer texto livre como nome do medicamento.
// Sugestões personalizadas vêm de combinar esta lista com o histórico do próprio usuário
// (ver `useUserMedications` hook).
export const MEDICATIONS = [
  // ── Analgésicos / Antitérmicos / AINEs ──────────────────────────────
  'Acetaminofeno', 'Ácido Acetilsalicílico', 'Aspirina', 'Aceclofenaco',
  'Cetoprofeno', 'Cetorolaco', 'Codeína', 'Diclofenaco', 'Diclofenaco potássico',
  'Diclofenaco sódico', 'Dipirona', 'Dipirona sódica', 'Etodolaco', 'Fenoprofeno',
  'Ibuprofeno', 'Indometacina', 'Meloxicam', 'Morfina', 'Nabumetona',
  'Naproxeno', 'Nimesulida', 'Oxicodona', 'Paracetamol', 'Piroxicam',
  'Sulindaco', 'Tenoxicam', 'Tramadol', 'Tramadol + Paracetamol',

  // ── Antibióticos ────────────────────────────────────────────────────
  'Amicacina', 'Amoxicilina', 'Amoxicilina + Clavulanato', 'Ampicilina',
  'Azitromicina', 'Bacitracina', 'Cefadroxila', 'Cefalexina', 'Cefepima',
  'Cefotaxima', 'Cefoxitina', 'Ceftriaxona', 'Cefuroxima', 'Ciprofloxacino',
  'Claritromicina', 'Clindamicina', 'Cloranfenicol', 'Doxiciclina',
  'Eritromicina', 'Espiramicina', 'Etambutol', 'Gentamicina', 'Imipenem',
  'Levofloxacino', 'Linezolida', 'Meropenem', 'Metronidazol', 'Minociclina',
  'Moxifloxacino', 'Neomicina', 'Nitrofurantoína', 'Norfloxacino',
  'Ofloxacino', 'Penicilina G', 'Penicilina V', 'Piperacilina',
  'Polimixina B', 'Rifampicina', 'Sulfadiazina', 'Sulfametoxazol',
  'Sulfametoxazol + Trimetoprima', 'Tetraciclina', 'Tigeciclina',
  'Tobramicina', 'Vancomicina',

  // ── Antifúngicos ─────────────────────────────────────────────────────
  'Anfotericina B', 'Cetoconazol', 'Clotrimazol', 'Fluconazol',
  'Griseofulvina', 'Itraconazol', 'Miconazol', 'Nistatina', 'Terbinafina',
  'Voriconazol',

  // ── Antivirais ───────────────────────────────────────────────────────
  'Aciclovir', 'Ganciclovir', 'Lamivudina', 'Oseltamivir', 'Ribavirina',
  'Tenofovir', 'Valaciclovir', 'Zidovudina',

  // ── Antiparasitários ─────────────────────────────────────────────────
  'Albendazol', 'Cloroquina', 'Hidroxicloroquina', 'Ivermectina', 'Mebendazol',
  'Metronidazol', 'Nitazoxanida', 'Niclosamida', 'Nimorazol', 'Pirantel',
  'Praziquantel', 'Pirimetamina', 'Tinidazol',

  // ── Antialérgicos / Anti-histamínicos ───────────────────────────────
  'Bilastina', 'Cetirizina', 'Clorfeniramina', 'Desloratadina',
  'Dexclorfeniramina', 'Difenidramina', 'Ebastina', 'Fexofenadina',
  'Hidroxizina', 'Levocetirizina', 'Loratadina', 'Prometazina',
  'Rupatadina',

  // ── Cardiovasculares: anti-hipertensivos, antianginosos ─────────────
  'Amiodarona', 'Anlodipino', 'Atenolol', 'Atorvastatina', 'Benazepril',
  'Bisoprolol', 'Captopril', 'Carvedilol', 'Clortalidona', 'Diltiazem',
  'Doxazosina', 'Enalapril', 'Espironolactona', 'Felodipino', 'Furosemida',
  'Hidralazina', 'Hidroclorotiazida', 'Indapamida', 'Irbesartana',
  'Isossorbida', 'Lacidipino', 'Lercanidipino', 'Lisinopril', 'Losartana',
  'Manidipino', 'Metildopa', 'Metoprolol', 'Nadolol', 'Nebivolol',
  'Nifedipino', 'Nitrendipino', 'Olmesartana', 'Perindopril', 'Pindolol',
  'Prazosina', 'Propranolol', 'Quinapril', 'Ramipril', 'Sotalol',
  'Telmisartana', 'Trandolapril', 'Valsartana', 'Verapamil',

  // ── Cardiovasculares: estatinas / dislipidemia ──────────────────────
  'Bezafibrato', 'Ciprofibrato', 'Ezetimiba', 'Fenofibrato', 'Fluvastatina',
  'Genfibrozila', 'Lovastatina', 'Pitavastatina', 'Pravastatina',
  'Rosuvastatina', 'Sinvastatina',

  // ── Cardiovasculares: anticoagulantes / antiagregantes ──────────────
  'Apixabana', 'Clopidogrel', 'Dabigatrana', 'Edoxabana', 'Enoxaparina',
  'Heparina', 'Rivaroxabana', 'Ticagrelor', 'Varfarina', 'Warfarina',

  // ── Cardiovasculares: outros ────────────────────────────────────────
  'Digoxina', 'Dobutamina', 'Dopamina', 'Epinefrina', 'Norepinefrina',
  'Trinitrato de glicerila',

  // ── Diabetes ─────────────────────────────────────────────────────────
  'Acarbose', 'Dapagliflozina', 'Dulaglutida', 'Empagliflozina',
  'Glibenclamida', 'Glicazida', 'Glimepirida', 'Glipizida', 'Insulina Aspart',
  'Insulina Detemir', 'Insulina Glargina', 'Insulina Glulisina',
  'Insulina Lispro', 'Insulina NPH', 'Insulina Regular', 'Linagliptina',
  'Liraglutida', 'Metformina', 'Pioglitazona', 'Repaglinida', 'Saxagliptina',
  'Semaglutida', 'Sitagliptina', 'Vildagliptina',

  // ── Gastrointestinais ───────────────────────────────────────────────
  'Bromoprida', 'Bisacodil', 'Cisaprida', 'Cinarizina', 'Difenoxilato',
  'Domperidona', 'Esomeprazol', 'Famotidina', 'Hidróxido de Alumínio',
  'Hidróxido de Magnésio', 'Lactulose', 'Lansoprazol', 'Loperamida',
  'Mesalazina', 'Metoclopramida', 'Mosaprida', 'Omeprazol', 'Ondansetrona',
  'Pantoprazol', 'Plantago ovata', 'Rabeprazol', 'Ranitidina',
  'Sucralfato', 'Sulfassalazina', 'Tegaserode', 'Trimebutina',

  // ── Respiratório / Asma / DPOC ──────────────────────────────────────
  'Aminofilina', 'Azelastina', 'Beclometasona', 'Brometo de Ipratrópio',
  'Brometo de Tiotrópio', 'Budesonida', 'Ciclesonida', 'Fenoterol',
  'Fluticasona', 'Formoterol', 'Indacaterol', 'Mometasona', 'Montelucaste',
  'Olodaterol', 'Roflumilaste', 'Salbutamol', 'Salmeterol', 'Teofilina',
  'Vilanterol', 'Zafirlucaste',

  // ── Tosse / Expectorantes ────────────────────────────────────────────
  'Acetilcisteína', 'Ambroxol', 'Bromexina', 'Carbocisteína', 'Codeína',
  'Cloperastina', 'Dextrometorfano', 'Dropropizina', 'Erdosteína',
  'Guaifenesina', 'Levodropropizina',

  // ── SNC: Antidepressivos ────────────────────────────────────────────
  'Agomelatina', 'Amitriptilina', 'Bupropiona', 'Citalopram', 'Clomipramina',
  'Desvenlafaxina', 'Duloxetina', 'Escitalopram', 'Fluoxetina', 'Fluvoxamina',
  'Imipramina', 'Maprotilina', 'Mirtazapina', 'Moclobemida', 'Nortriptilina',
  'Paroxetina', 'Sertralina', 'Trazodona', 'Venlafaxina', 'Vortioxetina',

  // ── SNC: Ansiolíticos / Hipnóticos ──────────────────────────────────
  'Alprazolam', 'Bromazepam', 'Buspirona', 'Cloxazolam', 'Clonazepam',
  'Clordiazepóxido', 'Diazepam', 'Eszopiclona', 'Flurazepam', 'Lorazepam',
  'Midazolam', 'Oxazepam', 'Tiagabina', 'Zolpidem', 'Zopiclona',

  // ── SNC: Antipsicóticos ─────────────────────────────────────────────
  'Aripiprazol', 'Clorpromazina', 'Clozapina', 'Droperidol', 'Flufenazina',
  'Haloperidol', 'Levomepromazina', 'Olanzapina', 'Paliperidona',
  'Pimozida', 'Quetiapina', 'Risperidona', 'Sulpirida', 'Tioridazina',
  'Trifluoperazina', 'Ziprasidona',

  // ── SNC: Anticonvulsivantes / Estabilizadores de humor ──────────────
  'Carbamazepina', 'Clobazam', 'Etossuximida', 'Fenitoína', 'Fenobarbital',
  'Gabapentina', 'Lacosamida', 'Lamotrigina', 'Levetiracetam', 'Lítio',
  'Oxcarbazepina', 'Pregabalina', 'Primidona', 'Topiramato', 'Vigabatrina',
  'Valproato de sódio', 'Ácido Valproico',

  // ── SNC: Parkinson / Alzheimer ──────────────────────────────────────
  'Donepezila', 'Galantamina', 'Levodopa', 'Levodopa + Carbidopa',
  'Memantina', 'Pramipexol', 'Rasagilina', 'Rivastigmina', 'Ropinirol',
  'Selegilina',

  // ── SNC: Estimulantes / TDAH ────────────────────────────────────────
  'Atomoxetina', 'Lisdexanfetamina', 'Metilfenidato', 'Modafinila',

  // ── Hormônios / Endócrino ───────────────────────────────────────────
  'Cabergolina', 'Calcitriol', 'Carbimazol', 'Desmopressina', 'Estradiol',
  'Estriol', 'Etinilestradiol', 'Levonorgestrel', 'Levotiroxina',
  'Liotironina', 'Medroxiprogesterona', 'Metimazol', 'Noretisterona',
  'Octreotida', 'Prednisolona', 'Prednisona', 'Progesterona',
  'Propiltiouracila', 'Tibolona',

  // ── Corticoides sistêmicos / tópicos ────────────────────────────────
  'Beclometasona', 'Betametasona', 'Clobetasol', 'Cortisona',
  'Dexametasona', 'Hidrocortisona', 'Metilprednisolona', 'Triancinolona',

  // ── Urologia / Próstata / Disfunção ─────────────────────────────────
  'Alfuzosina', 'Doxazosina', 'Dutasterida', 'Finasterida', 'Sildenafila',
  'Solifenacina', 'Tadalafila', 'Tamsulosina', 'Tansulosina', 'Tolterodina',
  'Vardenafila',

  // ── Ginecologia / Anticoncepcionais ─────────────────────────────────
  'Ciproterona', 'Desogestrel', 'Drospirenona', 'Etonogestrel',
  'Gestodeno', 'Levonorgestrel', 'Mifepristona', 'Nomegestrol',

  // ── Suplementos / Vitaminas / Minerais ──────────────────────────────
  'Ácido Fólico', 'Cálcio', 'Carbonato de Cálcio', 'Cianocobalamina',
  'Citrato de Magnésio', 'Cloreto de Potássio', 'Coenzima Q10',
  'Colecalciferol', 'Ferro', 'Magnésio', 'Ômega 3', 'Piridoxina',
  'Riboflavina', 'Sulfato Ferroso', 'Tiamina', 'Vitamina A',
  'Vitamina B1', 'Vitamina B6', 'Vitamina B12', 'Vitamina C',
  'Vitamina D', 'Vitamina D3', 'Vitamina E', 'Vitamina K', 'Zinco',

  // ── Outros ──────────────────────────────────────────────────────────
  'Alopurinol', 'Colchicina', 'Febuxostate',
  'Latanoprosta', 'Timolol', 'Bimatoprosta',
  'Metotrexato', 'Leflunomida', 'Sulfassalazina',
  'Aciclovir tópico', 'Hidroxiureia',

  // ── Vacinas (consumo doméstico, lembretes) ──────────────────────────
  'Vacina Hepatite B', 'Vacina Influenza', 'Vacina Tétano',
  'Vacina Tríplice Viral', 'Vacina HPV', 'Vacina Pneumocócica',
  'Vacina COVID-19',

  // ── Nomes comerciais populares no Brasil ────────────────────────────
  'Adalat', 'Aerolin', 'Aerogastrol', 'Allegra', 'Allegra 6mg/ml',
  'Anador', 'Apresoline', 'Aradois', 'Aspirina',
  'Atrovent', 'Berotec', 'Buscopan', 'Buscopan Composto',
  'Bup 300XL', 'Carbolitium', 'Cataflam', 'Cebion', 'Centrum',
  'Cialis', 'Citrussol', 'Clavulin', 'Clenil A', 'Clenil HFA',
  'Clenil HFA 200mcg', 'Climene', 'Cloridrato de Sertralina',
  'Concor', 'Crestor', 'Decadron', 'Decadron 0.1mg/ml - Solução Oral',
  'Diane', 'Dorflex', 'Dorzolamida', 'Dramin', 'Dramin B6',
  'Duo Decongex', 'Duspatalin', 'Engov', 'Estalix', 'Eutirox',
  'Exodus', 'Fioricet', 'Floratil', 'Flutamida', 'Frontal',
  'Glifage', 'Hipoglós', 'Histamin', 'Imodium', 'Inalapril',
  'Januvia', 'Jardiance', 'Lasix', 'Lavitan', 'Lexapro', 'Lexotan',
  'Lipitor', 'Lisador', 'Loratamed', 'Losartec', 'Marevan',
  'Maxalt', 'Melhoral', 'Merthiolate', 'Micardis', 'Microvlar',
  'Migrium', 'Motilium', 'Naldecon', 'Nasonex', 'Neosaldina',
  'Norvasc', 'Novalgina', 'Olmetec', 'Ongliza', 'Ozempic',
  'Pancreoflat', 'Pantogar', 'Plasil', 'Plavix', 'Polaramine',
  'Ponstan', 'Pradaxa', 'Predsim', 'Profenid', 'Puran T4',
  'Reaxis', 'Rivotril', 'Saxenda', 'Selozok', 'Sempre Viva',
  'Sertralina', 'Singulair', 'Sintrom', 'Sonebon', 'Stresam',
  'Synthroid', 'Tadalafila', 'Tegretol', 'Tenoxen', 'Tiazac',
  'Tolvon', 'Toragesic', 'Trileptal', 'Trofera', 'Tylenol',
  'Tylex', 'Valium', 'Viagra', 'Voltaren', 'Xanax',
  'Xarelto', 'Xeplion', 'Yasmin', 'Zantac', 'Zoladex', 'Zoloft',
  'Zyban', 'Zyprexa',
].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

/**
 * Retorna a melhor sugestão para o prefixo digitado (legado, single-match).
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

const norm = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Retorna até `limit` sugestões ordenadas: matches "starts-with" primeiro,
 * depois "contains". Diacritic + case insensitive.
 *
 * @param prefix      texto digitado pelo usuário
 * @param limit       máximo de sugestões a retornar (default 6)
 * @param extraMeds   array opcional de medicamentos do histórico do usuário
 *                    (priorizados acima da lista hardcoded para personalização)
 */
export function suggestMedications(prefix, limit = 6, extraMeds = []) {
  if (!prefix || prefix.length < 2) return []
  const q = norm(prefix)

  // Merge sources: extras first (user history priority), dedup case-insensitively
  const seen = new Set()
  const merged = []
  for (const list of [extraMeds, MEDICATIONS]) {
    for (const m of list) {
      if (!m) continue
      const key = norm(m)
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(m)
      }
    }
  }

  const startsWith = []
  const contains = []
  for (const m of merged) {
    const n = norm(m)
    if (n.startsWith(q)) startsWith.push(m)
    else if (n.includes(q)) contains.push(m)
    if (startsWith.length >= limit) break
  }
  return [...startsWith, ...contains].slice(0, limit)
}
