// ═══════════════════════════════════════════════════════════
// clevia Stoff-Agent — bewertet UNBEKANNTE Stoffe per KI
// ───────────────────────────────────────────────────────────
// Das Problem, das ohne KI unlösbar war: clevias kuratierte DB kennt
// ~582 Stoffe. Aber es gibt Millionen, ständig neue. Bisher: unbekannter
// Stoff → "unknown" oder grobe Muster-Heuristik.
//
// Mit KI: Ein Agent, der clevias Low-Tox-PHILOSOPHIE versteht und auf
// jeden neuen Stoff anwendet — nicht EU-Konsens, sondern die scharfe,
// behördenkritische Linie. Das war ohne Sprachmodell unmöglich: man kann
// nicht für Millionen Stoffe Regeln schreiben. Ein Modell, das die HALTUNG
// verinnerlicht, bewertet auch Stoffe, die es nie gesehen hat.
//
// Strategisch: Der Wert liegt im System-Prompt (clevias Philosophie),
// nicht im Modell. Schwer kopierbar. Und jede Bewertung kann in die DB
// zurückfließen → die KI füllt den Datengraben, während Nutzer scannen.
//
// Läuft auf DEINER Cloudflare-Infrastruktur (gratis, kein Cold-Start),
// gleiches Muster wie die coach-Function. Antwort ist striktes JSON,
// damit die App sie direkt wie einen DB-Eintrag verarbeiten kann.
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID") || "";
const CF_API_TOKEN = Deno.env.get("CF_API_TOKEN") || "";
const CF_MODELL = Deno.env.get("CF_MODELL") || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
// Für die lernende DB: zentrale Speicherung neuer Bewertungen (nur serverseitig).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CF_RUN = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODELL}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══ DER KERN: clevias Bewertungs-Philosophie als System-Prompt ═══
// Das ist die eigentliche Ingenieursleistung. Die KI wird zu clevia,
// nicht zu einem neutralen EU-Bewerter.
const SYSTEM_PROMPT = `Du bist der Bewertungs-Experte von clevia, einem Low-Tox-Produktscanner für die DACH-Region. Du bewertest Inhaltsstoffe nach einer strikten, gesundheitsbewussten Low-Tox-Philosophie — NICHT nach EU-Konsens.

DEINE BEWERTUNGSLOGIK (drei Stufen):
- GRÜN (grün): Natürlich, sicher, unbedenklich. Pflanzliche Öle, Extrakte, mineralische Stoffe, bewährte natürliche Zutaten. Auch natürliche Süße (Honig, Dattelsüße) ist grün.
- ROT (rot): Vermeiden nach strikter Low-Tox-Linie — AUCH wenn die EU es erlaubt. Synthetische Tenside (Sulfate, PEG), Silikone, synthetische Konservierer (Parabene, Formaldehydabspalter), künstliche Farb-/Süßstoffe, Mineralöl-Derivate, Mikroplastik, hormonell wirksame Stoffe, umstrittene Zusatzstoffe.
- GELB (gelb): NUR echte HERKUNFTS- oder REINHEITS-Grenzfälle — NIEMALS wegen der Menge. Ein Stoff ist gelb nur, wenn derselbe Stoff je nach Gewinnung/Herkunft sauber ODER belastet sein kann (z.B. "je nach Gewinnung unterschiedlich rein", "als Naturprodukt grün, synthetisch hergestellt rot"). Die DOSIS ist dabei IRRELEVANT.

DIE HERSTELLUNG ENTSCHEIDET — NICHT DER NAME (kritische Regel):
- Bewerte NIEMALS nach dem Namen allein. Viele Stoffe KLINGEN natürlich, sind aber industrielle Produkte. Prüfe IMMER die typische Herstellung.
- GENTECHNIK (GMO): Stoffe, die üblicherweise aus gentechnisch verändertem Soja, Mais, Raps oder Zuckerrübe gewonnen werden (z.B. Sojalecithin, viele "Aromen", Maltodextrin, Glukosesirup, oft auch Xanthan, Ascorbinsäure/Vitamin C, Citronensäure aus Fermentation) → ROT, außer explizit als GVO-frei/Bio deklariert.
- LÖSUNGSMITTEL-EXTRAKTION: Stoffe, die typisch mit Hexan oder anderen Lösungsmitteln extrahiert werden (Sojalecithin, raffinierte Pflanzenöle, viele Extrakte) → ROT. Nur kaltgepresst/mechanisch gewonnen kann grün sein.
- VERARBEITUNGSGRAD: Hochverarbeitete, isolierte oder chemisch modifizierte Stoffe (modifizierte Stärke, Maltodextrin, Isolate, Hydrolysate) sind KEIN Naturprodukt → ROT oder mindestens GELB, auch wenn der Ausgangsstoff natürlich war.
- FERMENTATIONS-PRODUKTE aus Industrie: Citronensäure (heute fast immer aus Schimmelpilz-Fermentation mit GVO-Substrat), industrielle Aromen → kritisch bewerten (ROT/GELB), nicht als "natürlich" durchwinken.
- Konkret: "Lecithin"/"Sojalecithin" ist NICHT grün, nur weil Lecithin natürlich vorkommt — die industrielle Realität ist GVO-Soja + Hexan → ROT. Sonnenblumenlecithin (GVO-frei) ist die grüne Alternative.
- Merke: Frag dich bei JEDEM scheinbar harmlosen Stoff: "Wie wird das WIRKLICH industriell hergestellt?" Wenn GMO, Lösungsmittel oder starke Verarbeitung im Spiel sind → nicht grün.

DIE MENGE IST EGAL — DAS WICHTIGSTE PRINZIP:
- Ein Giftstoff bleibt Gift, auch in kleinsten Mengen und Spuren. "Nur in geringer Menge enthalten", "unterhalb des Grenzwerts", "nur Spuren" sind KEINE Gründe für eine mildere Bewertung. Kleinste Mengen eines bedenklichen Stoffes sind ein No-Go → ROT.
- Ein bedenklicher Stoff wird NIEMALS gelb oder grün, nur weil er niedrig dosiert ist. Die Menge spielt für die Ampel KEINE Rolle. Bewertet wird die NATUR des Stoffes, nicht seine Konzentration.
- Formulierungen wie "in dieser Konzentration unbedenklich", "erst ab Menge X kritisch" sind VERBOTEN — das ist genau das Grenzwert-Denken der Behörden, das clevia ablehnt.

WICHTIGE PRINZIPIEN:
- "Es kommt darauf an" ist KEINE akzeptable Bewertung. Das ist EU-Konsens-Denken, das clevia ablehnt.
- Gift bleibt Gift — keine Gruppen-Ausnahmen.
- Die EU-Zulassung ist NICHT der Maßstab. Maßstab ist, was die gesundheitsbewusste, behördenkritische Low-Tox-Community als bedenklich einstuft.
- Bei Kritik: formuliere im Konjunktiv und belegbar ("steht in der Kritik, weil...", "wird in Verbindung gebracht mit..."), nie als absolute Tatsachenbehauptung.
- Synthetische Stoffe im Zweifel eher ROT, natürliche im Zweifel eher GRÜN.

Du bekommst einen Inhaltsstoff und gibst AUSSCHLIESSLICH ein JSON-Objekt zurück, exakt in diesem Format, ohne weiteren Text, ohne Markdown:
{"d":"deutscher Name","i":"INCI/Fachname falls bekannt sonst null","a":"grün|gelb|rot","k":"Kategorie (z.B. Tensid, Pflanzenöl, Konservierer)","g":"kurze Begründung (max 15 Wörter), im Konjunktiv wenn kritisch"}`;


// Schreibt eine neue KI-Bewertung zentral in die DB (lernende Datenbank).
// Jeder naechste Nutzer profitiert sofort. Nur wenn Stoff neu ist.
async function lerneZentral(key, b) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  try {
    const url = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/clevia_lerne_stoff";
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE,
        "Authorization": "Bearer " + SERVICE_ROLE,
      },
      body: JSON.stringify({
        p_norm_key: key,
        p_d: b.d || key, p_i: b.i || null,
        p_a: b.a, p_k: b.k || "", p_g: b.g || "",
      }),
    });
  } catch (e) { /* Lernen ist Bonus, Fehler bricht Bewertung nicht ab */ }
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { stoff } = await req.json();
    if (!stoff || typeof stoff !== "string" || stoff.length < 2) {
      return new Response(JSON.stringify({ error: "kein Stoff" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) throw new Error("Cloudflare nicht konfiguriert");

    // KI-Aufruf: bewerte den Stoff nach clevias Philosophie
    const resp = await fetch(CF_RUN, {
      method: "POST",
      headers: { "Authorization": `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Bewerte diesen Inhaltsstoff nach clevias Low-Tox-Logik: "${stoff}"` },
        ],
        temperature: 0.2,   // niedrig = konsistent, weniger "kreativ"
        max_tokens: 200,
      }),
    });
    if (!resp.ok) throw new Error(`Cloudflare ${resp.status}`);
    const data = await resp.json();
    // Cloudflare-Format: {result:{response:"..."}}
    const roh = data?.result?.response || "";

    // JSON aus der Antwort extrahieren (Modell kann Text drumherum schreiben)
    const bewertung = extrahiereJSON(roh);
    if (!bewertung || !bewertung.a) {
      // Konnte nicht sauber bewerten → ehrliches Signal, App nutzt Muster-Fallback
      return new Response(JSON.stringify({ erkannt: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Ampel normalisieren (Modell könnte "gruen"/"green" schreiben)
    bewertung.a = normAmpel(bewertung.a);

    // LERNEN: neue Bewertung zentral speichern, damit ALLE Nutzer profitieren.
    if (typeof stoff === "string" && stoff) {
      const normKey = stoff.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
      await lerneZentral(normKey, bewertung);
    }

    return new Response(JSON.stringify({ erkannt: true, bewertung, quelle: "ki" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ erkannt: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Extrahiert das erste JSON-Objekt aus einem Text (robust gegen Drumherum).
function extrahiereJSON(text: string): any {
  if (!text) return null;
  // Direkter Versuch
  try { return JSON.parse(text.trim()); } catch (_) {}
  // Objekt-Klammern suchen
  const start = text.indexOf("{");
  const ende = text.lastIndexOf("}");
  if (start >= 0 && ende > start) {
    try { return JSON.parse(text.slice(start, ende + 1)); } catch (_) {}
  }
  return null;
}

// Vereinheitlicht Ampel-Schreibweisen auf grün|gelb|rot.
function normAmpel(a: string): string {
  const s = String(a).toLowerCase().trim();
  if (/rot|red|avoid/.test(s)) return "rot";
  if (/gelb|yellow|caution/.test(s)) return "gelb";
  if (/gr[üu]e?n|green|clean/.test(s)) return "grün";
  return "gelb"; // im Zweifel Vorsicht
}
