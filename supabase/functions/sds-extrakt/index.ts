// ═══════════════════════════════════════════════════════════
// clevia — SDS/Datenblatt-Extraktion für Wasch- & Reinigungsmittel
// ───────────────────────────────────────────────────────────
// Löst das echte Problem: Auf der Packung steht die Zutatenliste NICHT
// vollständig. Die komplette Liste steht (gesetzlich verpflichtend) online
// beim Hersteller. Diese Function ruft diese Seite ab und extrahiert die
// VOLLSTÄNDIGE Zutatenliste — etwas, das keine andere App tut.
//
// Warum als Edge Function (nicht in der App): Der Browser kann fremde
// Hersteller-Seiten wegen CORS nicht direkt lesen. Die Edge Function auf
// Cloudflare hat vollen Netzzugang und liefert der App die fertige Liste.
//
// Zwei-Stufen-Ansatz:
//   1. Seite abrufen (Cloudflare-Netz, kein CORS, keine IP-Blocks)
//   2. Zutatenliste extrahieren — erst per Muster (INCI-Listen erkennen),
//      bei Bedarf per Llama (versteht auch unstrukturierte Seiten)
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID") || "";
const CF_API_TOKEN  = Deno.env.get("CF_API_TOKEN")  || "";
const CF_MODELL = Deno.env.get("CF_MODELL") || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CF_RUN = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODELL}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Schneidet aus rohem HTML den Text heraus (Tags weg, Whitespace normalisiert).
function htmlZuText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Versucht, eine INCI-/Zutatenliste per Muster aus dem Text zu schneiden.
// Reiniger-Datenblätter listen oft nach Stichwörtern wie "Inhaltsstoffe:",
// "Ingredients:", "Zusammensetzung:".
function extrahiereListePerMuster(text: string): string[] | null {
  const marker = /(inhaltsstoffe|ingredients|zusammensetzung|bestandteile|composition)\s*:?\s*/i;
  const m = text.match(marker);
  if (!m || m.index === undefined) return null;
  // Ab dem Marker bis zu einem plausiblen Ende (Satzende-Häufung oder Länge)
  let ausschnitt = text.slice(m.index + m[0].length, m.index + m[0].length + 1200);
  // INCI-Listen sind komma-/semikolongetrennt mit vielen Fachbegriffen
  const teile = ausschnitt.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  // Heuristik: mind. 3 Einträge, die wie Zutaten aussehen (keine langen Sätze)
  const zutaten = teile.filter(t => t.length >= 2 && t.length <= 60 && !/[.!?]{1}\s*[A-ZÄÖÜ]/.test(t)).slice(0, 40);
  return zutaten.length >= 3 ? zutaten : null;
}

// Fällt auf Llama zurück, wenn das Muster nicht greift (unstrukturierte Seite).
async function extrahiereListePerKI(text: string): Promise<string[] | null> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) return null;
  const gekuerzt = text.slice(0, 6000); // Modell-Kontext schonen
  const resp = await fetch(CF_RUN, {
    method: "POST",
    headers: { "Authorization": `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "Du extrahierst aus dem Text einer Hersteller-Produktseite die vollständige Liste der Inhaltsstoffe eines Wasch-/Reinigungsmittels. Gib AUSSCHLIESSLICH ein JSON-Array der Inhaltsstoff-Namen zurück (INCI-Namen, wie auf der Seite). Kein weiterer Text. Wenn keine Zutatenliste erkennbar ist, gib []." },
        { role: "user", content: `Extrahiere die Inhaltsstoffe aus diesem Seitentext:\n${gekuerzt}` },
      ],
      max_tokens: 800,
      temperature: 0,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const roh = data?.result?.response || "";
  try {
    const arr = JSON.parse(roh.match(/\[[\s\S]*\]/)?.[0] || "[]");
    return Array.isArray(arr) && arr.length ? arr.map(String) : null;
  } catch {
    return null;
  }
}

// ── Sucht selbst die SDS-/Inhaltsstoffseite für ein Produkt ──
// Stufe 1: OpenProductsFacts nach dem Hersteller-Link (Feld 'link') fragen.
// Stufe 2: Websuche (DuckDuckGo HTML, kein API-Key) nach "Marke Produkt Inhaltsstoffe".
async function findeSdsUrl(produktName: string, barcode?: string): Promise<string | null> {
  // Stufe 1: Barcode → OpenProductsFacts liefert oft manufacturer_url / link
  if (barcode) {
    try {
      const off = await fetch(
        `https://world.openproductsfacts.org/api/v2/product/${barcode}.json?fields=link,manufacturer_url,brands,product_name`,
        { headers: { "User-Agent": "clevia/1.0 (+https://clevia.app)" }, signal: AbortSignal.timeout(8000) }
      );
      if (off.ok) {
        const data = await off.json();
        const link = data?.product?.link || data?.product?.manufacturer_url;
        if (link && /^https?:\/\//.test(link)) return link;
      }
    } catch { /* weiter zu Stufe 2 */ }
  }

  // Stufe 2: Websuche nach der Inhaltsstoff-Seite
  if (produktName && produktName.trim().length > 1) {
    try {
      const query = encodeURIComponent(`${produktName} Inhaltsstoffe Datenblatt`);
      const such = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(8000),
      });
      if (such.ok) {
        const body = await such.text();
        // DuckDuckGo verpackt Ziel-URLs in uddg=… — die ersten echten Treffer ziehen
        const treffer = [...body.matchAll(/uddg=([^&"]+)/g)]
          .map(m => { try { return decodeURIComponent(m[1]); } catch { return ""; } })
          .filter(u => /^https?:\/\//.test(u) && !/duckduckgo|wikipedia|youtube/i.test(u));
        if (treffer.length) return treffer[0];
      }
    } catch { /* nichts gefunden */ }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    let { url } = body;
    const { produktName, barcode } = body;

    // Keine URL übergeben? Dann selbst suchen (der neue Weg).
    if (!url && (produktName || barcode)) {
      url = await findeSdsUrl(produktName, barcode);
      if (!url) {
        return new Response(JSON.stringify({ ok: false, fehler: "keine Inhaltsstoff-Seite gefunden" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!url || !/^https?:\/\//.test(url)) {
      return new Response(JSON.stringify({ fehler: "keine gültige URL und kein Produktname zum Suchen" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Hersteller-Seite abrufen (Cloudflare-Netz, kein CORS)
    let html: string;
    try {
      const seite = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; clevia/1.0; +https://clevia.app)" },
        signal: AbortSignal.timeout(12000),
      });
      if (!seite.ok) throw new Error(`HTTP ${seite.status}`);
      html = await seite.text();
    } catch (e) {
      return new Response(JSON.stringify({ fehler: `Seite nicht abrufbar: ${String(e instanceof Error ? e.message : e)}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = htmlZuText(html);

    // 2. Zutatenliste extrahieren — erst Muster, dann KI
    let zutaten = extrahiereListePerMuster(text);
    let methode = "muster";
    if (!zutaten) {
      zutaten = await extrahiereListePerKI(text);
      methode = "ki";
    }

    if (!zutaten || !zutaten.length) {
      return new Response(JSON.stringify({ ok: false, fehler: "keine Zutatenliste auf der Seite gefunden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, zutaten, methode, quelle: url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ fehler: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
