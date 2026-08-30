// ═══════════════════════════════════════════════════════════
// clevia Täuschungs-Radar
// ───────────────────────────────────────────────────────────
// Deckt auf, womit Verbraucher laut Alternative-/Biohacking-Wissen
// getäuscht werden – über den Zucker und den Frosch hinaus. Jeder
// Eintrag ist BELEGBAR und RECHTSSICHER im Konjunktiv formuliert:
//
//   "steht in der Kritik, weil es X enthalten KÖNNTE"
//   "wird in Verbindung gebracht mit..."
//   "Kritiker sehen darin..."
//   "in der EU aus Sorge vor X verboten" (Faktum)
//
// So bleibt clevia scharf UND unangreifbar: Eine als Kritik/Möglichkeit
// gekennzeichnete, öffentlich dokumentierte Aussage ist keine
// verklagbare Tatsachenbehauptung.
//
// Zwei Ebenen:
//   1. TARN_BEGRIFFE: Sammelbegriffe, die etwas verstecken können.
//   2. VERSTECKTE_STOFFE: konkrete Stoffe, deren Risiko Verbraucher
//      nicht kennen (aber die deklariert sind).
// ═══════════════════════════════════════════════════════════

// ── Ebene 1: Tarn-Sammelbegriffe ──
// Begriffe, hinter denen sich Undeklariertes verstecken KANN.
export const TARN_BEGRIFFE = {
  'aroma': {
    tarnt: 'Der Begriff „Aroma" ist ein Sammelbegriff – dahinter könnten zahlreiche nicht einzeln deklarierte Stoffe stecken.',
    kritik: 'Kritiker bemängeln, dass sich hinter „Aroma"/„natürliches Aroma" Substanzen verbergen könnten, die Verbraucher so nicht erkennen.',
    beleg: 'Center for Science in the Public Interest (CSPI)',
    ampel: 'gelb',
  },
  'natürliches aroma': {
    tarnt: '„Natürliches Aroma" klingt harmlos, ist aber ebenfalls ein Sammelbegriff – auch hier könnten verschiedene verarbeitete Stoffe enthalten sein.',
    kritik: '„Natürlich" bezieht sich hier nur auf den Ursprung des Ausgangsstoffs, nicht auf einen naturbelassenen Endstoff – der könnte stark verarbeitet sein.',
    beleg: 'CSPI; Clean-Label-Kritik',
    ampel: 'gelb',
  },
  'aromen': {
    tarnt: 'Sammelbegriff – dahinter könnten mehrere nicht einzeln aufgeführte Stoffe stehen.',
    kritik: 'Was genau enthalten ist, bleibt für Verbraucher oft im Dunkeln.',
    beleg: 'CSPI',
    ampel: 'gelb',
  },
  'gewürze': {
    tarnt: 'Auch „Gewürze"/„Gewürzmischung" kann als Sammelbegriff dienen, unter dem Zusätze nicht einzeln genannt werden.',
    kritik: 'Kritiker sehen darin eine Möglichkeit, Einzelstoffe zu verbergen.',
    beleg: 'CSPI',
    ampel: 'gelb',
  },
  'gewürzmischung': {
    tarnt: 'Sammelbegriff, unter dem einzelne Zusätze verschwinden könnten.',
    kritik: 'Die genaue Zusammensetzung bleibt oft unklar.',
    beleg: 'CSPI',
    ampel: 'gelb',
  },
  'pflanzliche fette': {
    tarnt: 'Unspezifisch – es könnte sich um billige, stark verarbeitete Fette (z.B. Palmöl) handeln.',
    kritik: 'Die genaue Fettquelle und ihr Verarbeitungsgrad bleiben verborgen.',
    beleg: 'Clean-Label-Kritik',
    ampel: 'gelb',
  },
};

// ── Ebene 2: Konkrete Stoffe mit unbekanntem Risiko ──
// Deklarierte Stoffe, deren Problematik Verbraucher meist nicht kennen.
export const VERSTECKTE_STOFFE = {
  'titandioxid': {
    aka: ['titanium dioxide', 'e171', 'ci 77891'],
    hinweis: 'Farbstoff (Weißmacher) in Süßwaren, Kaugummi, Dragees.',
    kritik: 'Enthält Nanopartikel, die sich im Körper anreichern könnten und deren Unbedenklichkeit die Low-Tox-Sicht anzweifelt – ein rein kosmetischer Farbstoff ohne Nutzen. (Selbst die EU hat ihn 2022 verboten, weil eine Erbgutschädigung nicht ausgeschlossen werden konnte; in vielen Ländern weiter erlaubt.)',
    beleg: 'Low-Tox-/Nanopartikel-Kritik; zusätzlich EU-Verbot 2022, Foodwatch',
    ampel: 'rot',
  },
  'carrageen': {
    aka: ['carrageenan', 'e407', 'carrageen (e407)'],
    hinweis: 'Verdickungsmittel aus Rotalgen, in Pflanzendrinks, Milchprodukten, Dressings.',
    kritik: 'Wird in Studien mit Darmentzündungen in Verbindung gebracht; Kritiker raten empfindlichen Personen zur Vorsicht.',
    beleg: 'Consumer Reports; CSPI',
    ampel: 'rot',
  },
  'carboxymethylcellulose': {
    aka: ['cmc', 'e466', 'cellulose gum'],
    hinweis: 'Emulgator/Verdickungsmittel in verarbeiteten Lebensmitteln.',
    kritik: 'Emulgatoren wie CMC werden in Studien mit Veränderungen der Darmflora in Verbindung gebracht.',
    beleg: 'Consumer Reports; Emulgator-Forschung',
    ampel: 'rot',
  },
  'magnesiumstearat': {
    aka: ['magnesium stearate', 'e470b', 'magnesiumsalze der speisefettsäuren'],
    hinweis: 'Trenn-/Füllmittel, häufig in Nahrungsergänzungen und Tabletten.',
    kritik: 'Kritiker vermuten, dass es die Aufnahme von Wirkstoffen behindern könnte und als Füllstoff die eigentliche Wirkstoffmenge senkt.',
    beleg: 'Supplement-Qualitätskritik (u.a. St-Onge et al. 2005)',
    ampel: 'gelb',
  },
  'natriumnitrit': {
    aka: ['sodium nitrite', 'e250', 'nitritpökelsalz'],
    hinweis: 'Konservierungs-/Pökelstoff in Wurst und verarbeitetem Fleisch.',
    kritik: 'Kann beim Erhitzen Nitrosamine bilden, die als potenziell krebserregend gelten; verarbeitetes Fleisch wird entsprechend kritisch gesehen.',
    beleg: 'IARC-Einordnung verarbeitetes Fleisch; Lebensmittelkritik',
    ampel: 'rot',
  },
  'mononatriumglutamat': {
    aka: ['msg', 'e621', 'geschmacksverstärker', 'monosodium glutamate', 'natriumglutamat'],
    hinweis: 'Geschmacksverstärker in Fertiggerichten, Snacks, Brühen.',
    kritik: 'Kritiker bringen es mit Überempfindlichkeitsreaktionen in Verbindung und sehen es als Zeichen stark verarbeiteter Produkte.',
    beleg: 'Lebensmittelkritik; Clean-Label-Bewegung',
    ampel: 'gelb',
  },
  'aspartam': {
    aka: ['aspartame', 'e951'],
    hinweis: 'Synthetischer Süßstoff in Light-Produkten, Kaugummi, Getränken.',
    kritik: 'Wurde 2023 von der IARC als „möglicherweise krebserregend" eingestuft; Kritiker meiden ihn.',
    beleg: 'IARC 2023; WHO',
    ampel: 'rot',
  },
  'bha': {
    aka: ['butylhydroxyanisol', 'e320'],
    hinweis: 'Synthetisches Antioxidans/Konservierer.',
    kritik: 'Wird als möglicherweise hormonell wirksam und potenziell krebserregend diskutiert; in einigen Regionen eingeschränkt.',
    beleg: 'Consumer Reports; Zusatzstoff-Bewertungen',
    ampel: 'rot',
  },
  'bht': {
    aka: ['butylhydroxytoluol', 'e321'],
    hinweis: 'Synthetisches Antioxidans, oft zusammen mit BHA.',
    kritik: 'Ähnlich wie BHA als hormonell diskutiert und in der Kritik.',
    beleg: 'Zusatzstoff-Bewertungen',
    ampel: 'rot',
  },

  // ── Stoffe, die die EU ERLAUBT, die Low-Tox-Sicht aber ablehnt ──
  // (Genau clevias Punkt: EU ist NICHT der Maßstab.)
  'glyphosat': {
    aka: ['glyphosate', 'glyphosat-rückstände'],
    hinweis: 'Unkrautvernichter-Rückstand, v.a. in konventionellem Getreide, Hülsenfrüchten, Hafer.',
    kritik: 'Von der IARC als „wahrscheinlich krebserregend" eingestuft – die EU hält trotzdem an der Zulassung fest. Die Low-Tox-Sicht meidet Rückstände konsequent und setzt auf Bio.',
    beleg: 'IARC 2015; Low-Tox-/Bio-Bewegung (EU-Zulassung trotz Kritik)',
    ampel: 'rot',
  },
  'phosphat': {
    aka: ['phosphate', 'natriumphosphat', 'e338', 'e339', 'e340', 'e341', 'e450', 'e451', 'e452'],
    hinweis: 'Phosphatzusätze in Schmelzkäse, Cola, Wurst, Backwaren.',
    kritik: 'Werden mit Gefäß- und Nierenbelastung in Verbindung gebracht; die EU erlaubt sie, die Low-Tox-Sicht meidet zugesetzte Phosphate.',
    beleg: 'Phosphat-Forschung; Low-Tox-Kritik (EU-erlaubt)',
    ampel: 'rot',
  },
  'azofarbstoff': {
    aka: ['e102', 'e104', 'e110', 'e122', 'e124', 'e129', 'tartrazin', 'gelborange s', 'azorubin', 'allurarot'],
    hinweis: 'Synthetische Azo-Farbstoffe in Süßwaren, Getränken, Fertigprodukten.',
    kritik: 'Werden mit Hyperaktivität bei Kindern in Verbindung gebracht (Southampton-Studie); in der EU nur mit Warnhinweis erlaubt, die Low-Tox-Sicht meidet sie ganz.',
    beleg: 'Southampton-Studie 2007; EU-Warnhinweispflicht (nicht Verbot)',
    ampel: 'rot',
  },
  'aluminium': {
    aka: ['aluminum', 'e173', 'aluminiumsulfat', 'e520', 'e521', 'e523', 'natrium-aluminium-phosphat', 'e541'],
    hinweis: 'Aluminiumverbindungen in Backtriebmitteln, Farbüberzügen, verarbeiteten Produkten.',
    kritik: 'Aluminium-Aufnahme über Nahrung wird kritisch gesehen (neurologische Bedenken); die EU setzt nur Höchstmengen, die Low-Tox-Sicht meidet Zusätze.',
    beleg: 'Low-Tox-Kritik; EFSA-Höchstmengen (nicht Verbot)',
    ampel: 'rot',
  },
};

function norm(s) {
  return String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

// Erkennt einen versteckten Stoff über Name oder AKA/E-Nummer.
function erkenneStoff(zutat) {
  const z = norm(zutat);
  if (!z) return null;
  for (const [name, info] of Object.entries(VERSTECKTE_STOFFE)) {
    if (z === name || z.includes(name)) return { name, ...info };
    if ((info.aka || []).some(a => z === a || z.includes(a))) return { name, ...info };
  }
  return null;
}

// Erkennt einen Tarn-Sammelbegriff.
function erkenneTarnbegriff(zutat) {
  const z = norm(zutat);
  if (!z) return null;
  // Längste Treffer zuerst ("natürliches aroma" vor "aroma").
  const keys = Object.keys(TARN_BEGRIFFE).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (z === key || z.includes(key)) return { begriff: key, ...TARN_BEGRIFFE[key] };
  }
  return null;
}

// ═══ HAUPT: Täuschungen in einer Zutatenliste aufdecken ══════
export function deckeTaeuschungAuf(zutaten) {
  const liste = (zutaten || []).map(norm).filter(Boolean);
  if (liste.length === 0) return { gefunden: false, funde: [] };

  const funde = [];
  const gesehen = new Set();

  liste.forEach(zutat => {
    // Versteckte Stoffe (konkret, oft rot).
    const stoff = erkenneStoff(zutat);
    if (stoff && !gesehen.has('s:' + stoff.name)) {
      gesehen.add('s:' + stoff.name);
      funde.push({
        typ: 'stoff',
        name: stoff.name,
        hinweis: stoff.hinweis,
        kritik: stoff.kritik,
        beleg: stoff.beleg,
        ampel: stoff.ampel,
      });
    }
    // Tarn-Sammelbegriffe.
    const tarn = erkenneTarnbegriff(zutat);
    if (tarn && !gesehen.has('t:' + tarn.begriff)) {
      gesehen.add('t:' + tarn.begriff);
      funde.push({
        typ: 'tarnbegriff',
        name: tarn.begriff,
        tarnt: tarn.tarnt,
        kritik: tarn.kritik,
        beleg: tarn.beleg,
        ampel: tarn.ampel,
      });
    }
  });

  // Schlimmste Ampel bestimmen.
  let schlimmste = 'gruen';
  if (funde.some(f => f.ampel === 'rot')) schlimmste = 'rot';
  else if (funde.some(f => f.ampel === 'gelb')) schlimmste = 'gelb';

  return {
    gefunden: funde.length > 0,
    funde,
    anzahl: funde.length,
    schlimmsteAmpel: schlimmste,
  };
}

// Erzeugt kompakte UI-Hinweise (Liste von Warntexten, rechtssicher).
export function taeuschungHinweise(zutaten) {
  const a = deckeTaeuschungAuf(zutaten);
  if (!a.gefunden) return [];
  return a.funde.map(f => {
    if (f.typ === 'stoff') {
      const warnsymbol = f.ampel === 'rot' ? '⚠️ ' : '';
      return {
        titel: `${warnsymbol}${grossAnfang(f.name)}`,
        text: `${f.hinweis} ${f.kritik}`,
        beleg: f.beleg,
        ampel: f.ampel,
      };
    }
    return {
      titel: `Sammelbegriff „${grossAnfang(f.name)}"`,
      text: `${f.tarnt} ${f.kritik}`,
      beleg: f.beleg,
      ampel: f.ampel,
    };
  });
}

function grossAnfang(s) {
  return String(s || '').replace(/^\w/, c => c.toUpperCase());
}

export const _intern = {
  erkenneStoff, erkenneTarnbegriff, norm,
  TARN_ANZAHL: Object.keys(TARN_BEGRIFFE).length,
  STOFF_ANZAHL: Object.keys(VERSTECKTE_STOFFE).length,
};
