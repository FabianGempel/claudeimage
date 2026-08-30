// ═══════════════════════════════════════════════════════════
// Barcode-Produktsuche mit DACH-Fokus.
// Router-Modul — wird unter /api (und /api/v1) eingehängt.
//
// Warum server-seitig? Die zusätzlichen DACH-Quellen (opengtindb.org)
// erlauben keine direkten Browser-Anfragen (CORS). Über den Server
// geroutet klappt es — und wir erhöhen die Trefferquote für deutsche
// Produkte deutlich gegenüber reinem OpenFoodFacts.
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { loeseBarcode } from '../lib/barcode-resolver.js';

export const barcodeRouter = Router();

// Kleiner Fetch-Helper mit Timeout (damit eine lahme Quelle nicht alles blockiert)
async function holeMitTimeout(url, opts = {}, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    return null;
  }
}

// ── Quelle 1: OpenFoodFacts / OpenBeautyFacts / OpenProductsFacts ──
// (deutsche + weltweite Instanz, Lebensmittel + Kosmetik + sonstige)
async function ausOpenFacts(code) {
  const felder = 'product_name,product_name_de,brands,ingredients_text,ingredients_text_de,categories';
  const quellen = [
    `https://de.openfoodfacts.org/api/v2/product/${code}.json?fields=${felder}`,
    `https://de.openbeautyfacts.org/api/v2/product/${code}.json?fields=${felder}`,
    `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${felder}`,
    `https://world.openbeautyfacts.org/api/v2/product/${code}.json?fields=${felder}`,
    `https://world.openproductsfacts.org/api/v2/product/${code}.json?fields=${felder}`,
  ];
  for (const url of quellen) {
    const res = await holeMitTimeout(url);
    if (!res || !res.ok) continue;
    let d;
    try { d = await res.json(); } catch (e) { continue; }
    if (d.status === 1 && d.product) {
      const p = d.product;
      const zutaten = p.ingredients_text_de || p.ingredients_text || '';
      const name = p.product_name_de || p.product_name || '';
      // Nur zurückgeben, wenn wenigstens Name ODER Zutaten da sind
      if (name || zutaten) {
        return {
          ok: true,
          quelle: url.includes('beauty') ? 'openbeautyfacts' : url.includes('products') ? 'openproductsfacts' : 'openfoodfacts',
          name,
          marke: p.brands || '',
          zutaten,
          kategorie: p.categories || '',
        };
      }
    }
  }
  return null;
}

// ── Quelle 2: Open EAN/GTIN Database (opengtindb.org) — DACH-Fokus ──
// Liefert Produktname/Hersteller/Kategorie und oft auch Zutaten (im descr-Feld).
// Findet viele deutsche Produkte, die OpenFoodFacts nicht kennt.
async function ausOpenGtin(code) {
  // WICHTIG: opengtindb läuft primär über HTTP (kein SSL). Wir versuchen http
  // zuerst, dann https als Fallback. queryid 400000000 ist die offizielle Test-ID.
  const urls = [
    `http://opengtindb.org/?ean=${code}&cmd=query&queryid=400000000`,
    `https://opengtindb.org/?ean=${code}&cmd=query&queryid=400000000`,
  ];
  let txt = null;
  for (const url of urls) {
    const res = await holeMitTimeout(url);
    if (res && res.ok) {
      try { txt = await res.text(); break; } catch (e) { /* nächste URL */ }
    }
  }
  if (!txt) return null;
  // Antwortformat: Zeilen wie "error=0", "name=...", "vendor=...", "detailname=...", "descr=..."
  if (!/error=0/.test(txt)) return null;
  const feld = (k) => {
    const m = txt.match(new RegExp('^' + k + '=(.+)$', 'm'));
    return m ? m[1].trim() : '';
  };
  const name = feld('detailname') || feld('name');
  const marke = feld('vendor');
  if (!name && !marke) return null;
  // Zutaten stecken oft im descr-Feld nach "Zutaten:" (opengtindb hat kein eigenes Feld dafür)
  let zutaten = '';
  const descr = feld('descr');
  if (descr) {
    // "\n" im Text sind literale Zeichen → in echte Umbrüche wandeln
    const descrClean = descr.replace(/\\n/g, '\n');
    const zutMatch = descrClean.match(/Zutaten\s*:?\s*([\s\S]+?)(?:\n\n|$)/i);
    if (zutMatch) zutaten = zutMatch[1].trim();
  }
  return {
    ok: true,
    quelle: 'opengtindb',
    name,
    marke,
    zutaten,
    kategorie: [feld('maincat'), feld('subcat')].filter(Boolean).join(' / '),
  };
}

// ── Haupt-Endpunkt: /api/produkt?code=EAN ──
// Nutzt den parallelen Multi-Quellen-Resolver: fragt Food/Beauty/Products/
// Pet-Facts GLEICHZEITIG ab (schnell) und fällt auf die deutsche EAN-DB
// (opengtindb) zurück. Maximale DACH-Abdeckung.
barcodeRouter.get('/produkt', async (req, res) => {
  const code = String(req.query.code || '').replace(/\D/g, '');
  if (!code || code.length < 8) {
    return res.status(400).json({ ok: false, grund: 'ungueltiger_code' });
  }

  // Parallele Facts-Abfrage über den Resolver (mit Timeout-fetch).
  const fetchMitTimeout = (url, opts) => holeMitTimeout(url, opts, 6000);
  let ergebnis = await loeseBarcode(code, fetchMitTimeout);

  // Wenn der Resolver-Weg (Facts + GTINDB-Fallback) nichts fand ODER keine
  // Zutaten hat, die alte ausOpenGtin-Variante mit descr-Zutaten-Extraktion
  // als zusätzliche Chance (sie liest Zutaten aus dem descr-Feld).
  if (!ergebnis.gefunden || (ergebnis.zutaten || []).length === 0) {
    const gtin = await ausOpenGtin(code);
    if (gtin && gtin.zutaten) {
      const zutListe = gtin.zutaten.split(/,|;|\u2022/).map(s => s.trim()).filter(s => s.length > 1);
      if (!ergebnis.gefunden) {
        ergebnis = { gefunden: true, quelle: gtin.quelle, typ: 'unbekannt', produkt: gtin.name, marke: gtin.marke, zutaten: zutListe, zutatenText: gtin.zutaten, bio: false, menge: '' };
      } else if ((ergebnis.zutaten || []).length === 0 && zutListe.length > 0) {
        ergebnis.zutaten = zutListe;
        ergebnis.zutatenText = gtin.zutaten;
        ergebnis.quelle = ergebnis.quelle + '+opengtindb';
        if (ergebnis.hinweis) delete ergebnis.hinweis;
      }
    }
  }

  if (!ergebnis.gefunden) {
    return res.json({ ok: false, grund: 'nicht_gefunden', code });
  }
  // Einheitliches Format (ok:true + code).
  return res.json({
    ok: true,
    code,
    quelle: ergebnis.quelle,
    typ: ergebnis.typ,
    name: ergebnis.produkt,
    produkt: ergebnis.produkt,
    marke: ergebnis.marke,
    zutaten: ergebnis.zutaten || [],
    zutatenText: ergebnis.zutatenText || '',
    bio: ergebnis.bio,
    menge: ergebnis.menge,
    ...(ergebnis.hinweis ? { hinweis: ergebnis.hinweis } : {}),
  });
});
