-- v0.2.6.4 P0.5 (Roteiro) — Cleanup 458 → 362 catalog rows group_id='outro' AND cmed_class IS NULL.
-- UPDATE em massa baseado em principio_ativo (mesma lógica heurística do RPC classify_medication_robust).
-- Drugs que NÃO bateram com 17-group taxonomy permanecem 'outro' (oncológicos, biológicos, anti-arrítmicos,
-- anti-parkinson, anti-helmínticos específicos, anestésicos, etc) — sem regressão.
-- Resultado: 96 rows movidas para grupos específicos (antibiotico +73, anti_hipertensivo +X, etc).

-- 1) Antibióticos
UPDATE medcontrol.medications_catalog
SET group_id = 'antibiotico'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(amoxi|ampi|peni|oxa)cilin'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(azitro|claritro|eritro|spiramic)micin'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(cipro|levo|nor|moxi|oflo)floxac?in'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(doxi|tetra|mino|tige)ciclin'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'cefa(zolin|lexin|droxil|clor)|cefta|cefur|cefti|cefepim|cefepime'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'metronidazol|sulfame|trimetoprim|nitrofurantoin'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'linezolid|vancomicin|teicoplanin|gentamic|amikacin|tobramic'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'clindamic|rifamp|claritrom|fosfomic'
    OR lower(extensions.unaccent(nome_comercial)) ~ '^(bactrim|resprim|amoxil|keflex|clavulin|sinot|zinnat|cefalexina)'
  );

-- 2) Anti-hipertensivos
UPDATE medcontrol.medications_catalog
SET group_id = 'anti_hipertensivo'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(losar|valsar|olmesar|telmisar|irbesar|cande)tan'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(capto|enala|lisino|rami|fosino|benaze|peri|quina)pril'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(anlo|amlo|nife|nicar|nimo|levanlo|felo|lacid)dipin'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(aten|prop|carve|biso|meto|nebivo|esmo|naden|pind)olol'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'tiazid|furosemid|espironolacton|hidroclorotiazid|clortalidon|bumetanid|indapamid'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'metildopa|clonidin|hidralazin|prazosin|terazosin|doxazosin|minoxidil'
  );

-- 3) Antidepressivos
UPDATE medcontrol.medications_catalog
SET group_id = 'antidepressivo'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(citalo|escitalo)pram'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'sertralin|fluoxetin|paroxetin|duloxetin|venlafaxin|mirtazapin|bupropion|trazodon|nortriptilin|amitriptilin|clomipramin|imipramin|desvenlafaxin|vortioxetin|agomelatin'
  );

-- 4) Ansiolíticos
UPDATE medcontrol.medications_catalog
SET group_id = 'ansiolitico'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(clon|diaz|loraz|midaz|alpr|brom|clob|cloraz)azepam'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'zolpidem|zopiclon|eszopiclon|buspiron'
  );

-- 5) Gastrointestinais
UPDATE medcontrol.medications_catalog
SET group_id = 'gastrointestinal'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(ome|panto|eso|lanso|rabe|dexlanso)prazol'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'ranitidi|famotidi|cimetidin|nizatidin|domperidon|metoclopra|bromopri|alizapri'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'butilbrometo|escopolamin|simeticon|loperamid|racecadotril|ondansetron|granisetron'
  );

-- 6) Anti-inflamatórios
UPDATE medcontrol.medications_catalog
SET group_id = 'anti_inflamatorio'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(ibu|ceto|nabum|flurbi|naproxe|fenoprof|tiapr)profeno'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'diclofenac|nimesulid|meloxicam|piroxicam|tenoxicam|lornoxicam|cetoprofeno'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(cele|etori|valde|paroxe|lumira)coxib'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'mefenamic|acemetacin|sulindac|indometacin|aceclofenac|etodolac'
    OR lower(extensions.unaccent(nome_comercial)) ~ 'mefenamic|cataflam|voltaren'
  );

-- 7) Antitérmicos / Analgésicos
UPDATE medcontrol.medications_catalog
SET group_id = 'antitermico_analgesico'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ 'dipirona|paracetamol|acetaminofen'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'codein|tramadol|morfin|oxicodon|fentanil|metadon|nalbufin|buprenorfin|hidromorfon|hidrocodona'
    OR lower(extensions.unaccent(nome_comercial)) ~ '^(novalgina|tylenol|dorflex)'
  );

-- 8) Hormonais
UPDATE medcontrol.medications_catalog
SET group_id = 'hormonal'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(levo)?tiroxin|tironin|metimazol|propiltiouracil|liotironina'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'estradiol|estriol|estrogeno|estrogenios|progesteron|noretister|levonorgestrel|drospireno|dienogest|gestoden|desogestrel|etinilestradiol|tibolona|raloxifeno'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'testosteron|nandrolon|stanozolol|tamoxifen|anastrozol|letrozol|exemestan|fulvestrant|bicalutamid|flutamid|leuprorelin|goserelin|triptorelin'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'medroxiprogesteron|hidroxiprogesteron|ulipristal|mifepriston|cabergolin|bromocriptin'
  );

-- 9) Corticoides
UPDATE medcontrol.medications_catalog
SET group_id = 'corticoide'
WHERE group_id='outro' AND cmed_class IS NULL
  AND lower(extensions.unaccent(principio_ativo)) ~ 'predniso|prednisol|metilpredni|hidrocort|deflazacort|dexameta|betameta|triamcinolon|fludrocortison|metasona|mometason|fluticason|budesonid|beclometason|ciclesonid|fluocinolon|fluocinonid|halcinonid|clobetasol';

-- 10) Antiviral
UPDATE medcontrol.medications_catalog
SET group_id = 'antiviral'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(aci|vala|fan|gan)clovir'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'oseltamivir|zanamivir|baloxavir|amantadin|rimantadin'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(dolu|ralte|biktarvi|elvi)tegravir|raltegravir'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(rito|loni|saqui|nelfi|fos|atza|daru|tipra|indi)navir'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'tenofovir|emtricitabin|lamivudin|abacavir|zidovudin|estavudin|didanosin|nevirapin|efavirenz|etravirin|rilpivirin|maraviroc'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'sofosbuvir|ledipasvir|velpatasvir|daclatasvir|elbasvir|grazoprevir|simeprevir|boceprevir|telaprevir|paritaprevir|ombitasvir|dasabuvir'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'interferon|peginterferon|ribavirin'
  );

-- 11) Antifúngicos
UPDATE medcontrol.medications_catalog
SET group_id = 'antifungico'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(fluco|cetoco|itraco|voric|posac|isavu)conazol'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'terbinafin|nistatin|griseofulvin|caspofungin|micafungin|anidulafungin|anfotericin|flucitosin|tolnaftato|ciclopirox|amorolfin'
  );

-- 12) Antidiabéticos
UPDATE medcontrol.medications_catalog
SET group_id = 'antidiabetico'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ 'metformin|glibenclamid|gliclazid|glipizid|glimepirid|tolbutamid|nateglinid|repaglinid'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(sita|vilda|saxa|lina|alo|tene)gliptin'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(dapa|empa|cana|ertu|sota)gliflozin'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(sema|tirze|lira|exena|dula|liraglu|albiglu)glutid|tirzepatid'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'insulin|pioglitazon|rosiglitazon|acarbose|miglitol'
  );

-- 13) Broncodilatadores
UPDATE medcontrol.medications_catalog
SET group_id = 'broncodilatador'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(salbu|feno|formo|salme|indaca|olodate|vilante)terol|albuterol'
    OR lower(extensions.unaccent(principio_ativo)) ~ '(ipra|tio|aclidi|umeclidi|glicopir)tropio'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'teofilin|aminofilin|monteluc|zafirlu|cromoglica|nedocromil'
  );

-- 14) Antialérgicos
UPDATE medcontrol.medications_catalog
SET group_id = 'antialergico'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ '(lora|deslora|fexo|cetiri|levocetiri|ru|bilas|ebas|epinas|hidroxizin|ciclezin|olop)tadin|prometazin|hidroxizin'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'dexclorfeniramin|clorfenir|difenidram|cinarizin|loratadin'
  );

-- 15) Vitaminas / Suplementos
UPDATE medcontrol.medications_catalog
SET group_id = 'vitamina'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ 'vitamin|colecalcife|ergocalcife|cianocobalamin|piridoxin|tiamin|riboflavin|niacin|biotin|acido folico|acido pantotenico'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'sulfato ferroso|ferro carbonil|hidroxido ferrico|gluconato ferroso|fumarato ferroso|ferro sacarato|carbonato de calcio|citrato de calcio|gluconato de calcio'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'magnesio|zinco|selenio|iodo|fluor|sulfato de magnesio|cloreto de potassio|cloreto de sodio'
  );

-- 16) Anticoagulantes
UPDATE medcontrol.medications_catalog
SET group_id = 'anticoagulante'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ 'varfarin|warfarin|heparin|enoxaparin|dalteparin|fondaparinux|rivaroxaban|apixaban|edoxaban|dabigatran|fenoprocumon|acenocumarol|protamin'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'clopidogrel|ticagrelor|prasugrel|cilostazol|dipiridamol|ticlopidin'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'acido tranexamico|aminocaproico|etamsilato|fibrinogeno'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'acido acetilsalicilico|aas\b'
    OR lower(extensions.unaccent(nome_comercial)) ~ '^(aas|aspirina)\b'
  );

-- 17) Anti-helmínticos / Anti-protozoários → antibiotico (broad anti-infective)
UPDATE medcontrol.medications_catalog
SET group_id = 'antibiotico'
WHERE group_id='outro' AND cmed_class IS NULL
  AND (
    lower(extensions.unaccent(principio_ativo)) ~ 'albendazol|mebendazol|tiabendazol|pamoato de pirantel|niclosamid|levamisol|praziquantel|nitazoxanid|ivermectin'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'cloroquin|hidroxicloroquin|primaquin|mefloquin|atovaquon|quinin|artemeter|lumefantrin'
    OR lower(extensions.unaccent(principio_ativo)) ~ 'tinidazol|secnidazol|ornidazol|benznidazol|nifurtimox'
  );

-- Re-categorize cascata para treatments + doses afetados
SELECT medcontrol.re_categorize_null_rows();
