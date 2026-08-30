// ═══════════════════════════════════════════════════════════
// clevia Muster-Bewertung (Low-Tox-Linie)
// ───────────────────────────────────────────────────────────
// Bewertet Inhaltsstoffe nach MUSTERN (chemische Endungen, Bausteine,
// botanische Nomenklatur) — auch solche, die NICHT in der kuratierten
// KURIERT_DB stehen. Das ist der Hebel gegen zwei Probleme zugleich:
//
//   1. Kein Stoff bleibt "grau/ungeprüft" — fast alles bekommt eine Ampel.
//   2. Synthetisch-Problematisches wird ROT, nicht "kommt drauf an".
//      Das ist die strikte clevia-Linie: Gift ist Gift, keine EU-Konsens-
//      Verharmlosung. Gelb NUR für echte natürliche Dosis-/Herkunftsfragen.
//
// Reihenfolge ist entscheidend: GRÜNE Naturmuster ZUERST (damit ein
// pflanzlicher Stoff nicht vom synthetischen Fallback gefangen wird),
// dann ROTE Problemmuster, dann breite Fallbacks (synthetisch→rot,
// natürlich→grün). Die erste passende Regel gewinnt.
// ═══════════════════════════════════════════════════════════

// Format je Regel: [RegExp, ampel, begründung, [risiko-kategorien]]
export const MUSTER_REGELN = [
  // ── GRÜN: eindeutig natürliche Muster (zuerst, schützen vor Fallback) ──
  [/^[a-zäöü]+ [a-zäöü]+ (leaf|root|seed|fruit|flower|bark|peel|kernel|bud|stem|wood|sprout) (extract|oil|water|juice|butter|wax|powder)/i, 'gruen', 'Pflanzlicher Inhaltsstoff (botanische Nomenklatur)', []],
  [/hydrolyzed .*(protein|collagen|keratin|silk|wheat|soy|rice|oat|pea|quinoa)/i, 'gruen', 'Hydrolysiertes Natur-Protein', []],
  [/^(glyceryl|sorbitan|sucrose|polyglyceryl-?\d+) (stearate|oleate|laurate|palmitate|caprylate|cocoate|ricinoleate|isostearate)/i, 'gruen', 'Zucker-/Glycerin-Fettsäureester – milder Emulgator', []],
  [/glucoside$|glucosides$/i, 'gruen', 'Zuckertensid – besonders mild', []],
  [/glutamate$|glycinate$|sarcosinate$|taurate$|isethionate$|lactylate$/i, 'gruen', 'Aminosäure-/Milchsäure-Tensid – mild', []],
  [/tocopherol|tocopheryl|ascorb(ic|yl)|panthenol|niacinamide|bisabolol|allantoin|\burea\b/i, 'gruen', 'Vitamin/hautpflegender Wirkstoff', []],
  [/ferment( filtrate| lysate| extract)?$|lactobacillus|bifida|saccharomyces/i, 'gruen', 'Fermentierter Wirkstoff', []],
  [/ceramide|phytosphingosine|sphingosine|cholesterol$/i, 'gruen', 'Hautidentisches Barriere-Lipid', []],
  [/(butyrospermum|simmondsia|argania|cocos nucifera|olea europaea|rosa|prunus|persea|helianthus|carthamus)/i, 'gruen', 'Pflanzliches Öl/Extrakt (botanisch)', []],
  [/\b(aloe|calendula|chamomilla|camellia|lavandula|rosmarinus|mentha|citrus) /i, 'gruen', 'Pflanzlicher Wirkstoff', []],
  [/(sodium|magnesium|calcium|potassium|zinc) (chloride|sulfate|citrate|gluconate|carbonate|bicarbonate|hyaluronate|pca)$/i, 'gruen', 'Mineralsalz – unbedenklich', []],
  [/xanthan gum|guar|sclerotium gum|cellulose gum|hectorite|bentonite|kaolin|silica$/i, 'gruen', 'Natürliches Verdickungs-/Mineralmittel', []],

  // ── ROT: eindeutig problematische Muster (streng nach Low-Tox-Linie) ──
  [/perfluoro|polyfluoro|fluorotelomer|\bptfe\b|perfluor/i, 'rot', 'PFAS/Fluorverbindung – Ewigkeitschemikalie, bioakkumulativ – meiden', ['hormone', 'umwelt']],
  [/cyclotetrasiloxane|cyclopentasiloxane|cyclohexasiloxane|cyclomethicone/i, 'rot', 'Zyklisches Silikon (D4/D5/D6) – bioakkumulativ – meiden', ['hormone', 'umwelt']],
  [/dimethicone|methicone|siloxane|silsesquioxane|silylate/i, 'rot', 'Silikon – umweltpersistent, legt Film auf Haut/Haar – meiden', ['umwelt']],
  [/paraben$|paraben\b/i, 'rot', 'Paraben – hormonell wirksamer Konservierer – meiden', ['hormone', 'schwangerschaft']],
  [/methylisothiazolinone|benzisothiazolinone|isothiazolinone/i, 'rot', 'Isothiazolinon – Kontaktallergen Nr. 1 – meiden', ['allergie']],
  [/phenylenediamine|aminophenol|\bhc (red|blue|yellow|orange)/i, 'rot', 'Oxidatives Färbemittel – stark allergen – meiden', ['allergie']],
  [/\bpeg[-\s]?\d|\bppg[-\s]?\d|laureth|steareth|ceteareth|oleth|-eth-\d|polysorbate|trideceth|deceth/i, 'rot', 'Ethoxyliert (PEG/-eth-) – 1,4-Dioxan-Risiko, macht Haut durchlässig – meiden', ['krebs']],
  [/acrylate|carbomer|copolymer|crosspolymer|polyquaternium|polyethylene\b|polypropylene\b|nylon-?\d|vp\/|styrene\b/i, 'rot', 'Synthetisches Polymer/Mikroplastik – meiden', ['umwelt']],
  [/quaternium-?\d|-monium chloride|-dimonium|-trimonium/i, 'rot', 'Quartäre Ammoniumverbindung – reizend, umweltpersistent – meiden', ['reizung']],
  [/lauryl sulfate|laureth sulfate|coco-sulfate|olefin sulfonate/i, 'rot', 'Aggressives Sulfat-Tensid – greift Hautbarriere an – meiden', ['reizung']],
  [/\bmea\b|\bdea\b|\btea\b|ethanolamine|cocamide|lauramide/i, 'rot', 'Ethanolamin-Verbindung – Nitrosamin-Risiko – meiden', ['krebs']],
  [/benzophenone|methoxycinnamate|octocrylene|homosalate|avobenzone|octinoxate|ensulizole/i, 'rot', 'Chemischer UV-Filter – hormonell wirksam – meiden', ['hormone']],
  [/formaldehyde|methylene glycol|dmdm hydantoin|imidazolidinyl|diazolidinyl|quaternium-15|bronopol|hydroxymethylglycinate/i, 'rot', 'Formaldehyd/-abspalter – meiden', ['krebs', 'allergie']],
  [/triclosan|triclocarban/i, 'rot', 'Antibakterieller Zusatz – Resistenzen, hormonell – meiden', ['hormone', 'umwelt']],
  [/phthalate|\bdep\b|\bdbp\b|\bdehp\b/i, 'rot', 'Phthalat/Weichmacher – hormonell wirksam – meiden', ['hormone', 'schwangerschaft']],
  [/bisphenol|\bbpa\b|\bbps\b/i, 'rot', 'Bisphenol – hormonell wirksam – meiden', ['hormone']],
  [/paraffin|petrolatum|mineral oil|ozokerite|ceresin|microcrystalline wax|cera microcristallina/i, 'rot', 'Mineralöl-Derivat (erdölbasiert) – Verunreinigungsrisiko – meiden', ['krebs']],
  [/aluminum (chlorohydrate|chloride|zirconium)|aluminium chlorohydrate/i, 'rot', 'Aluminiumsalz – hormonell diskutiert – meiden', ['hormone']],
  [/\bci \d{5}|fd&c|d&c (red|yellow|blue|green)|\b(tartrazine|amaranth|allura|ponceau|azorubine)/i, 'rot', 'Synthetischer Farbstoff – meiden', ['allergie']],
  [/butylated hydroxy|\bbht\b|\bbha\b|butylhydroxy/i, 'rot', 'Synthetisches Antioxidans (BHT/BHA) – hormonell diskutiert – meiden', ['hormone']],
  [/sodium benzoate|potassium sorbate|sorbic acid|benzoic acid|phenoxyethanol|chlorphenesin|ethylhexylglycerin/i, 'rot', 'Synthetischer Konservierer – meiden', ['reizung']],
  [/edta|etidronic|phosphonate|phosphonic/i, 'rot', 'Synthetischer Komplexbildner – schwer abbaubar – meiden', ['umwelt']],

  // ── SYNTHETISCH-FALLBACK: chemische Endungen/Bausteine → rot statt grau ──
  [/(sulfate|sulfonate|sulfosuccinate|phosphate|phosphonate)$/i, 'rot', 'Synthetisches Tensid/Salz – meiden', ['reizung']],
  [/(amine|amide|imide|imine)$/i, 'rot', 'Synthetische Stickstoffverbindung – meiden', []],
  [/(acrylate|methacrylate|acrylamide)/i, 'rot', 'Synthetisches Acrylat/Polymer – meiden', ['umwelt']],
  [/(benzene|toluene|xylene|styrene|phenol)/i, 'rot', 'Aromatische Petrochemikalie – meiden', ['krebs']],
  [/glycol(?!\b)|dioxane|dioxin/i, 'rot', 'Glykol-/Dioxan-Verbindung – meiden', ['krebs']],

  // ── NATUR-FALLBACK: klar natürliche Endungen → grün statt grau ──
  [/(extract|extrakt)$/i, 'gruen', 'Pflanzen-/Naturextrakt', []],
  [/\boil$|\böl$|butter$|wax$|wachs$/i, 'gruen', 'Natürliches Öl/Fett/Wachs', []],
  [/(saft|juice|water|wasser|hydrosol|blüten|leaf|wurzel|kraut)$/i, 'gruen', 'Pflanzlicher Auszug', []],
];

// Bewertet einen Stoff nach den Mustern. Erste passende Regel gewinnt.
// Gibt { a: ampel, grund, kat } oder null (kein Muster passte → bleibt grau).
export function bewerteNachMuster(stoff) {
  if (!stoff) return null;
  const s = String(stoff).toLowerCase().trim();
  for (const [re, ampel, grund, kat] of MUSTER_REGELN) {
    if (re.test(s)) return { a: ampel, grund, kat: kat || [] };
  }
  return null;
}
