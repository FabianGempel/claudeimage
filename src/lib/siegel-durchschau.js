// ═══════════════════════════════════════════════════════════
// clevia Siegel-Durchschau
// ───────────────────────────────────────────────────────────
// Die alternative Biohacking-Perspektive auf Gütesiegel: Was ein
// Siegel WIRKLICH (nicht) bedeutet — die kritische Wahrheit, die
// Verbraucher nicht kennen. Nicht das geglättete Mainstream-Narrativ.
//
// WICHTIG — jede Aussage ist belegbar formuliert:
//   • Fakten über den Standard ("deckt nur X% ab") → als Fakt.
//   • Kritik → als Kritik gekennzeichnet, mit Quelle.
// So bleibt clevia scharf UND rechtlich unangreifbar. Ein Konzern
// kann eine belegte Tatsache oder eine als solche gekennzeichnete,
// öffentlich dokumentierte Kritik nicht wegklagen.
//
// Struktur: siegelKey → {
//   name, klartext (was Verbraucher denken),
//   wahrheit[] (kritische Fakten, je {punkt, beleg}),
//   deckt_ab[], deckt_nicht_ab[],  (was das Siegel prüft / nicht prüft)
//   bio (ist es Bio?), gmo_frei (schließt es GMO aus?)
// }
// ═══════════════════════════════════════════════════════════

export const SIEGEL_DB = {
  'rainforest alliance': {
    name: 'Rainforest Alliance (grüner Frosch)',
    warnung: 'Vorsicht bei RFA',
    klartext: 'Wirkt wie ein Öko- und Nachhaltigkeitssiegel für Kaffee, Tee, Kakao, Schokolade.',
    biohacker: 'In der Biohacking-/Alternative-Community gilt RFA als Warnsignal, nicht als Gütezeichen – wer bewusst konsumiert, meidet Produkte, bei denen der Frosch das stärkste "Argument" ist.',
    wahrheit: [
      { punkt: 'Nur 30 % des Produkts müssen zertifiziert sein – bis zu 70 % dürfen unzertifiziert sein.', beleg: 'Rainforest-Alliance-Mengenbilanz-Regel (Mass Balance)' },
      { punkt: 'Bedeutet NICHT Bio – Pestizide sind erlaubt, nur die gefährlichsten sind verboten (deren Ausstieg wurde gerade um 2–3 Jahre verlängert).', beleg: 'RA Exceptional Use Policy, Stand 2025' },
      { punkt: 'Steht massiv in der Kritik als Greenwashing – Greenpeace („Destruction: Certified", 2021) und Corporate Accountability Lab sehen solche Siegel als über die Zeit verwässert und industrienah.', beleg: 'Greenpeace 2021; Corporate Accountability Lab' },
      { punkt: 'Audit-Schwächen und Einfluss von Industriegruppen werden kritisiert – Kritiker sagen, das Siegel diene eher den Konzernen als Mensch und Natur.', beleg: 'Ethical Consumer; Green Stars Project' },
    ],
    deckt_ab: ['Teilweise Anbaupraktiken', 'Mindestlohn-Vorgaben', 'gewisse Waldschutz-Kriterien'],
    deckt_nicht_ab: ['Bio-Qualität', 'vollständige Pestizidfreiheit', '100 % des Produktinhalts'],
    bio: false,
    gmo_frei: true,   // RA verbietet GMO tatsächlich – hier ehrlich bleiben, sonst angreifbar
    einordnung: 'rot',
  },

  'fairtrade': {
    name: 'Fairtrade',
    klartext: 'Wirkt wie eine Garantie für faire Bezahlung und ethische Produktion.',
    wahrheit: [
      { punkt: 'Fairtrade-Prämie ist real, aber die Standards wurden laut Kritikern über die Zeit verwässert.', beleg: 'Corporate Accountability Lab 2023' },
      { punkt: 'Auch hier gilt oft Mengenbilanz – der zertifizierte Rohstoff muss nicht physisch im Produkt sein (z.B. bei Kakao/Zucker).', beleg: 'Fairtrade Mengenausgleich' },
      { punkt: 'Bedeutet NICHT Bio und schließt GMO nicht grundsätzlich aus.', beleg: 'Fairtrade-Standard' },
    ],
    deckt_ab: ['Mindestpreis für Bauern', 'Prämienzahlung', 'soziale Kriterien'],
    deckt_nicht_ab: ['Bio-Qualität', 'GMO-Freiheit', 'physische Rückverfolgbarkeit im Produkt'],
    bio: false,
    gmo_frei: false,
    einordnung: 'gelb',
  },

  'utz': {
    name: 'UTZ (in Rainforest Alliance aufgegangen)',
    klartext: 'Altes Nachhaltigkeitssiegel für Kaffee/Kakao.',
    wahrheit: [
      { punkt: '2018 mit Rainforest Alliance fusioniert – dieselben Kritikpunkte (Mengenbilanz, kein Bio).', beleg: 'RA/UTZ Fusion 2018' },
    ],
    deckt_ab: ['gewisse Anbaupraktiken'],
    deckt_nicht_ab: ['Bio', 'GMO-Freiheit', 'volle Rückverfolgbarkeit'],
    bio: false,
    gmo_frei: false,
    einordnung: 'gelb',
  },

  'nutri-score': {
    name: 'Nutri-Score',
    warnung: 'Industrie-Ampel, kein Gesundheits-Kompass',
    klartext: 'Wirkt wie eine Gesundheits-Ampel (A–E) für Lebensmittel.',
    biohacker: 'Biohacker durchschauen den Nutri-Score als industriefreundliches System: Großkonzerne lieben ihn, weil hochverarbeitete Light-Produkte ein grünes A bekommen, während echte Naturfette (Olivenöl, Butter, Nüsse) abgestraft werden. Wer clean isst, ignoriert ihn.',
    wahrheit: [
      { punkt: 'Bewertet nur Nährwerte pro 100 g – nicht Verarbeitungsgrad, Zusatzstoffe, Süßstoffe oder Herkunft.', beleg: 'Nutri-Score-Algorithmus' },
      { punkt: 'Hochverarbeitete Light-/Diät-Produkte mit Süßstoffen bekommen oft ein A – natürliche Fette wie Olivenöl schneiden schlechter ab. Ein Vorteil für die Verarbeitungsindustrie.', beleg: 'öffentlich dokumentierte Nutri-Score-Kritik' },
      { punkt: 'Große Lebensmittelkonzerne begrüßen und bewerben den Nutri-Score aktiv – Kritiker sehen darin bewusste Instrumentalisierung zugunsten verarbeiteter Produkte.', beleg: 'Branchen-Berichterstattung zu Nutri-Score' },
      { punkt: 'Sagt nichts über synthetische Süßstoffe, Aromen oder Zusatzstoffe – genau die Dinge, die eine Low-Tox-Sicht am meisten interessieren.', beleg: 'Nutri-Score deckt Zusatzstoffe nicht ab' },
    ],
    deckt_ab: ['Kalorien grob', 'Zucker/Salz/Fett grob', 'Ballaststoffe'],
    deckt_nicht_ab: ['Verarbeitungsgrad', 'Zusatzstoffe', 'Süßstoffe', 'Herkunft', 'echte Lebensmittelqualität'],
    bio: false,
    gmo_frei: false,
    einordnung: 'rot',
  },

  'v-label': {
    name: 'V-Label (vegan/vegetarisch)',
    klartext: 'Wirkt wie ein Garant für gesunde pflanzliche Ernährung.',
    wahrheit: [
      { punkt: 'Sagt NUR, dass keine tierischen Zutaten drin sind – nichts über Gesundheit oder Verarbeitung.', beleg: 'V-Label-Kriterien' },
      { punkt: 'Hochverarbeitete vegane Produkte mit vielen Zusatzstoffen tragen es genauso.', beleg: 'V-Label deckt Verarbeitung nicht ab' },
    ],
    deckt_ab: ['keine tierischen Zutaten'],
    deckt_nicht_ab: ['Gesundheit', 'Verarbeitungsgrad', 'Zusatzstoffe', 'Bio'],
    bio: false,
    gmo_frei: false,
    einordnung: 'gelb',
  },

  // Positiv-Beispiele: Siegel, die aus alternativer Sicht WIRKLICH etwas bedeuten
  'demeter': {
    name: 'Demeter (biodynamisch)',
    klartext: 'Biodynamisches Anbausiegel.',
    wahrheit: [
      { punkt: 'Strengstes gängiges Bio-Siegel – deutlich über EU-Bio: geschlossene Kreisläufe, kein Zukauf von Kunstdünger, strenge Zusatzstoff-Beschränkung.', beleg: 'Demeter-Richtlinien' },
      { punkt: 'Verbietet GMO und synthetische Pestizide vollständig.', beleg: 'Demeter-Standard' },
    ],
    deckt_ab: ['Bio-Qualität (über EU-Bio)', 'GMO-frei', 'kaum Zusatzstoffe', 'biodynamische Praxis'],
    deckt_nicht_ab: [],
    bio: true,
    gmo_frei: true,
    einordnung: 'gruen',
  },

  'bioland': {
    name: 'Bioland',
    klartext: 'Deutsches Bio-Anbausiegel.',
    wahrheit: [
      { punkt: 'Strenger als EU-Bio – ganzer Betrieb muss umgestellt sein, weniger erlaubte Zusatzstoffe.', beleg: 'Bioland-Richtlinien' },
      { punkt: 'GMO und chemisch-synthetische Pestizide verboten.', beleg: 'Bioland-Standard' },
    ],
    deckt_ab: ['Bio (über EU-Bio)', 'GMO-frei', 'Gesamtbetrieb-Umstellung'],
    deckt_nicht_ab: [],
    bio: true,
    gmo_frei: true,
    einordnung: 'gruen',
  },

  'eu bio': {
    name: 'EU-Bio-Siegel',
    klartext: 'Wirkt wie ein starkes Bio-Garant.',
    wahrheit: [
      { punkt: 'Mindeststandard für Bio – besser als konventionell, aber schwächer als Demeter/Bioland/Naturland.', beleg: 'EU-Öko-Verordnung' },
      { punkt: 'Erlaubt mehr Zusatzstoffe und Ausnahmen als die Anbauverbände.', beleg: 'Vergleich EU-Bio vs. Verbände' },
    ],
    deckt_ab: ['GMO-frei', 'keine synthetischen Pestizide', 'Bio-Mindeststandard'],
    deckt_nicht_ab: ['höchste Bio-Stufe', 'strengste Zusatzstoff-Regeln'],
    bio: true,
    gmo_frei: true,
    einordnung: 'gruen',
  },
};

// Marken, die aus alternativer Sicht Aufmerksamkeit verdienen (Greenwashing-Verdacht).
// NUR belegbare/als Kritik gekennzeichnete Aussagen.
export const MARKEN_DURCHSCHAU = {
  'frosch': {
    name: 'Frosch (Werner & Mertz)',
    einordnung: 'Positiv aus Öko-Sicht: eigenständiges deutsches Unternehmen, Recyclat-Initiative. Kein Großkonzern-Greenwashing.',
    bewertung: 'gruen',
  },
};

function normSiegel(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[®™]/g, '').trim();
}

// ═══ HAUPT: Siegel durchschauen ══════════════════════════════
// Nimmt erkannte Siegel-Namen (aus Etikett/labels_tags) und gibt die
// kritische Durchschau zurück.
export function durchschaueSiegel(siegelName) {
  const key = normSiegel(siegelName);
  if (!key) return null;
  // Direkter Treffer oder Teilstring (Etikett schreibt oft "rainforest alliance certified").
  let treffer = SIEGEL_DB[key];
  if (!treffer) {
    for (const [k, v] of Object.entries(SIEGEL_DB)) {
      if (key.includes(k) || k.includes(key)) { treffer = v; break; }
    }
  }
  if (!treffer) return null;
  return {
    gefunden: true,
    name: treffer.name,
    warnung: treffer.warnung || null,
    klartext: treffer.klartext,
    biohacker: treffer.biohacker || null,
    wahrheit: treffer.wahrheit,
    decktAb: treffer.deckt_ab,
    decktNichtAb: treffer.deckt_nicht_ab,
    bio: treffer.bio,
    gmoFrei: treffer.gmo_frei,
    einordnung: treffer.einordnung,
  };
}

// Prüft eine Liste erkannter Siegel und gibt alle Durchschauen zurück.
export function durchschaueAlle(siegelListe) {
  const ergebnisse = [];
  for (const s of (siegelListe || [])) {
    const d = durchschaueSiegel(s);
    if (d) ergebnisse.push(d);
  }
  return ergebnisse;
}

// Erzeugt einen kompakten UI-Hinweis für ein Siegel.
export function siegelHinweisText(siegelName) {
  const d = durchschaueSiegel(siegelName);
  if (!d) return null;
  const topWahrheit = d.wahrheit[0]?.punkt || '';
  // Warnung voranstellen, wenn vorhanden (z.B. "Vorsicht bei RFA").
  const kopf = d.warnung ? `⚠️ ${d.warnung} — ${d.name}` : d.name;
  let text = `${kopf}: ${d.klartext} Aber: ${topWahrheit}`;
  return {
    text,
    warnung: d.warnung,
    biohacker: d.biohacker,
    einordnung: d.einordnung,
    bio: d.bio,
    gmoFrei: d.gmoFrei,
    alleWahrheiten: d.wahrheit,
  };
}

export const _intern = { normSiegel, SIEGEL_ANZAHL: Object.keys(SIEGEL_DB).length };
