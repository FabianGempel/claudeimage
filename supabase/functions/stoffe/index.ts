// ═══════════════════════════════════════════════════════════
// clevia Stoff-Bewertung — API für den geschützten "Long Tail"
// ───────────────────────────────────────────────────────────
// Nimmt ein Array von Stoff-Schlüsseln (ein Produkt), gibt die
// kuratierten Bewertungen zurück — aber NUR die, nicht die ganze DB.
// So bleibt das wertvolle Wissen serverseitig und ist mit F12 nicht
// abgreifbar. Der Client cached die Antworten lokal für Tempo.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (für RPC-Aufruf).
// ═══════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Einfaches In-Memory-Rate-Limit gegen Scraping (pro Function-Instanz).
// Wer in kurzer Zeit sehr viele UNTERSCHIEDLICHE Stoffe abfragt, wird gebremst.
const zugriffe = new Map<string, { count: number; reset: number }>();
const FENSTER_MS = 60_000;   // 1 Minute
const MAX_STOFFE_PRO_MIN = 600;   // ~15-20 Scans/Minute (normal), darüber verdächtig

function rateLimitOk(ip: string, anzahl: number): boolean {
  const jetzt = Date.now();
  const e = zugriffe.get(ip);
  if (!e || jetzt > e.reset) {
    zugriffe.set(ip, { count: anzahl, reset: jetzt + FENSTER_MS });
    return anzahl <= MAX_STOFFE_PRO_MIN;
  }
  e.count += anzahl;
  return e.count <= MAX_STOFFE_PRO_MIN;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { schluessel } = await req.json();
    if (!Array.isArray(schluessel) || schluessel.length === 0) {
      return new Response(JSON.stringify({ stoffe: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Max 100 pro Anfrage (ein Produkt hat nie mehr) — schützt vor Bulk-Abzug.
    const keys = schluessel.slice(0, 100).map((k: string) => String(k).toLowerCase().trim());

    // Rate-Limit
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimitOk(ip, keys.length)) {
      return new Response(JSON.stringify({ error: "rate_limit", stoffe: {} }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase nicht konfiguriert");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Batch-Abfrage über die geschützte Funktion (RLS-umgehend, kontrolliert).
    const { data, error } = await supabase.rpc("clevia_bewerte_stoffe", { schluessel: keys });
    if (error) throw error;

    // Als Objekt { norm_key: {d,i,a,k,g} } zurückgeben (Client-Format).
    const stoffe: Record<string, any> = {};
    for (const row of data || []) {
      stoffe[row.norm_key] = { d: row.d, i: row.i, a: row.a, k: row.k, g: row.g };
    }
    return new Response(JSON.stringify({ stoffe }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), stoffe: {} }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
