// ═══════════════════════════════════════════════════════════
// clevia Barcode-Resolver (DACH-Vollabdeckung)
// ───────────────────────────────────────────────────────────
// Ein einzelner Barcode kann in verschiedenen Datenbanken stehen,
// je nach Produkttyp. Statt EINER Quelle (die immer Lücken hat)
// fragt dieser Resolver ALLE relevanten DACH-Datenbanken parallel
// ab und nimmt das erste vollständige Ergebnis:
//
//   • Open Food Facts     – Lebensmittel (weltweit, top DE-Abdeckung)
//   • Open Beauty Facts    – Kosmetik/Pflege
//   • Open Products Facts  – Haushalt, Reiniger, Sonstiges
//   • Open Pet Food Facts  – Tiernahrung
//   • OpenGTINDB           – deutsche EAN-DB (DACH-Ergänzung)
//
// So findet der Scanner praktisch alles, was es im DACH-Raum gibt.
// Die Facts-DBs teilen dieselbe API-Struktur (v2/product/{ean}.json),
// nur andere Hosts — das macht die parallele Abfrage sauber.
// ═══════════════════════════════════════════════════════════

// Die Open-Facts-Quellen (gleiche API, verschiedene Hosts + Produkttyp).
const FACTS_QUELLEN = [
  { name: 'openfoodfacts',    host: 'world.openfoodfacts.org',    typ: 'lebensmittel' },
  { name: 'openbeautyfacts',  host: 'world.openbeautyfacts.org',  typ: 'kosmetik' },
  { name: 'openproductsfacts',host: 'world.openproductsfacts.org',typ: 'reiniger' },
  { name: 'openpetfoodfacts', host: 'world.openpetfoodfacts.org', typ: 'tiernahrung' },
];

// Einen Barcode gegen eine Open-Facts-Quelle abfragen.
// Gibt normalisiertes Produkt oder null. Die "fields"-Filterung hält
// die Antwort klein (1 Scan = 1 sinnvoller API-Call, wie von OFF gewünscht).
async function frageFacts(quelle, ean, fetchFn) {
  const felder = 'product_name,product_name_de,brands,ingredients_text,ingredients_text_de,labels_tags,categories_tags,quantity';
  const url = `https://${quelle.host}/api/v2/product/${encodeURIComponent(ean)}.json?fields=${felder}`;
  try {
    const r = await fetchFn(url, { headers: { 'User-Agent': 'clevia/1.0 (clevia.sooth-light.com)' } });
    if (!r.ok) return null;
    const j = await r.json();
    // status 1 = gefunden, 0 = nicht gefunden
    if (j.status !== 1 || !j.product) return null;
    const p = j.product;
    // Name/Zutaten bevorzugt in Deutsch, sonst Standard.
    const name = (p.product_name_de || p.product_name || '').trim();
    const zutatenText = (p.ingredients_text_de || p.ingredients_text || '').trim();
    // Ohne Name UND ohne Zutaten ist der Treffer wertlos → als Miss werten.
    if (!name && !zutatenText) return null;
    return {
      gefunden: true,
      quelle: quelle.name,
      typ: quelle.typ,
      produkt: name,
      marke: (p.brands || '').split(',')[0].trim(),
      zutatenText,
      bio: erkenneBio(p.labels_tags),
      menge: (p.quantity || '').trim(),
    };
  } catch {
    return null;
  }
}

// OpenGTINDB (deutsche EAN-DB) – andere API-Struktur.
// Liefert oft nur Name/Marke (keine Zutaten), aber füllt DACH-Lücken,
// wo die Facts-DBs ein Produkt nicht kennen.
async function frageGtinDb(ean, fetchFn) {
  const url = `https://opengtindb.org/?ean=${encodeURIComponent(ean)}&cmd=query&queryid=400000000`;
  try {
    const r = await fetchFn(url, { headers: { 'User-Agent': 'clevia/1.0' } });
    if (!r.ok) return null;
    const text = await r.text();
    // Antwort ist key=value-Text. "error=0" = gefunden.
    if (!/error=0/.test(text)) return null;
    const name = (text.match(/name=(.+)/)?.[1] || '').trim();
    const marke = (text.match(/vendor=(.+)/)?.[1] || '').trim();
    const detail = (text.match(/detailname=(.+)/)?.[1] || '').trim();
    const voll = [name, detail].filter(Boolean).join(' ').trim();
    if (!voll && !marke) return null;
    return {
      gefunden: true,
      quelle: 'opengtindb',
      typ: 'unbekannt',
      produkt: voll,
      marke,
      zutatenText: '',   // GTINDB hat i.d.R. keine Zutaten
      bio: false,
      menge: '',
    };
  } catch {
    return null;
  }
}

// Bio-Erkennung aus labels_tags.
function erkenneBio(labels) {
  if (!Array.isArray(labels)) return false;
  return labels.some(l => /organic|bio|eco|cosmos|natrue|ecocert|demeter|naturland/i.test(l));
}

// Zutaten-Text ("Aqua, Glycerin, ...") in ein Array aufsplitten.
export function zutatenTextZuListe(text) {
  if (!text) return [];
  return text
    .replace(/[.]$/, '')
    .split(/,|\u2022|;/)               // Komma, Bullet, Semikolon
    .map(s => s.replace(/\([^)]*\)/g, '').trim())  // Klammer-Zusätze weg
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 1);
}

// ═══ HAUPT: Barcode über ALLE Quellen auflösen ═══════════════
// Fragt alle Facts-DBs parallel ab (schnell), nimmt den besten Treffer.
// "Bester" = hat Zutaten > hat nur Namen. Wenn Facts nichts finden,
// wird GTINDB als DACH-Fallback nachgeschoben.
//
// fetchFn wird injiziert (im Server global.fetch, testbar mit Mock).
export async function loeseBarcode(ean, fetchFn) {
  const code = String(ean || '').replace(/\D/g, '');   // nur Ziffern
  if (code.length < 8) return { gefunden: false, grund: 'ungueltiger_code' };

  // Alle Facts-Quellen PARALLEL abfragen.
  const treffer = await Promise.all(
    FACTS_QUELLEN.map(q => frageFacts(q, code, fetchFn))
  );
  const gefundene = treffer.filter(Boolean);

  if (gefundene.length > 0) {
    // Besten wählen: mit Zutaten vor ohne Zutaten.
    gefundene.sort((a, b) => (b.zutatenText.length > 0 ? 1 : 0) - (a.zutatenText.length > 0 ? 1 : 0));
    const beste = gefundene[0];
    return {
      gefunden: true,
      quelle: beste.quelle,
      typ: beste.typ,
      produkt: beste.produkt,
      marke: beste.marke,
      zutaten: zutatenTextZuListe(beste.zutatenText),
      zutatenText: beste.zutatenText,
      bio: beste.bio,
      menge: beste.menge,
      // Falls mehrere Quellen trafen: zur Transparenz mitgeben.
      weitereQuellen: gefundene.slice(1).map(g => g.quelle),
    };
  }

  // Facts kannten das Produkt nicht → deutsche EAN-DB als DACH-Fallback.
  const gtin = await frageGtinDb(code, fetchFn);
  if (gtin) {
    return {
      gefunden: true,
      quelle: gtin.quelle,
      typ: gtin.typ,
      produkt: gtin.produkt,
      marke: gtin.marke,
      zutaten: [],
      zutatenText: '',
      bio: gtin.bio,
      menge: '',
      hinweis: 'Produkt erkannt, aber keine Zutatenliste hinterlegt – bitte Etikett scannen.',
    };
  }

  return { gefunden: false, grund: 'nicht_gefunden' };
}

export const _intern = { FACTS_QUELLEN, frageFacts, frageGtinDb, erkenneBio, zutatenTextZuListe };
