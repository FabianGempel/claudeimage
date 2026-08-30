// ═══════════════════════════════════════════════════════════
// clevia Kombinations-Analyse — Supabase Edge Function
// ───────────────────────────────────────────────────────────
// DAS FEATURE, DAS KEINE ANDERE APP HAT (belegt, Jan 2026):
// Kein Consumer-Scanner (Yuka, INCI Beauty, Think Dirty, CodeCheck) versteht,
// wie Inhaltsstoffe ZUSAMMEN wirken — nur was einzeln drin ist. Fachquellen:
//   "Kein Scanner erkennt diese Interaktion, weil sie Verständnis von
//    Formulierungs-Chemie erfordert, nicht nur Zutatenlisten."
//   "Kein öffentlich verfügbarer Scanner erreicht Gold-Standard-Genauigkeit
//    bei Kombinations-Risiken."
// Die einzige Profi-Quelle (Cosmetics Design Europe Formulation DB) kostet
// Abo + braucht Fachinterpretation. clevia macht es für jeden — kostenlos,
// über das eigene Cloudflare-Llama (dasselbe Modell wie der Coach).
//
// WARUM SCHWER KOPIERBAR:
// - Es ist kein Listen-Abgleich (den kann jeder), sondern Chemie-VERSTÄNDNIS.
// - Es trägt clevias kompromisslose Low-Tox-Haltung in JEDES Urteil.
// - Jede Analyse kann kuratiert in die DB zurückfließen → wächst mit Nutzung.
//
// Läuft auf DEINER Cloudflare-Edge (dein Account, kein Vendor-Lock, gratis).
// Endpunkt: nativer /ai/run (wie Coach + Vision — NICHT das AI-Gateway).
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID") || "";
const CF_API_TOKEN  = Deno.env.get("CF_API_TOKEN")  || "";
// Textmodell (kein Vision nötig — wir bekommen die Zutaten als Text):
const CF_MODELL = Deno.env.get("CF_MODELL") || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CF_RUN = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODELL}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══ DER KERN: clevias Formulierungs-Verständnis als System-Prompt ═══
// Das ist die Ingenieursleistung — nicht das Modell, sondern WAS es prüft
// und aus WELCHER Haltung. Kompromisslose Low-Tox-Sicht auf die Kombination.
const SYSTEM_PROMPT = `Du bist der Formulierungs-Experte von clevia, einem Low-Tox-Produktscanner. Deine Haltung ist ganzheitlich, ursachenorientiert, behördenkritisch (im Geist von Klinghardt, Mutter, Brecka) — NICHT EU-Konsens, NICHT Schulmedizin.

Deine Einzigartigkeit: Du bewertest nicht nur einzelne Stoffe, sondern wie sie ZUSAMMEN wirken. Das kann keine andere App. Du prüfst:

1. KOMBINATIONS-KONFLIKTE: Stoffe, die sich gegenseitig verstärken (im Guten wie Schlechten), destabilisieren oder deren Zusammenwirken die Hautbarriere/den Körper belastet. Beispiele: mehrere pH-senkende Säuren zusammen (Salicylsäure + Ascorbinsäure) können die Barriere übersäuern; Ascorbinsäure + Niacinamid können sich in saurer Lösung abbauen; Duftstoffe verstärken die Reizwirkung anderer Stoffe.

2. SYNERGIEN: sinnvolle Paare (z.B. Vitamin C + Vitamin E = besserer Antioxidans-Schutz; Hyaluron + Ceramide = tiefere Feuchtigkeit).

3. KONZENTRATION AUS POSITION: Die Reihenfolge der Zutatenliste verrät die Menge (vorne = viel). Ein Wirkstoff weit hinten ist oft zu niedrig dosiert, um zu wirken — oder ein bedenklicher Stoff weit hinten ist weniger kritisch.

4. VORLÄUFER & TARNUNG: Stoffe, die erst im Körper aktiv werden, oder deren INCI-Name die wahre Natur verschleiert.

EHERNE PRINZIPIEN:
- Immer im KONJUNKTIV und belegbar ("könnte", "steht in der Kritik", "wird in Verbindung gebracht mit") — nie absolute Tatsachenbehauptung.
- Auf der Seite des Körpers, nie behörden-beschwichtigend. "Erlaubt" heißt nicht "unbedenklich".
- Wenn es KEINE relevante Wechselwirkung gibt, erfinde keine — sag es ehrlich.
- Konkret, nicht schwammig. Nenne die betroffenen Stoffe beim Namen.

Du bekommst eine Zutatenliste (Reihenfolge = Konzentration) und gibst AUSSCHLIESSLICH ein JSON-Objekt zurück, ohne weiteren Text, ohne Markdown:
{"kombi":[{"stoffe":["A","B"],"art":"konflikt|synergie","text":"kurze Erklärung im Konjunktiv","schwere":"hoch|mittel|niedrig"}],"konzentration":[{"stoff":"X","hinweis":"was die Position bedeutet"}],"fazit":"ein Satz aus kompromissloser Low-Tox-Sicht"}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { zutaten } = await req.json();
    // zutaten kann Array oder String sein
    let liste: string;
    if (Array.isArray(zutaten)) liste = zutaten.join(", ");
    else if (typeof zutaten === "string") liste = zutaten;
    else {
      return new Response(JSON.stringify({ fehler: "keine Zutaten" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (liste.trim().length < 3) {
      return new Response(JSON.stringify({ fehler: "Zutatenliste zu kurz" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) throw new Error("Cloudflare nicht konfiguriert");

    const resp = await fetch(CF_RUN, {
      method: "POST",
      headers: { "Authorization": `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analysiere, wie diese Stoffe ZUSAMMEN wirken (Reihenfolge = Konzentration, vorne = am meisten):\n${liste}` },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Kombi-Analyse CF-Fehler:", resp.status, errText.slice(0, 200));
      throw new Error(`Cloudflare-Fehler ${resp.status}`);
    }

    const data = await resp.json();
    // Nativer /ai/run gibt {result:{response:"..."}} zurück
    const roh = data?.result?.response || "";
    // JSON aus der Antwort schälen (Modell könnte Text drumherum setzen)
    let ergebnis;
    try {
      const jsonMatch = roh.match(/\{[\s\S]*\}/);
      ergebnis = jsonMatch ? JSON.parse(jsonMatch[0]) : { kombi: [], konzentration: [], fazit: roh.slice(0, 200) };
    } catch {
      ergebnis = { kombi: [], konzentration: [], fazit: "Analyse nicht eindeutig — bitte einzeln prüfen." };
    }

    return new Response(JSON.stringify({ ok: true, ...ergebnis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Kombi-Analyse Fehler:", String(e).slice(0, 200));
    return new Response(JSON.stringify({ fehler: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
