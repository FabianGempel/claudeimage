// ═══════════════════════════════════════════════════════════
// clevia Zylinder-Dewarping — gewölbte Etiketten geradebiegen
// ───────────────────────────────────────────────────────────
// Das Problem, an dem jedes OCR scheitert: Zutatenliste auf einer
// gewölbten Flasche, schräg fotografiert. Der Text läuft um die Rundung,
// die Zeilen sind gekrümmt, die Ränder gestaucht. OCR erwartet flachen,
// geraden Text — und liest nur Müll.
//
// Dieses Modul macht die zylindrische Verzerrung mathematisch rückgängig,
// BEVOR OCR läuft. Rein geometrisch, kein neuronales Netz, kein Training,
// keine GPU — läuft komplett im Browser.
//
// Pipeline (jede Stufe ist echte Rechen-Substanz):
//   1. Textzeilen finden (Binarisierung → Verbundkomponenten → Zeilen-Gruppierung)
//   2. Zylinder-Parameter schätzen (Optimierung: welche Geometrie macht die
//      gekrümmten Zeilen wieder gerade?)
//   3. Inverse Abbildung + Remapping (entzerrtes Bild erzeugen)
//
// Die Geometrie: Text steht auf einem Zylinder (Radius R), von der Kamera
// schräg gesehen. Ein Punkt (u,v) auf dem abgewickelten Etikett wird über
// den Winkel θ=u/R auf den 3D-Zylinder und dann perspektivisch ins Bild
// projiziert. Dewarping invertiert diese Kette.
// ═══════════════════════════════════════════════════════════

// ── STUFE 3a: Kern-Transformation (Bildpixel → flache Etikett-Koordinate) ──
// Löst den Schnitt des Sehstrahls mit dem Zylinder (quadratische Gleichung),
// nimmt die vordere (sichtbare) Fläche, rechnet zurück auf Winkel & Bogenlänge.
export function bildZuFlach(x, y, p) {
  const nx = (x - p.cx) / (p.f * p.scale);
  const ny = (y - p.cy) / (p.f * p.scale);
  const a = nx * nx + 1;
  const b = -2 * p.camDist;
  const c = p.camDist * p.camDist - p.R * p.R;
  const disk = b * b - 4 * a * c;
  if (disk < 0) return null;                 // Strahl verfehlt den Zylinder
  const zc = (-b + Math.sqrt(disk)) / (2 * a); // vordere Fläche = größeres zc
  const X = nx * zc, Z = zc - p.camDist, Y = ny * zc;
  return { u: (Math.atan2(X, Z) - p.thetaOffset) * p.R, v: Y };
}

// ── STUFE 2: Kostenfunktion + Optimierung ──
// Die entzerrten Textzeilen sollen konstantes v haben (gerade & horizontal).
// Kosten = mittlere v-Varianz aller Zeilen. Minimum = beste Geometrie.
export function dewarpKosten(params, textzeilen) {
  let gesamt = 0, n = 0;
  for (const zeile of textzeilen) {
    const vs = [];
    for (const pt of zeile) {
      const f = bildZuFlach(pt.x, pt.y, params);
      if (!f) return 1e9;
      vs.push(f.v);
    }
    if (vs.length < 2) continue;
    const m = vs.reduce((s, x) => s + x, 0) / vs.length;
    gesamt += vs.reduce((s, x) => s + (x - m) ** 2, 0) / vs.length;
    n++;
  }
  return n > 0 ? gesamt / n : 1e9;
}

// Koordinatenabstieg mit adaptiver Schrittweite über R, thetaOffset, camDist.
function dewarpOptimiere(textzeilen, fix, start) {
  let p = { ...fix, ...start };
  const s = { R: 30, thetaOffset: 0.3, camDist: 100 };
  const ms = { R: 0.1, thetaOffset: 0.001, camDist: 0.5 };
  let k = dewarpKosten(p, textzeilen);
  for (let it = 0; it < 2000; it++) {
    let besser = false;
    for (const key of ['R', 'thetaOffset', 'camDist']) {
      for (const d of [1, -1]) {
        const c = { ...p, [key]: p[key] + d * s[key] };
        if (c.R < 20 || c.R > 500) continue;
        if (c.camDist < c.R * 1.05 || c.camDist > 3000) continue;
        const kk = dewarpKosten(c, textzeilen);
        if (kk < k) { p = c; k = kk; besser = true; }
      }
    }
    if (!besser) {
      let alleKlein = true;
      for (const key in s) { if (s[key] > ms[key]) { s[key] *= 0.5; alleKlein = false; } }
      if (alleKlein) break;
    }
  }
  return { params: p, kosten: k };
}

// Mehrfachstart gegen lokale Minima.
export function schaetzeZylinder(textzeilen, bildBreite, bildHoehe) {
  const fix = { f: bildBreite, cx: bildBreite / 2, cy: bildHoehe / 2, scale: 1 };
  const starts = [
    { R: 80, thetaOffset: -0.5, camDist: 350 },
    { R: 120, thetaOffset: -0.3, camDist: 400 },
    { R: 60, thetaOffset: -0.7, camDist: 300 },
    { R: 150, thetaOffset: -0.2, camDist: 500 },
    { R: 100, thetaOffset: 0.0, camDist: 400 },
  ];
  let best = null;
  for (const st of starts) {
    const r = dewarpOptimiere(textzeilen, fix, st);
    if (!best || r.kosten < best.kosten) best = r;
  }
  return best;
}

// ── STUFE 1: Textzeilen aus einem Graustufen-Bild finden ──
// Binarisieren (adaptiv), horizontale Projektionsprofile je Spalte, dann
// dunkle Bänder (Textzeilen) als Punkt-Ketten extrahieren.
// grau: Uint8-Array (Breite*Höhe), 0=schwarz(Text) .. 255=weiß.
export function findeTextzeilen(grau, w, h) {
  // 1. Adaptive Binarisierung (lokaler Mittelwert je Kachel)
  const bin = new Uint8Array(w * h); // 1 = Text (dunkel)
  const kachel = Math.max(16, Math.floor(w / 20));
  for (let ky = 0; ky < h; ky += kachel) {
    for (let kx = 0; kx < w; kx += kachel) {
      const x2 = Math.min(kx + kachel, w), y2 = Math.min(ky + kachel, h);
      let summe = 0, n = 0;
      for (let y = ky; y < y2; y++) for (let x = kx; x < x2; x++) { summe += grau[y * w + x]; n++; }
      const schwelle = summe / n - 10;
      for (let y = ky; y < y2; y++) for (let x = kx; x < x2; x++) {
        if (grau[y * w + x] < schwelle) bin[y * w + x] = 1;
      }
    }
  }
  // 2. Für Spalten-Streifen (vertikale Bänder) das horizontale Textprofil bilden.
  //    In jedem Streifen die y-Schwerpunkte der Textzeilen finden.
  //    → ergibt Punkte (x_streifenmitte, y_zeilenschwerpunkt), die wir zu Zeilen verketten.
  const streifen = Math.max(20, Math.floor(w / 15));
  const spaltenPunkte = []; // pro Streifen: Liste von y-Zentren
  for (let sx = 0; sx + streifen <= w; sx += streifen) {
    // Zeilen-Dichte je y in diesem Streifen
    const dichte = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      let c = 0;
      for (let x = sx; x < sx + streifen; x++) if (bin[y * w + x]) c++;
      dichte[y] = c;
    }
    // Glätten
    const glatt = new Float32Array(h);
    const rad = 3;
    for (let y = 0; y < h; y++) {
      let s = 0, n = 0;
      for (let d = -rad; d <= rad; d++) { const yy = y + d; if (yy >= 0 && yy < h) { s += dichte[yy]; n++; } }
      glatt[y] = s / n;
    }
    // Lokale Maxima = Textzeilen-Zentren (über einem Schwellwert)
    const maxD = Math.max(...glatt);
    const schwelle = maxD * 0.3;
    const zentren = [];
    for (let y = 1; y < h - 1; y++) {
      if (glatt[y] > schwelle && glatt[y] >= glatt[y - 1] && glatt[y] > glatt[y + 1]) {
        zentren.push({ x: sx + streifen / 2, y });
      }
    }
    spaltenPunkte.push(zentren);
  }
  // 3. Punkte zu Textzeilen verketten: greedy nach y-Nähe über die Streifen.
  return verketteZeilen(spaltenPunkte, h);
}

// Verkettet Spalten-Zentren zu durchgehenden Textzeilen.
// Robust: gruppiert ALLE Zentren nach y-Band (nicht abhängig vom ersten Streifen,
// der leer sein kann, wenn der Text erst in der Bildmitte beginnt).
function verketteZeilen(spaltenPunkte, h) {
  // Alle Zentren einsammeln
  const alle = [];
  for (const streifen of spaltenPunkte) for (const p of streifen) alle.push(p);
  if (alle.length < 4) return [];
  const toleranz = h * 0.05; // wie nah müssen y-Werte sein, um dieselbe Zeile zu sein

  // Nach y sortieren und in Bänder clustern (agglomerativ)
  alle.sort((a, b) => a.y - b.y);
  const baender = [];
  let aktuell = [alle[0]];
  for (let i = 1; i < alle.length; i++) {
    // Referenz = mittleres y des aktuellen Bands
    const refY = aktuell.reduce((s, p) => s + p.y, 0) / aktuell.length;
    if (Math.abs(alle[i].y - refY) <= toleranz) {
      aktuell.push(alle[i]);
    } else {
      baender.push(aktuell);
      aktuell = [alle[i]];
    }
  }
  baender.push(aktuell);

  // Jedes Band = eine Textzeile. Nach x sortieren, Duplikate je x-Streifen mitteln.
  const zeilen = [];
  for (const band of baender) {
    if (band.length < 4) continue;
    band.sort((a, b) => a.x - b.x);
    // Punkte mit fast gleichem x zusammenfassen (ein Punkt pro Streifen)
    const bereinigt = [];
    for (const p of band) {
      const letzter = bereinigt[bereinigt.length - 1];
      if (letzter && Math.abs(letzter.x - p.x) < 1) {
        letzter.y = (letzter.y + p.y) / 2; // mitteln
      } else {
        bereinigt.push({ x: p.x, y: p.y });
      }
    }
    if (bereinigt.length >= 4) zeilen.push(bereinigt);
  }
  return zeilen;
}

// ── STUFE 3b: Remapping — das entzerrte Bild erzeugen ──
// Für jeden Pixel im Zielbild (u,v-Raster) den Quellpixel im Originalbild
// finden (vorwärts projizieren) und bilinear interpolieren.
export function entzerreBild(srcCanvas, params, zielBreite, zielHoehe) {
  const sctx = srcCanvas.getContext('2d');
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const src = sctx.getImageData(0, 0, sw, sh).data;

  const ziel = new ImageData(zielBreite, zielHoehe);
  const dst = ziel.data;

  // u-Bereich aus den Bildecken schätzen (wie viel Bogenlänge sichtbar ist)
  // Wir sampeln das flache Koordinatensystem gleichmäßig über den sichtbaren Bereich.
  // Bereich grob: u in [-uMax, uMax], v in [-vMax, vMax], aus Bildgröße abgeleitet.
  const uMax = params.R * 0.9;           // ~sichtbarer Winkelbereich
  const vMax = sh * 0.5 * (params.camDist / params.f);

  for (let j = 0; j < zielHoehe; j++) {
    const v = (j / zielHoehe - 0.5) * 2 * vMax;
    for (let i = 0; i < zielBreite; i++) {
      const u = (i / zielBreite - 0.5) * 2 * uMax;
      // flache Koordinate → Bildpixel (vorwärts)
      const theta = u / params.R + params.thetaOffset;
      const X = params.R * Math.sin(theta);
      const Z = params.R * Math.cos(theta);
      const zc = Z + params.camDist;
      if (Z <= -params.R * 0.3) continue; // Rückseite überspringen
      const sx = params.cx + (params.f * X / zc) * params.scale;
      const sy = params.cy + (params.f * v / zc) * params.scale;
      if (sx < 0 || sx >= sw - 1 || sy < 0 || sy >= sh - 1) continue;
      // bilineare Interpolation
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0;
      const idx = (j * zielBreite + i) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const p00 = src[(y0 * sw + x0) * 4 + ch];
        const p10 = src[(y0 * sw + x0 + 1) * 4 + ch];
        const p01 = src[((y0 + 1) * sw + x0) * 4 + ch];
        const p11 = src[((y0 + 1) * sw + x0 + 1) * 4 + ch];
        dst[idx + ch] = (p00 * (1 - fx) + p10 * fx) * (1 - fy) + (p01 * (1 - fx) + p11 * fx) * fy;
      }
      dst[idx + 3] = 255;
    }
  }
  return ziel;
}

// ── ORCHESTRIERUNG: Canvas rein → entzerrtes Canvas raus ──
// Der vollständige Weg. Gibt null zurück, wenn keine Wölbung erkennbar ist
// (dann lohnt Dewarping nicht, Original direkt an OCR geben).
export function dewarpCanvas(srcCanvas) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const ctx = srcCanvas.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h).data;
  // Graustufen
  const grau = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < img.length; i += 4, p++) {
    grau[p] = (img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114) | 0;
  }
  // 1. Textzeilen
  const zeilen = findeTextzeilen(grau, w, h);
  if (zeilen.length < 2) return { entzerrt: null, grund: 'zu wenig Textzeilen erkannt' };
  // 2. Wölbung messen: sind die Zeilen im Bild gekrümmt?
  let maxKruemmung = 0;
  for (const z of zeilen) {
    const ys = z.map(p => p.y);
    const m = ys.reduce((a, b) => a + b, 0) / ys.length;
    maxKruemmung = Math.max(maxKruemmung, Math.sqrt(ys.reduce((a, b) => a + (b - m) ** 2, 0) / ys.length));
  }
  if (maxKruemmung < 2) return { entzerrt: null, grund: 'Text ist bereits gerade', kruemmung: maxKruemmung };
  // 3. Zylinder schätzen
  const fit = schaetzeZylinder(zeilen, w, h);
  if (!fit || fit.kosten > 50) return { entzerrt: null, grund: 'Zylinder-Fit unsicher', kosten: fit && fit.kosten };
  // 4. Remapping
  const entzerrt = entzerreBild(srcCanvas, fit.params, w, h);
  return { entzerrt, params: fit.params, kruemmungVorher: maxKruemmung, zeilen: zeilen.length };
}

export const _dewarp_intern = { verketteZeilen, dewarpOptimiere };
