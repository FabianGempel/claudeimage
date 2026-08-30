// ═══════════════════════════════════════════════════════════
// clevia Katalog-Anbindung
// ───────────────────────────────────────────────────────────
// Verbindet jeden Scan mit dem zentralen Produktkatalog (Supabase).
// Zwei Richtungen:
//   1. NACH dem Scan: Produkt in den Katalog schreiben (wächst).
//   2. Für Alternativen: bessere Produkte aus dem Katalog holen.
//
// So entsteht der Kreislauf, der den Wert treibt: Jeder Scan macht
// den Katalog größer → mehr Alternativen verfügbar → wertvoller für
// den nächsten Nutzer → proprietäres, wachsendes DACH-Asset.
//
// Nutzt die Supabase-REST-API (kein SDK nötig) mit dem Service-Key
// serverseitig, damit Schreiben sicher ist (kein Client-Zugriff).
// ═══════════════════════════════════════════════════════════

// Ein Produkt in den Katalog schreiben (Upsert via RPC-Funktion).
// Läuft "fire and forget" — ein Katalog-Fehler darf den Scan nie blockieren.
export async function katalogSpeichern(produkt, config, fetchFn = fetch) {
  const { supabaseUrl, serviceKey } = config || {};
  if (!supabaseUrl || !serviceKey) return { ok: false, grund: 'keine_config' };

  const body = {
    p_barcode: produkt.barcode || null,
    p_produkt: produkt.produkt || '',
    p_marke: produkt.marke || null,
    p_typ: produkt.typ || 'unbekannt',
    p_zutaten: produkt.zutaten || [],
    p_ampel: produkt.ampel || 'unbekannt',
    p_anzahl_rot: produkt.anzahlRot || 0,
    p_anzahl_gelb: produkt.anzahlGelb || 0,
    p_bio: !!produkt.bio,
    p_quelle: produkt.quelle || 'scan',
  };

  try {
    const r = await fetchFn(`${supabaseUrl}/rest/v1/rpc/clevia_produkt_upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) return { ok: false, grund: 'http_' + r.status };
    const id = await r.json();
    return { ok: true, produktId: id };
  } catch (e) {
    return { ok: false, grund: 'netz' };
  }
}

// Beste Alternative(n) aus dem Katalog holen (via RPC-Funktion).
// Gibt Array von Produkten (grünste zuerst) oder [].
export async function katalogAlternative(typ, ampel, ausschlussBarcode, config, fetchFn = fetch) {
  const { supabaseUrl, serviceKey, anonKey } = config || {};
  const key = serviceKey || anonKey;
  if (!supabaseUrl || !key) return [];
  // Nur suchen, wenn das Original überhaupt verbesserbar ist.
  if (ampel !== 'rot' && ampel !== 'gelb') return [];

  try {
    const r = await fetchFn(`${supabaseUrl}/rest/v1/rpc/clevia_finde_alternative`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        p_typ: typ,
        p_ampel: ampel,
        p_ausschluss_barcode: ausschlussBarcode || null,
      }),
    });
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows.map(normalisiereKatalogProdukt) : [];
  } catch (e) {
    return [];
  }
}

// Katalog-Zeile in das App-Produktformat übersetzen.
function normalisiereKatalogProdukt(row) {
  return {
    produkt: row.produkt,
    marke: row.marke || '',
    typ: row.typ,
    zutaten: Array.isArray(row.zutaten) ? row.zutaten : [],
    ampel: row.ampel,
    bio: !!row.bio,
    anzahlRot: row.anzahl_rot || 0,
    anzahlGelb: row.anzahl_gelb || 0,
    beliebtheit: row.scan_anzahl || 1,
  };
}

// Katalog-Statistik holen (für Dashboard / Wertnachweis).
export async function katalogStats(config, fetchFn = fetch) {
  const { supabaseUrl, serviceKey, anonKey } = config || {};
  const key = serviceKey || anonKey;
  if (!supabaseUrl || !key) return null;
  try {
    const r = await fetchFn(`${supabaseUrl}/rest/v1/clevia_katalog_stats?select=*`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

export const _intern = { normalisiereKatalogProdukt };
