// ═══════════════════════════════════════════════════════════
// Sicherheitsdatenblatt-Abruf für Haushaltsprodukte.
// Router-Modul — eingehängt unter /api (und /api/v1).
//
// WARUM: Bei Reinigern/Haushaltschemie verlangt die EU-Detergenzien-
// Verordnung nur bestimmte Stoffgruppen aufs Etikett. Die vollständige
// Zusammensetzung steht nur im Sicherheitsdatenblatt (SDB), das der
// Hersteller gesetzlich öffentlich bereitstellen muss (meist als PDF).
// Dieser Endpunkt sucht das SDB, lädt das PDF und extrahiert die
// Inhaltsstoffe aus "ABSCHNITT 3: Zusammensetzung".
//
// Ehrliche Grenze: SDBs sind PDFs ohne einheitliche API. Auffinden und
// Parsen klappen oft, aber nicht garantiert bei jedem Produkt/Hersteller.
// Der Endpunkt liefert, was er findet — besser als gar keine Zutaten.
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';

export const sdbRouter = Router();

async function holeMitTimeout(url, opts = {}, ms = 9000) {
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

// ── SDB-PDF über mehrere Such-Strategien finden ──
// Robuster Ansatz: mehrere Suchbegriffe + mehrere Suchmaschinen nacheinander.
// SDBs sind gesetzlich öffentlich (REACH), daher fast immer als PDF auffindbar.
async function findeSdbUrl(produkt) {
  // Bewertet einen Treffer: echtes SDB-PDF > PDF > sonst nichts
  const istGut = (u) => /\.pdf($|\?)/i.test(u);
  const istSdb = (u) => /sicherheitsdatenblatt|sdb|msds|safety.?data|datenblatt/i.test(u);

  // STRATEGIE 1: Gezielt in dedizierten SDB-Datenbanken suchen.
  // Diese Portale sammeln Sicherheitsdatenblätter vieler Hersteller — eine
  // site-spezifische Suche liefert viel treffsicherer als eine breite Websuche.
  const sdbDatenbanken = [
    'sicherheitsdatenblatt-suche.de',
    'sdsmanager.com',
    'chemicalsafety.com',
    'sdb.ch',
    'esdb.eu',
  ];
  for (const db of sdbDatenbanken) {
    const q = encodeURIComponent(`site:${db} ${produkt}`);
    let treffer = await sucheDuckDuckGo(q);
    if (!treffer.length) treffer = await sucheBing(q);
    const pdfs = treffer.filter(istGut);
    if (pdfs.length) return pdfs.find(istSdb) || pdfs[0];
    // Manche DBs liefern eine Detailseite (kein direktes PDF) — die nehmen wir auch,
    // ladePdfText verfolgt dann den PDF-Link auf der Seite.
    const dbTreffer = treffer.find(u => u.includes(db));
    if (dbTreffer && /\/(sdb|sds|datenblatt|download|produkt|product)/i.test(dbTreffer)) return dbTreffer;
  }

  // STRATEGIE 2: Allgemeine Websuche mit verschiedenen Suchbegriff-Varianten
  const suchbegriffe = [
    `${produkt} Sicherheitsdatenblatt filetype:pdf`,
    `${produkt} Sicherheitsdatenblatt SDB pdf`,
    `${produkt} safety data sheet filetype:pdf`,
    `${produkt} SDB Datenblatt`,
  ];
  for (const begriff of suchbegriffe) {
    const q = encodeURIComponent(begriff);
    let treffer = await sucheDuckDuckGo(q);
    if (!treffer.length) treffer = await sucheBing(q);
    const pdfs = treffer.filter(istGut);
    if (pdfs.length) return pdfs.find(istSdb) || pdfs[0];
  }
  return null;
}

async function sucheDuckDuckGo(q) {
  const res = await holeMitTimeout(`https://html.duckduckgo.com/html/?q=${q}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; clevia/1.0)' },
  });
  if (!res || !res.ok) return [];
  let html; try { html = await res.text(); } catch (e) { return []; }
  return [...html.matchAll(/uddg=([^&"]+)/g)]
    .map(m => { try { return decodeURIComponent(m[1]); } catch (e) { return ''; } })
    .filter(Boolean);
}

async function sucheBing(q) {
  const res = await holeMitTimeout(`https://www.bing.com/search?q=${q}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!res || !res.ok) return [];
  let html; try { html = await res.text(); } catch (e) { return []; }
  // Bing verlinkt Ziele direkt in href="..."
  return [...html.matchAll(/href="(https?:\/\/[^"]+\.pdf[^"]*)"/gi)].map(m => m[1]);
}

// ── PDF-Text extrahieren (leichtgewichtig, ohne schwere Abhängigkeit) ──
// SDB-PDFs sind fast immer Text-PDFs (kein Scan). Wir ziehen die Text-
// Streams heraus. Für die meisten SDBs reicht das, um Abschnitt 3 zu lesen.
async function ladePdfText(url) {
  const res = await holeMitTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; clevia/1.0)' },
  }, 12000);
  if (!res || !res.ok) return null;

  // Content-Type prüfen: Ist es ein PDF oder eine HTML-Detailseite?
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const istPdf = ct.includes('pdf') || /\.pdf($|\?)/i.test(url);

  if (!istPdf) {
    // HTML-Detailseite: den Link zum eigentlichen SDB-PDF darauf finden und verfolgen
    let html;
    try { html = await res.text(); } catch (e) { return null; }
    const pdfLinks = [...html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)].map(m => m[1]);
    const sdbLink = pdfLinks.find(l => /sicherheitsdatenblatt|sdb|msds|safety|datenblatt/i.test(l)) || pdfLinks[0];
    if (!sdbLink) return null;
    // Relative URL zu absoluter machen
    let absLink = sdbLink;
    try { absLink = new URL(sdbLink, url).href; } catch (e) {}
    const pdfRes = await holeMitTimeout(absLink, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; clevia/1.0)' },
    }, 12000);
    if (!pdfRes || !pdfRes.ok) return null;
    try {
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buf);
      return data.text || '';
    } catch (e) { return null; }
  }

  let buf;
  try { buf = Buffer.from(await res.arrayBuffer()); } catch (e) { return null; }
  // pdf-parse dynamisch laden (nur wenn gebraucht)
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buf);
    return data.text || '';
  } catch (e) {
    // Fallback: rohe Text-Extraktion aus dem PDF-Byte-Stream
    const roh = buf.toString('latin1');
    const stuecke = [...roh.matchAll(/\(((?:[^()\\]|\\.)*)\)/g)].map(m => m[1]);
    return stuecke.join(' ').replace(/\\[rn]/g, ' ');
  }
}

// ── Abschnitt 3 (Zusammensetzung / Inhaltsstoffe) aus dem SDB-Text ziehen ──
function extrahiereInhaltsstoffe(text) {
  if (!text) return [];
  const norm = text.replace(/\r/g, '\n');
  // Abschnitt 3 grenzt sich ab: "ABSCHNITT 3" ... bis "ABSCHNITT 4"
  const start = norm.search(/ABSCHNITT\s*3[:.\s]|3[.\s]+Zusammensetzung|Angaben zu (den )?Bestandteilen/i);
  const ende = norm.search(/ABSCHNITT\s*4[:.\s]|4[.\s]+Erste[- ]Hilfe/i);
  const abschnitt = start >= 0 ? norm.slice(start, ende > start ? ende : start + 3000) : norm.slice(0, 6000);

  const roh = [];
  // Methode A: CAS-Nummern als Anker. Der Stoffname steht im selben Segment
  // (vor der CAS) ODER — wenn die CAS in eigener Zeile steht — im Segment davor.
  const segmente = abschnitt.split(/[\n;]/);
  for (let i = 0; i < segmente.length; i++) {
    const seg = segmente[i].trim();
    const hatCas = /\d{2,7}-\d{2}-\d/.test(seg);
    const istCasZeile = /^(REACH|EG|EC|CAS)[-\s]?Nr/i.test(seg) || /^\d{2,7}-\d{2}-\d/.test(seg);
    const kandidaten = [];
    if (hatCas && !istCasZeile) kandidaten.push(seg.replace(/\d{2,7}-\d{2}-\d.*$/, ''));
    if (istCasZeile && i > 0) kandidaten.push(segmente[i - 1]);
    for (let name of kandidaten) {
      name = name.trim()
        .replace(/(REACH|EG|CAS|EC)[-\s]?Nr\.?.*$/i, '')
        .replace(/[;,:]\s*$/, '')
        .replace(/^[\s'"`,.)\]}-]+/, '')  // führende Sonderzeichen/Interpunktion
        .replace(/^\d+[.,]\s*/, '')       // führende Aufzählungsnummer "1. "
        .replace(/\s{2,}/g, ' ')
        .trim();
      // Wenn der Name mit einer isolierten Zahl+Bindestrich anfängt, die zum
      // Stoff gehört (z.B. "2-Propanol"), NICHT abschneiden — nur echte Reste.
      if (/^-[A-Za-zÄÖÜ]/.test(name)) name = name.slice(1); // führenden Bindestrich weg
      if (name.length >= 3 && name.length <= 55 && /[a-zäöüA-ZÄÖÜ]/.test(name) && !/^H\d{3}/.test(name)) {
        roh.push(name);
      }
    }
  }

  // Methode B: bekannte Reiniger-Inhaltsstoffe direkt im Text (Ergänzung)
  const bekannte = [
    'Citronensäure', 'Zitronensäure', 'Ameisensäure', 'Essigsäure', 'Milchsäure',
    'Natriumhydroxid', 'Kaliumhydroxid', 'Natriumhypochlorit', 'Wasserstoffperoxid',
    'Natriumcarbonat', 'Natriumpercarbonat', 'Natriumhydrogencarbonat',
    'Ethanol', 'Isopropanol', '2-Propanol', 'Alkohol',
    'Natriumlaurylsulfat', 'Natriumlaurethsulfat', 'Cocamidopropylbetain',
    'nichtionische Tenside', 'anionische Tenside', 'amphotere Tenside',
    'Parfum', 'Duftstoffe', 'Limonene', 'Linalool', 'Citronellol',
    'Methylisothiazolinon', 'Benzisothiazolinon', 'Phenoxyethanol',
    'EDTA', 'Phosphonate', 'Phosphate', 'Natriumchlorid', 'Harnstoff',
    'Butoxyethanol', 'Butylglycol', 'Natriumcitrat',
  ];
  bekannte.forEach(stoff => {
    const re = new RegExp('\\b' + stoff.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(abschnitt)) roh.push(stoff);
  });

  // Duplikate case-insensitiv entfernen; wenn ein Name in Title-Case und in
  // GROSSBUCHSTABEN vorkommt, den lesbareren (Title-Case) behalten.
  const gesehen = new Map();
  for (const name of roh) {
    const key = name.toLowerCase().replace(/[\s\-]/g, '');
    const bestehend = gesehen.get(key);
    if (!bestehend) {
      gesehen.set(key, name);
    } else {
      // Bevorzuge den Namen mit Klein- und Großbuchstaben gemischt (lesbarer)
      const bestehendGemischt = /[a-zäöü]/.test(bestehend) && /[A-ZÄÖÜ]/.test(bestehend);
      const neuGemischt = /[a-zäöü]/.test(name) && /[A-ZÄÖÜ]/.test(name);
      if (neuGemischt && !bestehendGemischt) gesehen.set(key, name);
    }
  }
  return [...gesehen.values()].slice(0, 25);
}

// ── Haupt-Endpunkt: /api/sdb?produkt=NAME ──
sdbRouter.get('/sdb', async (req, res) => {
  const produkt = String(req.query.produkt || '').trim();
  if (produkt.length < 3) {
    return res.status(400).json({ ok: false, grund: 'produktname_fehlt' });
  }

  // 1. SDB-PDF suchen
  const sdbUrl = await findeSdbUrl(produkt);
  if (!sdbUrl) {
    return res.json({ ok: false, grund: 'kein_sdb_gefunden', produkt });
  }

  // 2. PDF laden + Text extrahieren
  const text = await ladePdfText(sdbUrl);
  if (!text) {
    return res.json({ ok: false, grund: 'pdf_nicht_lesbar', produkt, sdbUrl });
  }

  // 3. Inhaltsstoffe aus Abschnitt 3 ziehen
  const stoffe = extrahiereInhaltsstoffe(text);
  if (!stoffe.length) {
    return res.json({ ok: false, grund: 'keine_stoffe_erkannt', produkt, sdbUrl });
  }

  return res.json({ ok: true, produkt, quelle: 'sicherheitsdatenblatt', sdbUrl, stoffe });
});
