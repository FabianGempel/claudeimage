// ═══════════════════════════════════════════════════════════
// Umwelt-Routen: Sendemasten (EMF) + Luftqualität.
// Router-Modul — wird unter /api/v1 eingehängt.
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { config } from '../config.js';
import { supabase } from '../lib/clients.js';

export const umweltRouter = Router();

// ── Sendemasten in der Nähe ───────────────────────────────
// Dreistufige Kaskade: eigene Supabase-DB → OpenCelliD → OpenStreetMap.
// DEBUG-Endpunkt: zeigt genau wo die Masten-Kette klemmt (temporär)
umweltRouter.get('/masten-debug', async (req, res) => {
  const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  const info = { supabase_client_existiert: !!supabase, schritte: [] };
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('masten_im_umkreis', {
        p_lat: lat, p_lon: lon, p_radius_m: 1500,
      });
      info.rpc_error = error ? { message: error.message, details: error.details, hint: error.hint, code: error.code } : null;
      info.rpc_anzahl = Array.isArray(data) ? data.length : null;
      info.rpc_erste_zeile = Array.isArray(data) && data.length ? data[0] : null;
    } catch (e) {
      info.rpc_exception = e.message;
    }
  } else {
    info.grund = 'Supabase-Client ist null → URL oder SERVICE_KEY fehlt/ungültig in config';
    info.url_gesetzt = !!process.env.SUPABASE_URL;
    info.service_key_gesetzt = !!process.env.SUPABASE_SERVICE_KEY;
    info.service_key_laenge = (process.env.SUPABASE_SERVICE_KEY || '').length;
  }
  return res.json(info);
});

umweltRouter.get('/masten', async (req, res) => {
  const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ ok: false, grund: 'koordinaten' });
  // Radius flexibel: Standard 5000m (sichtbare Masten liegen oft 2-4km entfernt),
  // per ?radius= steuerbar, gedeckelt auf 20km.
  let radius = parseInt(req.query.radius, 10);
  if (isNaN(radius) || radius <= 0) radius = 5000;
  if (radius > 20000) radius = 20000;

  // Primär: eigene Supabase-Masten-Datenbank
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('masten_im_umkreis', {
        p_lat: lat, p_lon: lon, p_radius_m: radius,
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        const masten = data.map(m => ({
          lat: m.lat, lon: m.lon, radio: m.radio || '',
          range: m.hoehe_max || 0, cellid: `${m.lat},${m.lon}`,
        }));
        return res.json({ ok: true, masten, quelle: 'eigene_db' });
      }
    } catch (e) {
      console.error('Masten-DB-Fehler:', e.message);
    }
  }

  // Fallback 1: OpenCelliD Live-API (nur wenn Key gesetzt)
  const key = config.openCellIdKey;
  if (key) {
    const d = 0.011;
    const bbox = `${(lat-d).toFixed(5)},${(lon-d).toFixed(5)},${(lat+d).toFixed(5)},${(lon+d).toFixed(5)}`;
    const netze = [[262,1],[262,2],[262,3],[232,1],[232,3],[228,1],[228,2]];
    const alleMasten = [];
    const gesehen = new Set();
    try {
      for (const [mcc, mnc] of netze) {
        const url = `https://opencellid.org/cell/getInArea?key=${key}&BBOX=${bbox}&mcc=${mcc}&mnc=${mnc}&format=json&limit=100`;
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const data = await r.json();
          const cells = (data && data.cells) ? data.cells : [];
          for (const c of cells) {
            const id = c.cellid || `${c.lat},${c.lon}`;
            if (gesehen.has(id)) continue;
            gesehen.add(id);
            alleMasten.push({ lat: c.lat, lon: c.lon, range: c.range, radio: c.radio, cellid: c.cellid });
          }
        } catch (e) { /* Netz übersprungen */ }
      }
      if (alleMasten.length > 0) {
        return res.json({ ok: true, masten: alleMasten, quelle: 'opencellid' });
      }
    } catch (err) {
      console.error('OpenCelliD-Fehler:', err.message);
    }
  }

  // Fallback 2: OpenStreetMap Overpass — kostenlos, kein Key.
  try {
    // Bounding-Box aus dem gewählten Radius ableiten (grob: 1 Grad ≈ 111km).
    const d = Math.min(radius / 111000, 0.18);
    const s = (lat-d).toFixed(5), w = (lon-d).toFixed(5), n = (lat+d).toFixed(5), e = (lon+d).toFixed(5);
    const bbox = `${s},${w},${n},${e}`;
    const query = `[out:json][timeout:20];(` +
      `node["man_made"="mast"]["communication:mobile_phone"](${bbox});` +
      `node["man_made"="tower"]["communication:mobile_phone"](${bbox});` +
      `node["man_made"="communications_tower"](${bbox});` +
      `node["man_made"="antenna"]["communication:mobile_phone"](${bbox});` +
      `node["tower:type"="communication"](${bbox});` +
      `way["man_made"="mast"]["communication:mobile_phone"](${bbox});` +
      `way["man_made"="communications_tower"](${bbox});` +
      `);out center;`;
    const endpunkte = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];
    let elements = null;
    for (const ep of endpunkte) {
      try {
        const r = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
        });
        if (!r.ok) continue;
        const data = await r.json();
        if (data && Array.isArray(data.elements)) { elements = data.elements; break; }
      } catch (e) { /* nächsten Endpunkt versuchen */ }
    }
    if (elements) {
      const masten = elements.map(el => {
        const la = el.lat != null ? el.lat : (el.center && el.center.lat);
        const lo = el.lon != null ? el.lon : (el.center && el.center.lon);
        const t = el.tags || {};
        const h = parseFloat(t.height || t['tower:height'] || '0') || 0;
        return { lat: la, lon: lo, range: h, radio: (t['technology:mobile_phone'] || '').toUpperCase(), cellid: `${la},${lo}` };
      }).filter(m => m.lat != null && m.lon != null);
      return res.json({ ok: true, masten, quelle: 'openstreetmap' });
    }
    // Keine Masten in diesem Umkreis gefunden (weder DB noch Overpass) — das ist KEIN Key-Problem
    return res.json({ ok: true, masten: [], quelle: 'keine_in_umkreis' });
  } catch (err) {
    console.error('Overpass-Fehler:', err.message);
    return res.json({ ok: false, grund: 'quellen_nicht_erreichbar', detail: err.message });
  }
});

// ── Luftqualität (World Air Quality Index) ────────────────
umweltRouter.get('/luft', async (req, res) => {
  const token = config.waqiToken;
  if (!token) return res.json({ ok: false, grund: 'kein_key' });
  const lat = parseFloat(req.query.lat), lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ ok: false, grund: 'koordinaten' });

  try {
    const url = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${token}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.status !== 'ok') {
      return res.json({ ok: false, grund: 'keine_station' });
    }
    const d = data.data;
    const iaqi = d.iaqi || {};
    res.json({
      ok: true,
      aqi: d.aqi,
      station: d.city?.name || null,
      zeit: d.time?.s || null,
      werte: {
        pm25: iaqi.pm25?.v ?? null,
        pm10: iaqi.pm10?.v ?? null,
        o3:   iaqi.o3?.v ?? null,
        no2:  iaqi.no2?.v ?? null,
        so2:  iaqi.so2?.v ?? null,
        co:   iaqi.co?.v ?? null,
      },
    });
  } catch (err) {
    console.error('Luft-Abfrage-Fehler:', err.message);
    res.status(500).json({ ok: false, grund: 'abfrage' });
  }
});
