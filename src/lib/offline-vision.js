// ═══════════════════════════════════════════════════════════
// clevia Offline-Vision — Etikett lesen, ohne dass ein Byte das Handy verlässt
// ───────────────────────────────────────────────────────────
// Der Vision-Scanner braucht bisher Cloudflare (Foto → Server → Zutaten).
// Dieses Modul macht es KOMPLETT OFFLINE im Browser via Tesseract.js (WASM).
// Kein Upload, volle Privatsphäre, funktioniert ohne Netz.
//
// Der Scanner ist nur die halbe Miete. Rohes OCR liefert Rauschen
// ("lngredients:", "E­mulsi­fier", Zeilenumbrüche mitten im Wort). Der
// eigentliche Wert liegt in der Aufbereitung: aus OCR-Müll eine saubere,
// bewertbare Zutatenliste machen. GENAU DAS macht dieses Modul.
//
// Zwei Teile:
//   1. bildVorverarbeitung  – Canvas: Graustufen, Kontrast, Schwellwert
//      (OCR wird auf hartem Schwarz-Weiß deutlich genauer)
//   2. ocrTextZuZutaten      – OCR-Rohtext → bereinigte Zutaten-Liste
//
// Die Tesseract.js-Anbindung selbst (ladeOCR/leseEtikett) ist dünn –
// die Intelligenz steckt in der Aufbereitung, die hier voll testbar ist.
// ═══════════════════════════════════════════════════════════

// ── Bildvorverarbeitung (Canvas) ──
// Wandelt ein Bild in hartes Schwarz-Weiß um. OCR-Engines lesen sauberen
// Kontrast viel besser als ein flaues Foto. Adaptiver Schwellwert, damit
// ungleichmäßige Beleuchtung (Schatten auf der Verpackung) nicht stört.
export function bildVorverarbeitung(canvas, ctx) {
  const w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // 1. Graustufen + Helligkeit sammeln
  const grau = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    // Luminanz-gewichtet (Auge sieht Grün am hellsten)
    grau[p] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
  }

  // 2. Adaptiver Schwellwert je Kachel (gegen ungleichmäßiges Licht)
  // Bild in Kacheln teilen, in jeder den lokalen Mittelwert als Schwelle nehmen.
  const kachel = Math.max(16, Math.floor(Math.min(w, h) / 12));
  for (let ky = 0; ky < h; ky += kachel) {
    for (let kx = 0; kx < w; kx += kachel) {
      const x2 = Math.min(kx + kachel, w), y2 = Math.min(ky + kachel, h);
      // lokalen Mittelwert berechnen
      let summe = 0, n = 0;
      for (let y = ky; y < y2; y++) for (let x = kx; x < x2; x++) { summe += grau[y * w + x]; n++; }
      const mittel = summe / n;
      // leicht unter den Mittelwert (bias) → Text bleibt kräftig
      const schwelle = mittel - 8;
      for (let y = ky; y < y2; y++) {
        for (let x = kx; x < x2; x++) {
          const p = y * w + x;
          const v = grau[p] < schwelle ? 0 : 255;
          const i = p * 4;
          d[i] = d[i + 1] = d[i + 2] = v;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ── OCR-Rohtext → saubere Zutatenliste ──
// Das Herzstück. Nimmt den (fehlerbehafteten) OCR-Text und macht daraus
// eine bewertbare Liste. Behandelt: "Zutaten:"-Präfix wegschneiden,
// Zeilenumbrüche in Wörtern reparieren, OCR-Verwechslungen korrigieren,
// an Komma/Semikolon splitten, Mengenangaben & Klammern behandeln.
export function ocrTextZuZutaten(rohtext) {
  if (!rohtext || typeof rohtext !== 'string') return { zutaten: [], roh: '', erkannt: false };

  let text = rohtext;

  // 1. Häufige OCR-Zeichenfehler korrigieren (nur im sicheren Kontext)
  //    Diese Ersetzungen sind bei Zutatenlisten fast immer richtig.
  const ocrKorrektur = [
    [/\blngredients\b/gi, 'Ingredients'],   // I→l am Wortanfang
    [/\blnhaltsstoffe\b/gi, 'Inhaltsstoffe'],
    [/\bZ­utaten\b/gi, 'Zutaten'],
    [/(\w)­(\w)/g, '$1$2'],                  // weiches Trennzeichen (soft hyphen) raus
    [/\|/g, 'l'],                            // senkrechter Strich → l (häufig verwechselt)
    [/\bAg\b/g, 'Aqua'],                     // gängige Kurz-Fehllesung
  ];
  ocrKorrektur.forEach(([re, rep]) => { text = text.replace(re, rep); });

  // 2. Alles vor dem "Zutaten:/Ingredients:"-Marker abschneiden (Markenname etc. weg)
  const markerRe = /(zutaten|ingredients|inhaltsstoffe|composition|ingr[ée]dients)\s*[:.]?\s*/i;
  const m = text.match(markerRe);
  if (m) {
    text = text.slice(m.index + m[0].length);
  }

  // 3. Zeilenumbrüche zu Leerzeichen (OCR bricht mitten in der Liste um).
  //    Aber: Bindestrich am Zeilenende = getrenntes Wort → zusammenfügen.
  text = text.replace(/-\s*\n\s*/g, '').replace(/\s*\n\s*/g, ' ');

  // 4. Alles nach einem klaren Listen-Ende abschneiden (Nährwerte, "kann Spuren")
  //    Kein \b (bricht bei Umlauten wie "Nährwert"), stattdessen Kontext-Grenzen.
  const endeRe = /(n[äa]hrwert|kann spuren|durchschnittliche n|allergen|mindestens haltbar|aufbewahr|hersteller:|nutrition|best before|energie\s*\d)/i;
  const e = text.match(endeRe);
  if (e) text = text.slice(0, e.index);

  // 5. An Trennzeichen splitten (Komma, Semikolon, teils Punkt zwischen Wörtern)
  let teile = text.split(/[,;•·]/);

  // 6. Jede Zutat säubern
  const zutaten = teile.map(z => {
    let s = z.trim();
    // Prozentangaben und Mengen entfernen: "Zucker 30%", "(15 %)"
    s = s.replace(/\(?\s*\d+[.,]?\d*\s*%\s*\)?/g, '');
    // Führende/abschließende Klammern & Sonderzeichen trimmen
    s = s.replace(/^[^\wäöüÄÖÜ(]+/, '').replace(/[^\wäöüÄÖÜ)%]+$/, '');
    // Mehrfach-Leerzeichen
    s = s.replace(/\s+/g, ' ').trim();
    // E-Nummern-Schreibweise vereinheitlichen: "E 471" → "E471"
    s = s.replace(/\bE\s+(\d)/g, 'E$1');
    return s;
  })
  // 7. Filtern: leere, zu kurze, reine Zahlen-Fragmente raus
  .filter(s => {
    if (s.length < 2) return false;
    if (/^\d+$/.test(s)) return false;           // reine Zahl
    if (/^[^a-zäöü]+$/i.test(s)) return false;    // keine Buchstaben
    // OCR-Müll: ein einzelner Buchstabe + Zeichen
    if (s.replace(/[^a-zäöü]/gi, '').length < 2) return false;
    return true;
  });

  // 8. Duplikate entfernen (OCR liest manchmal doppelt), Reihenfolge wahren
  const gesehen = new Set();
  const eindeutig = [];
  for (const z of zutaten) {
    const key = z.toLowerCase();
    if (!gesehen.has(key)) { gesehen.add(key); eindeutig.push(z); }
  }

  return {
    zutaten: eindeutig,
    roh: rohtext,
    erkannt: eindeutig.length > 0,
    hatMarker: !!m,           // wurde "Zutaten:" gefunden? (Qualitätssignal)
    anzahl: eindeutig.length,
  };
}

// Bewertet die OCR-Qualität grob (für die UI: "gut lesbar" vs "bitte schärfer").
export function ocrQualitaet(ergebnis) {
  if (!ergebnis || !ergebnis.erkannt) return { stufe: 'schlecht', text: 'Kein Text erkannt – näher/schärfer fotografieren.' };
  // Anteil "plausibler" Zutaten (enthalten Vokale, vernünftige Länge)
  const plausibel = ergebnis.zutaten.filter(z => /[aeiouäöü]/i.test(z) && z.length >= 3).length;
  const anteil = ergebnis.zutaten.length ? plausibel / ergebnis.zutaten.length : 0;
  if (ergebnis.hatMarker && anteil > 0.7 && ergebnis.anzahl >= 3) {
    return { stufe: 'gut', text: `${ergebnis.anzahl} Zutaten klar erkannt.` };
  }
  if (anteil > 0.5) {
    return { stufe: 'mittel', text: `${ergebnis.anzahl} Zutaten erkannt – prüfe das Ergebnis.` };
  }
  return { stufe: 'schlecht', text: 'Text schwer lesbar – bei besserem Licht erneut versuchen.' };
}

export const _intern = {};

// ═══ Tesseract.js-Anbindung (offline OCR im Browser) ═══
// Dünne Schicht: lädt Tesseract.js (WASM, einmalig, IndexedDB-gecacht),
// vorverarbeitet das Bild, liest Text, übergibt an die getestete Bereinigung.
// Läuft komplett offline nach dem ersten Laden. Kein Byte verlässt das Gerät.

let _ocrWorker = null;
let _ocrLädt = false;

// Lädt Tesseract.js dynamisch (nur beim ersten Scan). Deutsch + Englisch
// (Etiketten mischen oft beides). Gibt true bei Erfolg.
export async function ladeOfflineOCR(fortschrittCb) {
  if (_ocrWorker) return true;
  if (_ocrLädt) { // paralleler Aufruf → warten
    while (_ocrLädt) await new Promise(r => setTimeout(r, 100));
    return !!_ocrWorker;
  }
  _ocrLädt = true;
  try {
    // Tesseract.js von CDN laden (danach WASM+Daten in IndexedDB gecacht)
    if (typeof Tesseract === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = resolve; s.onerror = () => reject(new Error('Tesseract.js Laden fehlgeschlagen'));
        document.head.appendChild(s);
      });
    }
    _ocrWorker = await Tesseract.createWorker(['deu', 'eng'], 1, {
      logger: m => { if (m.status === 'recognizing text' && fortschrittCb) fortschrittCb(Math.round(m.progress * 100)); },
    });
    return true;
  } catch (e) {
    _ocrWorker = null;
    return false;
  } finally {
    _ocrLädt = false;
  }
}

// Liest ein Etikett offline. canvasOderBild: Canvas/Image/File.
// Gibt das bereinigte Zutaten-Ergebnis (nutzt ocrTextZuZutaten).
export async function leseEtikettOffline(canvasOderBild, opts = {}) {
  const geladen = await ladeOfflineOCR(opts.fortschritt);
  if (!geladen || !_ocrWorker) return { zutaten: [], erkannt: false, fehler: 'OCR nicht verfügbar' };

  try {
    // Optional: Bildvorverarbeitung (Canvas) für bessere Genauigkeit
    let quelle = canvasOderBild;
    if (opts.vorverarbeiten && canvasOderBild.getContext) {
      const ctx = canvasOderBild.getContext('2d');
      bildVorverarbeitung(canvasOderBild, ctx);
      quelle = canvasOderBild;
    }
    const { data } = await _ocrWorker.recognize(quelle);
    const ergebnis = ocrTextZuZutaten(data.text || '');
    ergebnis.qualitaet = ocrQualitaet(ergebnis);
    ergebnis.rohConfidence = data.confidence;
    return ergebnis;
  } catch (e) {
    return { zutaten: [], erkannt: false, fehler: String(e) };
  }
}

// Gibt frei (Speicher), wenn OCR länger nicht gebraucht wird.
export async function beendeOfflineOCR() {
  if (_ocrWorker) { try { await _ocrWorker.terminate(); } catch (e) {} _ocrWorker = null; }
}
