// ═══════════════════════════════════════════════════════════
// Vision-Route: liest Zutaten aus einem Etikett-Foto (VLM).
// Anbieter: Cloudflare Workers AI (Standard) oder Fremd — die
// Wahl kapselt visionAnbieter(). Router-Modul unter /api/v1.
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { visionAnbieter, VISION_SYSTEM_PROMPT, REGAL_SYSTEM_PROMPT } from '../lib/vision-provider.js';
import { bildeKonsens } from '../lib/vision-konsens.js';
import { filtereZutaten } from '../lib/zutaten-filter.js';

export const visionRouter = Router();

// Wie viele unabhängige Durchläufe pro Scan? Mehr = zuverlässiger, aber
// langsamer/teurer. 3 ist der Sweet Spot (Mehrheit möglich, noch schnell).
// Bei Regal-Scans nur 2 (das Bild ist komplexer, Aufrufe teurer).
const KONSENS_DURCHLAEUFE = 3;

// Ein einzelner Vision-Aufruf gegen das Modell. Gibt das geparste Ergebnis
// zurück oder null. Wird für die parallelen Konsens-Durchläufe genutzt.
async function einVisionDurchlauf(prov, imageUrl, temperature) {
  const istCloudflare = prov.name === 'cloudflare';
  const url = istCloudflare ? `${prov.url}/${prov.modell}` : prov.url;
  const messages = [
    { role: 'system', content: VISION_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: 'Lies die Inhaltsstoffe von diesem Etikett und gib sie als JSON zurück.' },
      { type: 'image_url', image_url: { url: imageUrl } },
    ]},
  ];
  const body = istCloudflare
    ? { messages, max_tokens: 1500, temperature }
    : { model: prov.modell, messages, max_tokens: 1500, temperature };

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prov.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch { return { fehler: 'netz' }; }

  if (!resp.ok) return { fehler: resp.status === 429 ? 'limit' : 'http', status: resp.status };

  const data = await resp.json();
  let inhalt = data.result?.response ?? data.choices?.[0]?.message?.content ?? '';
  if (Array.isArray(inhalt)) {
    inhalt = inhalt.map(t => (typeof t === 'string' ? t : (t && t.text) || '')).join('');
  }
  inhalt = String(inhalt).replace(/```json|```/g, '').trim();
  let ergebnis;
  try { ergebnis = JSON.parse(inhalt); }
  catch {
    const m = inhalt.match(/\{[\s\S]*\}/);
    try { ergebnis = m ? JSON.parse(m[0]) : null; } catch { ergebnis = null; }
  }
  return (ergebnis && Array.isArray(ergebnis.zutaten)) ? ergebnis : { fehler: 'parse' };
}

// ═══ DIAGNOSE: Vision-Weg testen OHNE Terminal ═══════════════
// Im Browser aufrufen: /api/vision-test  (oder /api/v1/vision-test)
// Testet den echten Cloudflare-Vision-Aufruf mit einem Mini-Testbild und
// zeigt das Ergebnis als lesbaren Text. Sagt sofort, wo es klemmt.
visionRouter.get('/vision-test', async (req, res) => {
  const prov = visionAnbieter();
  if (!prov) {
    return res.type('text/plain').send(
      'VISION-TEST\n\n✗ kein_anbieter — die CF-Variablen fehlen auf Railway.\n' +
      'Setze CF_ACCOUNT_ID und CF_API_TOKEN in den Railway-Variablen.'
    );
  }
  // Mini 1x1-Testbild
  const testBild = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const istCloudflare = prov.name === 'cloudflare';
  const url = istCloudflare ? `${prov.url}/${prov.modell}` : prov.url;
  const body = istCloudflare
    ? { messages: [{ role: 'user', content: [{ type: 'text', text: 'Was siehst du?' }, { type: 'image_url', image_url: { url: testBild } }] }], max_tokens: 50 }
    : { model: prov.modell, messages: [{ role: 'user', content: 'test' }], max_tokens: 50 };

  const zeilen = ['VISION-TEST', ''];
  zeilen.push('Anbieter: ' + prov.name);
  zeilen.push('Modell: ' + prov.modell);
  zeilen.push('URL: ' + url.replace(/\/[^/]*$/, '/…'));
  zeilen.push('');
  try {
    const t0 = Date.now();
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prov.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const dauer = Date.now() - t0;
    zeilen.push('HTTP-Status: ' + r.status + '  (' + dauer + 'ms)');
    const txt = await r.text();
    if (r.ok) {
      zeilen.push('');
      zeilen.push('✓ CLOUDFLARE ERREICHT — der Scanner-Server funktioniert.');
      zeilen.push('Wenn der Scanner in der App trotzdem sofort offline geht,');
      zeilen.push('liegt es an der App (Cache/alte Version) — hart neu laden.');
      zeilen.push('');
      zeilen.push('Antwort (gekürzt): ' + txt.slice(0, 200));
    } else {
      zeilen.push('');
      zeilen.push('✗ Cloudflare lehnt ab.');
      if (r.status === 401 || r.status === 403) {
        zeilen.push('→ Der CF_API_TOKEN auf Railway hat nicht das Recht "Workers AI".');
        zeilen.push('  Neuen Token erstellen und in Railway CF_API_TOKEN setzen.');
      } else if (r.status === 404) {
        zeilen.push('→ Account-ID falsch oder Modellname stimmt nicht.');
      }
      zeilen.push('');
      zeilen.push('Fehler: ' + txt.slice(0, 300));
    }
  } catch (e) {
    zeilen.push('✗ NETZWERKFEHLER: ' + String(e).slice(0, 200));
    zeilen.push('→ Server erreicht Cloudflare technisch nicht.');
  }
  res.type('text/plain').send(zeilen.join('\n'));
});

visionRouter.post('/vision', async (req, res) => {
  const prov = visionAnbieter();
  if (!prov) return res.json({ ok: false, grund: 'kein_key' });

  const { bild } = req.body || {};
  if (!bild || typeof bild !== 'string') {
    return res.status(400).json({ ok: false, grund: 'kein_bild' });
  }
  const imageUrl = bild.startsWith('data:') ? bild : `data:image/jpeg;base64,${bild}`;

  try {
    // ═══ MULTI-SIGNAL-KONSENS ═══════════════════════════════
    // Statt EINEM Aufruf machen wir mehrere unabhängige Durchläufe parallel
    // (leicht variierte Temperatur → echte Unabhängigkeit statt identischer
    // Wiederholung) und bilden daraus einen abgesicherten Konsens.
    // Das korrigiert Lesefehler und filtert Halluzinationen.
    const temps = [0.1, 0.25, 0.4].slice(0, KONSENS_DURCHLAEUFE);
    const durchlaeufe = await Promise.all(
      temps.map(t => einVisionDurchlauf(prov, imageUrl, t))
    );

    // Erfolgreiche Durchläufe (mit gültiger zutaten-Liste) einsammeln.
    // Jeden Durchlauf durch den Zutaten-Filter schicken: wirft Firmendaten,
    // Mengen, Adressen, Werbetext raus, bevor der Konsens gebildet wird.
    const gueltige = durchlaeufe
      .filter(d => d && Array.isArray(d.zutaten))
      .map(d => ({ ...d, zutaten: filtereZutaten(d.zutaten).zutaten }));

    // Wenn ALLE fehlschlugen: den Grund des ersten Fehlers melden.
    if (gueltige.length === 0) {
      const ersterFehler = durchlaeufe.find(d => d && d.fehler);
      if (ersterFehler?.fehler === 'limit') return res.status(429).json({ ok: false, grund: 'limit', limit: true });
      if (ersterFehler?.fehler === 'netz' || ersterFehler?.fehler === 'http') return res.status(502).json({ ok: false, grund: 'nicht_erreichbar' });
      return res.json({ ok: false, grund: 'nicht_lesbar' });
    }

    // Konsens aus den gültigen Durchläufen bilden.
    const konsens = bildeKonsens(gueltige);
    if (!konsens.ok) return res.json({ ok: false, grund: 'nicht_lesbar' });

    res.json(konsens);
  } catch (err) {
    console.error('Vision-Fehler:', err.message);
    res.status(500).json({ ok: false, grund: 'fehler' });
  }
});

// ═══ REGAL-SCAN: mehrere Produkte in einem Foto ══════════════
// Nutzt den Regal-Prompt (erkennt mehrere Produkte mit Position).
// Gibt die erkannten Produkte MIT ihren Zutaten zurück — die eigentliche
// Low-Tox-Bewertung + das Ranking macht die App mit ihrer KURIERT_DB
// (die Bewertungslogik bleibt an EINER Stelle, nicht doppelt).
visionRouter.post('/regal', async (req, res) => {
  const prov = visionAnbieter();
  if (!prov) return res.json({ ok: false, grund: 'kein_key' });

  const { bild } = req.body || {};
  if (!bild || typeof bild !== 'string') {
    return res.status(400).json({ ok: false, grund: 'kein_bild' });
  }
  const imageUrl = bild.startsWith('data:') ? bild : `data:image/jpeg;base64,${bild}`;
  const istCloudflare = prov.name === 'cloudflare';
  const url = istCloudflare ? `${prov.url}/${prov.modell}` : prov.url;

  const messages = [
    { role: 'system', content: REGAL_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: 'Erkenne alle Produkte in diesem Regal-Foto und gib sie als JSON zurück.' },
      { type: 'image_url', image_url: { url: imageUrl } },
    ]},
  ];
  // Regal-Bilder sind komplex → mehr Tokens fürs Ergebnis, niedrige Temperatur.
  const body = istCloudflare
    ? { messages, max_tokens: 2500, temperature: 0.1 }
    : { model: prov.modell, messages, max_tokens: 2500, temperature: 0.1 };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${prov.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const istLimit = resp.status === 429;
      return res.status(istLimit ? 429 : 502).json({ ok: false, grund: istLimit ? 'limit' : 'nicht_erreichbar', limit: istLimit });
    }
    const data = await resp.json();
    let inhalt = data.result?.response ?? data.choices?.[0]?.message?.content ?? '';
    if (Array.isArray(inhalt)) {
      inhalt = inhalt.map(t => (typeof t === 'string' ? t : (t && t.text) || '')).join('');
    }
    inhalt = String(inhalt).replace(/```json|```/g, '').trim();
    let ergebnis;
    try { ergebnis = JSON.parse(inhalt); }
    catch {
      const m = inhalt.match(/\{[\s\S]*\}/);
      try { ergebnis = m ? JSON.parse(m[0]) : null; } catch { ergebnis = null; }
    }
    if (!ergebnis || !Array.isArray(ergebnis.produkte)) {
      return res.json({ ok: false, grund: 'keine_produkte' });
    }
    // Produkte durchreichen — die App rankt sie mit ihrer eigenen Bewertung.
    res.json({ ok: true, produkte: ergebnis.produkte });
  } catch (err) {
    console.error('Regal-Fehler:', err.message);
    res.status(500).json({ ok: false, grund: 'fehler' });
  }
});
