// ═══════════════════════════════════════════════════════════
// clevia Zucker-Tarnung
// ───────────────────────────────────────────────────────────
// Der Industrie-Trick: Zucker unter vielen verschiedenen Namen
// aufteilen (Glukosesirup, Dextrose, Maltodextrin, Fruktose,
// Invertzucker ...), damit keiner EINZELN weit oben in der
// Zutatenliste steht. Zutaten sind nach Menge sortiert — steht
// "Zucker" an Position 5 statt 1, wirkt das Produkt harmloser.
//
// clevia deckt das auf: erkennt ALLE Zuckerarten (auch versteckte),
// zählt sie zusammen und zeigt, welche Position Zucker HÄTTE, wenn
// man alle Formen addiert. Genau die Aufklärung, die Biohacker wollen
// und die kein Mainstream-Scanner liefert.
//
// Der Graben: die vollständige, gepflegte Liste der Zucker-Tarnnamen
// (60+) ist kuratierte Arbeit — wie die KURIERT_DB.
// ═══════════════════════════════════════════════════════════

// Alle bekannten Namen für Zucker/zugesetzte Süße. Kuratiert.
// Kategorien helfen bei der Einordnung (Sirupe/isolierte Zucker sind
// aus Low-Tox-Sicht am problematischsten).
export const ZUCKER_NAMEN = {
  // ── Klassischer Zucker ──
  'zucker': 'zucker', 'sugar': 'zucker', 'saccharose': 'zucker', 'sucrose': 'zucker',
  'rohrzucker': 'zucker', 'rübenzucker': 'zucker', 'raffinadezucker': 'zucker',
  'brauner zucker': 'zucker', 'brown sugar': 'zucker', 'kristallzucker': 'zucker',
  'puderzucker': 'zucker', 'gelierzucker': 'zucker', 'vollrohrzucker': 'zucker',
  'kokosblütenzucker': 'zucker', 'rohrohrzucker': 'zucker',

  // ── Sirupe (besonders problematisch – schnell resorbierbar) ──
  'glukosesirup': 'sirup', 'glucosesirup': 'sirup', 'glucose syrup': 'sirup',
  'glukose-fruktose-sirup': 'sirup', 'fruktose-glukose-sirup': 'sirup',
  'glukose-fructose-sirup': 'sirup', 'high fructose corn syrup': 'sirup', 'hfcs': 'sirup',
  'maissirup': 'sirup', 'corn syrup': 'sirup', 'isoglukose': 'sirup', 'isoglucose': 'sirup',
  'agavendicksaft': 'sirup', 'agave syrup': 'sirup', 'agavensirup': 'sirup',
  'ahornsirup': 'sirup', 'maple syrup': 'sirup', 'reissirup': 'sirup', 'rice syrup': 'sirup',
  'weizensirup': 'sirup', 'gerstenmalzsirup': 'sirup', 'malzsirup': 'sirup',
  'dattelsirup': 'sirup', 'zuckerrübensirup': 'sirup', 'karamellsirup': 'sirup',
  'invertzuckersirup': 'sirup', 'invert sugar syrup': 'sirup', 'fruchtsüße': 'sirup',
  'fruchtsirup': 'sirup', 'traubensüße': 'sirup', 'traubensirup': 'sirup',

  // ── Isolierte Einfachzucker (-ose-Endungen) ──
  'glukose': 'einfachzucker', 'glucose': 'einfachzucker', 'dextrose': 'einfachzucker',
  'traubenzucker': 'einfachzucker', 'fruktose': 'einfachzucker', 'fructose': 'einfachzucker',
  'fruchtzucker': 'einfachzucker', 'maltose': 'einfachzucker', 'malzzucker': 'einfachzucker',
  'laktose': 'einfachzucker', 'lactose': 'einfachzucker', 'milchzucker': 'einfachzucker',
  'galaktose': 'einfachzucker', 'invertzucker': 'einfachzucker', 'invert sugar': 'einfachzucker',

  // ── Maltodextrin & Stärkeabbauprodukte (hoher glykämischer Index) ──
  'maltodextrin': 'maltodextrin', 'dextrin': 'maltodextrin', 'polydextrose': 'maltodextrin',

  // ── "Gesund" klingende Zucker (Marketing-Tarnung) ──
  'honig': 'natursüße', 'honey': 'natursüße', 'dicksaft': 'natursüße',
  'dattelpaste': 'natursüße', 'fruchtsaftkonzentrat': 'natursüße',
  'fruit juice concentrate': 'natursüße', 'apfeldicksaft': 'natursüße',
  'birnendicksaft': 'natursüße', 'melasse': 'natursüße', 'molasses': 'natursüße',
};

// Zuckeralkohole (separat – aus Low-Tox-Sicht anders zu bewerten:
// oft ok in Maßen, aber Marketing-Tarnung als "zuckerfrei").
export const ZUCKERALKOHOLE = {
  'xylit': 'zuckeralkohol', 'xylitol': 'zuckeralkohol', 'birkenzucker': 'zuckeralkohol',
  'erythrit': 'zuckeralkohol', 'erythritol': 'zuckeralkohol',
  'sorbit': 'zuckeralkohol', 'sorbitol': 'zuckeralkohol',
  'maltit': 'zuckeralkohol', 'maltitol': 'zuckeralkohol',
  'isomalt': 'zuckeralkohol', 'mannit': 'zuckeralkohol', 'mannitol': 'zuckeralkohol',
  'lactit': 'zuckeralkohol', 'laktit': 'zuckeralkohol',
};

// Synthetische Süßstoffe (aus Low-Tox-Sicht kritisch – rot).
export const SUESSSTOFFE = {
  'aspartam': 'suessstoff', 'aspartame': 'suessstoff',
  'sucralose': 'suessstoff', 'acesulfam': 'suessstoff', 'acesulfam k': 'suessstoff',
  'saccharin': 'suessstoff', 'cyclamat': 'suessstoff', 'neotam': 'suessstoff',
  'e950': 'suessstoff', 'e951': 'suessstoff', 'e952': 'suessstoff',
  'e954': 'suessstoff', 'e955': 'suessstoff', 'e962': 'suessstoff',
  // Stevia als natürlicher Süßstoff separat einordbar, aber hier gelistet
  'steviosid': 'stevia', 'stevioglycoside': 'stevia', 'steviolglycoside': 'stevia',
};

function normZutat(s) {
  return String(s || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

// Prüft, ob eine Zutat eine Zuckerart ist. Gibt {typ, kategorie} oder null.
function erkenneZucker(zutat) {
  const z = normZutat(zutat);
  if (!z) return null;
  // Exakter Treffer zuerst.
  if (ZUCKER_NAMEN[z]) return { art: 'zucker', kategorie: ZUCKER_NAMEN[z] };
  if (ZUCKERALKOHOLE[z]) return { art: 'zuckeralkohol', kategorie: 'zuckeralkohol' };
  if (SUESSSTOFFE[z]) return { art: SUESSSTOFFE[z] === 'stevia' ? 'stevia' : 'suessstoff', kategorie: SUESSSTOFFE[z] };
  // Teilstring: "brauner rohrzucker", "glukosesirup aus mais" etc.
  for (const [name, kat] of Object.entries(ZUCKER_NAMEN)) {
    if (z.includes(name)) return { art: 'zucker', kategorie: kat };
  }
  for (const [name] of Object.entries(ZUCKERALKOHOLE)) {
    if (z.includes(name)) return { art: 'zuckeralkohol', kategorie: 'zuckeralkohol' };
  }
  for (const [name, kat] of Object.entries(SUESSSTOFFE)) {
    if (z.includes(name)) return { art: kat === 'stevia' ? 'stevia' : 'suessstoff', kategorie: kat };
  }
  return null;
}

// ═══ HAUPT: Zucker-Tarnung in einer Zutatenliste aufdecken ═══
// zutaten: Array (in Reihenfolge wie auf Etikett – Reihenfolge = Menge!)
// Gibt Analyse: welche Zuckerarten, wie viele, an welchen Positionen,
// und – der Clou – welche Position "Zucker gesamt" hätte.
export function deckeZuckerAuf(zutaten) {
  const liste = (zutaten || []).map(normZutat).filter(Boolean);
  if (liste.length === 0) return { gefunden: false };

  const zuckerFunde = [];
  liste.forEach((zutat, index) => {
    const z = erkenneZucker(zutat);
    if (z) zuckerFunde.push({ name: zutat, position: index + 1, ...z });
  });

  // Nur echte Zuckerarten (nicht Süßstoffe/Alkohole) für die "Tarnung" zählen.
  const echteZucker = zuckerFunde.filter(f => f.art === 'zucker');
  const suessstoffe = zuckerFunde.filter(f => f.art === 'suessstoff');
  const zuckeralkohole = zuckerFunde.filter(f => f.art === 'zuckeralkohol');

  // clevia-Linie: NATÜRLICHE Süße (Honig, Dattelsüße, Fruchtsaft) ist ok.
  // INDUSTRIEZUCKER (Sirupe, isolierte -osen, Maltodextrin, Raffinade) ist
  // das Problem. Nur die problematischen Formen zählen als "Tarnung".
  const NATUR_KATEGORIEN = ['natursüße'];
  const problematischerZucker = echteZucker.filter(f => !NATUR_KATEGORIEN.includes(f.kategorie));
  const natuerlicherZucker = echteZucker.filter(f => NATUR_KATEGORIEN.includes(f.kategorie));

  // Die eigentliche Tarnung: mehrere verschiedene INDUSTRIEZUCKER-Namen.
  const anzahlVersteckt = problematischerZucker.length;
  const getarnt = anzahlVersteckt >= 2;

  // Beste (früheste) Position der problematischen Zucker.
  const fruehestePos = problematischerZucker.length > 0 ? Math.min(...problematischerZucker.map(f => f.position)) : null;

  // Geschätzte "wahre" Position: Wenn 3 Zucker an Position 4, 6, 9 stehen,
  // stünde der Sammel-Zucker weiter vorne. Konservative Schätzung: die
  // Anzahl der Nicht-Zucker VOR dem ersten Zucker bleibt, aber der
  // Sammelzucker rutscht nach vorne, weil er die Summe mehrerer Einträge ist.
  let wahrePosition = fruehestePos;
  if (getarnt && fruehestePos) {
    // Grobe Heuristik: je mehr getrennte Zuckerformen, desto weiter vorne
    // stünde die Summe. Nicht exakt (keine Prozente auf Etiketten), aber
    // ehrlich als Schätzung gekennzeichnet.
    wahrePosition = Math.max(1, fruehestePos - (anzahlVersteckt - 1));
  }

  return {
    gefunden: zuckerFunde.length > 0,
    getarnt,
    anzahlZuckerarten: anzahlVersteckt,
    zuckerarten: problematischerZucker.map(f => ({ name: f.name, position: f.position, kategorie: f.kategorie })),
    natuerlicherZucker: natuerlicherZucker.map(f => ({ name: f.name, position: f.position })),
    suessstoffe: suessstoffe.map(f => f.name),
    zuckeralkohole: zuckeralkohole.map(f => f.name),
    erstePosition: fruehestePos,
    geschaetzteWahrePosition: wahrePosition,
    gesamtEintraege: liste.length,
  };
}

// Erzeugt den Klartext-Hinweis für die UI (Biohacker-Ton, belegbar).
export function zuckerHinweisText(zutaten) {
  const a = deckeZuckerAuf(zutaten);
  if (!a.gefunden) return null;

  if (a.getarnt) {
    const namen = a.zuckerarten.map(z => z.name).join(', ');
    let text = `⚠️ Versteckter Industriezucker: ${a.anzahlZuckerarten} verschiedene Formen (${namen}). `;
    text += `Getrennt gelistet, damit keiner weit oben steht – zusammengerechnet stünde Zucker etwa an Position ${a.geschaetzteWahrePosition} statt ${a.erstePosition}. Ein typischer Industrie-Trick.`;
    return { text, getarnt: true, anzahl: a.anzahlZuckerarten, warnung: 'Zucker-Tarnung', analyse: a };
  }

  if (a.suessstoffe.length > 0) {
    return { text: `⚠️ Enthält synthetische Süßstoffe: ${a.suessstoffe.join(', ')}. Aus Low-Tox-Sicht kritisch – meiden.`, getarnt: false, warnung: 'Süßstoffe', analyse: a };
  }

  // Ein einzelner Industriezucker – ehrlich benennen.
  if (a.zuckerarten.length === 1) {
    return { text: `Enthält Industriezucker (${a.zuckerarten[0].name}) an Position ${a.erstePosition}.`, getarnt: false, analyse: a };
  }

  // Nur natürliche Süße (Honig, Dattelsüße etc.) – nach clevia-Linie unbedenklich.
  if (a.natuerlicherZucker.length > 0) {
    const namen = a.natuerlicherZucker.map(z => z.name).join(', ');
    return { text: `Natürlich gesüßt (${namen}) – nach der Low-Tox-Linie unbedenklich.`, getarnt: false, natuerlich: true, analyse: a };
  }

  return { text: null, getarnt: false, analyse: a };
}

export const _intern = { erkenneZucker, normZutat,
  ZUCKER_ANZAHL: Object.keys(ZUCKER_NAMEN).length,
  ALKOHOL_ANZAHL: Object.keys(ZUCKERALKOHOLE).length,
  SUESSSTOFF_ANZAHL: Object.keys(SUESSSTOFFE).length };
