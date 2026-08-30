// ═══════════════════════════════════════════════════════════
// clevia Vision — Supabase Edge Function
// Liest Zutaten aus einem Etikett-FOTO mit einem Vision-Modell (VLM).
// Ein VLM versteht Bild UND Sprache: es liest auch gekrümmten, glänzenden
// oder teilweise verdeckten Text, weil es Kontext kennt — dort wo reine
// OCR (Tesseract) nur Pixel-Fragmente sieht.
//
// STANDARD: Cloudflare Workers AI — läuft auf DEINER eigenen Cloudflare-Edge
// (dein Account, deine Kontrolle, kein Vendor-Lock-in, kein Gemini-Key nötig).
// Derselbe Anbieter wie beim Coach. Anbieter bleibt flexibel (Gemini/OpenAI
// als Option) — Umschalten nur über Secrets.
// Der API-Key liegt SICHER serverseitig, nie in der App.
//
// ═══ ENDPUNKT: nativer /ai/run — NICHT der Gateway-Endpunkt ═══
// Wie beim Coach nutzen wir den DIREKTEN Workers-AI-Endpunkt
//     .../ai/run/{MODELL}   (Modell im Pfad, nur Account-ID + Token)
// statt /ai/v1/chat/completions (AI-Gateway, verlangt cf-aig-gateway-id-Header +
// eingerichtetes Gateway — fehlte der Header, scheiterte JEDER Bild-Aufruf still).
// Llama 4 Scout ist nativ multimodal und liest das image_url im messages-Format.
// Antwortform bei /ai/run: {result:{response:"..."}} statt {choices:[...]}.
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// ═══ ANBIETER-KONFIGURATION ═══════════════════════════════
// Zwei Wege, den Anbieter zu setzen — kein Code-Deploy nötig, nur Secrets:
//
// (A) CLOUDFLARE WORKERS AI  ← Standard, empfohlen (gratis, dein Account)
//     Nur diese zwei Secrets setzen:
//       CF_ACCOUNT_ID = <deine Cloudflare Account-ID>
//       CF_API_TOKEN  = <Workers-AI-Token, Template "Workers AI">
//     Modell optional (Default = Llama 4 Scout, nativ multimodal + multilingual):
//       CF_VISION_MODELL = @cf/meta/llama-4-scout-17b-16e-instruct
//
//   Alternative CF-Modelle (falls Scout mal nicht passt):
//     @cf/meta/llama-3.2-11b-vision-instruct
//        ⚠ EINMALIG nötig: Meta-Lizenz akzeptieren — ein Request an
//        .../ai/run/@cf/meta/llama-3.2-11b-vision-instruct mit {"prompt":"agree"}
//        senden (siehe cloudflare-vision-setup.md), sonst kommt nur Fehler.
//     @cf/moondream/moondream3.1-9B-A2B  (schlank, OCR-fokussiert)
//
// (B) FREMD-ANBIETER (Gemini / OpenAI / Claude) — nur falls bewusst gewünscht.
//     Wird NUR benutzt, wenn VISION_URL gesetzt ist (dann hat CF Vorrang NICHT):
//       VISION_URL     = https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
//       VISION_MODELL  = gemini-2.5-flash
//       VISION_API_KEY = <key>
//     (OpenAI: VISION_URL=https://api.openai.com/v1/chat/completions, VISION_MODELL=gpt-4o-mini)
//
// Kosten Cloudflare: 10.000 Neurons/Tag dauerhaft gratis. Ein Etikett-Scan
// verbraucht je nach Bildgröße einige hundert–tausend Neurons.
// ═══════════════════════════════════════════════════════════

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID") || "";
const CF_API_TOKEN  = Deno.env.get("CF_API_TOKEN")  || "";
const CF_VISION_MODELL = Deno.env.get("CF_VISION_MODELL") || "@cf/meta/llama-4-scout-17b-16e-instruct";
// Fallback-Vision-Modell: greift, wenn das Hauptmodell im Regal-Modus nichts
// zurückgibt (z.B. weil Llama 4 Scout für in der EU ansässige Entwickler keine
// Multimodal-Lizenz hat und Bildanfragen leer/gedrosselt beantwortet).
// Mistral Small 3.1 ist Vision-fähig und hat diese EU-Multimodal-Sperre nicht.
const CF_VISION_MODELL_FALLBACK = Deno.env.get("CF_VISION_MODELL_FALLBACK") || "@cf/mistralai/mistral-small-3.1-24b-instruct";

// Fremd-Anbieter-Overrides (nur aktiv, wenn VISION_URL gesetzt ist)
const FREMD_URL    = Deno.env.get("VISION_URL") || "";
const FREMD_KEY    = Deno.env.get("VISION_API_KEY") || Deno.env.get("GEMINI_API_KEY") || "";
const FREMD_MODELL = Deno.env.get("VISION_MODELL") || "gemini-2.5-flash";

// Nativer Workers-AI-Basispfad (Modell wird pro Aufruf angehängt).
const CF_RUN_BASIS = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run`;

// Aktiven Anbieter bestimmen: Fremd-URL hat Vorrang NUR wenn explizit gesetzt,
// sonst Cloudflare (Standard).
// Bei Cloudflare ist `url` der Basispfad OHNE Modell — frageVisionModell hängt
// das jeweilige Modell an (Haupt- oder Fallback-Modell).
function anbieter(): { url: string; key: string; modell: string; name: string } | null {
  if (FREMD_URL) {
    if (!FREMD_KEY) return null;
    return { url: FREMD_URL, key: FREMD_KEY, modell: FREMD_MODELL, name: "fremd" };
  }
  if (CF_ACCOUNT_ID && CF_API_TOKEN) {
    return {
      url: CF_RUN_BASIS,   // Basispfad; Modell hängt frageVisionModell an
      key: CF_API_TOKEN,
      modell: CF_VISION_MODELL,
      name: "cloudflare",
    };
  }
  return null; // gar nichts konfiguriert
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Der System-Prompt macht aus dem VLM einen präzisen Etikett-Leser.
// WICHTIG: Es soll NUR lesen und strukturieren, NICHT bewerten oder erfinden —
// die Bewertung macht clevias eigene Logik mit den geprüften Grundsätzen.
const SYSTEM_PROMPT = `Du bist ein präziser Etikett-Leser für eine Inhaltsstoff-Scanner-App.
Du bekommst ein Foto von einer Produktverpackung (Kosmetik, Lebensmittel, Reiniger o.Ä.).

DEINE AUFGABE:
1. Finde die Inhaltsstoff-/Zutatenliste (oft mit "Ingredients", "Zutaten", "INCI" überschrieben).
2. Lies ALLE Inhaltsstoffe exakt ab — auch klein gedruckte, gekrümmte oder teils verdeckte.
3. Korrigiere offensichtliche Lesefehler anhand deines Wissens über echte Inhaltsstoffnamen
   (z.B. wenn du "Cetary Alcohl" siehst, ist "Cetearyl Alcohol" gemeint).
4. Ignoriere Werbetext, Mengenangaben, Anwendungshinweise, Preise, Barcodes.

ANTWORTE AUSSCHLIESSLICH ALS JSON, ohne Markdown, ohne Erklärung:
{
  "produkt": "<Produktname falls erkennbar, sonst leer>",
  "typ": "<kosmetik | lebensmittel | reiniger | supplement | textil | unbekannt>",
  "zutaten": ["Stoff 1", "Stoff 2", ...],
  "bio": <true wenn ein Bio-/Öko-Siegel sichtbar ist, sonst false>,
  "sicherheit": "<hoch | mittel | niedrig — wie sicher du die Liste vollständig gelesen hast>"
}

Wenn du KEINE Zutatenliste findest, gib zutaten als leeres Array zurück und setze sicherheit auf "niedrig".
Erfinde NIEMALS Inhaltsstoffe, die du nicht siehst.`;

// Regal-Modus: mehrere Produkte auf einem Foto erkennen (Badezimmer, Kühlschrank, Regal).
// Hier werden NICHT die Zutaten gelesen (zu klein/abgewandt), sondern die Produkte
// selbst identifiziert – Marke + Produktname von der Vorderseite. Die Bewertung
// erfolgt danach über clevias Produkt-/Markenwissen.
const REGAL_PROMPT = `Du bist ein präziser Produkt-Erkenner für eine Low-Tox-Scanner-App.
Du bekommst ein Foto, auf dem MEHRERE Produkte zu sehen sind (z.B. ein Badezimmerregal, ein Kühlschrank, ein Schrank oder mehrere Produkte nebeneinander).

DEINE AUFGABE:
1. Erkenne JEDES einzelne Produkt im Bild.
2. Lies für jedes Produkt Marke und Produktname von der Vorderseite ab (auch teils verdeckt, gekrümmt, seitlich).
3. Bestimme grob die Kategorie (Kosmetik, Lebensmittel, Reiniger, Supplement).
4. Ignoriere Deko, Hintergrund, nicht identifizierbare Objekte.

ANTWORTE AUSSCHLIESSLICH ALS JSON, ohne Markdown, ohne Erklärung:
{
  "produkte": [
    {"marke": "<Marke>", "name": "<Produktname>", "typ": "<kosmetik|lebensmittel|reiniger|supplement|unbekannt>", "position": "<kurze Ortsangabe im Bild, z.B. 'links oben'>"},
    ...
  ],
  "anzahl": <Anzahl erkannter Produkte>
}

Erkenne so viele Produkte wie möglich, aber erfinde KEINE, die nicht klar erkennbar sind. Wenn ein Produkt nicht identifizierbar ist, lass es weg.`;

// Ein einzelner Vision-Aufruf gegen EIN bestimmtes Modell.
// Gibt { ergebnis, status, netzFehler, rohText } zurück.
// ergebnis ist bereits geparst und robust (produkte/zutaten sind garantiert Arrays).
//
// basisUrl:
//   • Cloudflare → Basispfad .../ai/run  (Modell wird hier angehängt, KEIN model-Feld im Body)
//   • Fremd      → volle OpenAI-URL .../chat/completions  (model-Feld im Body nötig)
async function frageVisionModell(
  basisUrl: string, key: string, modell: string, istCloudflare: boolean,
  sysPrompt: string, userText: string, imageUrl: string, istRegal: boolean,
): Promise<{ ergebnis: any; status: number; netzFehler: boolean; limit: boolean }> {
  // Ziel-URL + Body je Anbieter zusammenbauen.
  const url = istCloudflare ? `${basisUrl}/${modell}` : basisUrl;
  const messages = [
    { role: "system", content: sysPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ];
  // Cloudflare /ai/run: Modell steht im Pfad → kein model-Feld im Body.
  // Fremd/OpenAI: model-Feld im Body erforderlich.
  const body: any = istCloudflare
    ? { messages, max_tokens: istRegal ? 2000 : 1500, temperature: 0.1 }
    : { model: modell, messages, max_tokens: istRegal ? 2000 : 1500, temperature: 0.1 };

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error(`Vision-Netzfehler (${modell}):`, String(e).slice(0, 200));
    return { ergebnis: null, status: 0, netzFehler: true, limit: false };
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Vision-API Fehler (${modell}):`, resp.status, errText.slice(0, 300));
    return { ergebnis: null, status: resp.status, netzFehler: true, limit: resp.status === 429 };
  }

  const data = await resp.json();
  // Cloudflare /ai/run → {result:{response}}; OpenAI-kompatibel → {choices:[{message:{content}}]}.
  let inhalt: any = data.result?.response ?? data.choices?.[0]?.message?.content ?? "";
  if (Array.isArray(inhalt)) {
    inhalt = inhalt.map((t: any) => (typeof t === "string" ? t : t?.text || "")).join("");
  }
  inhalt = String(inhalt).replace(/```json/gi, "").replace(/```/g, "").trim();

  let ergebnis: any;
  try {
    ergebnis = JSON.parse(inhalt);
  } catch {
    const m = inhalt.match(/\{[\s\S]*\}/);
    try { ergebnis = m ? JSON.parse(m[0]) : null; } catch { ergebnis = null; }
  }
  if (!ergebnis || typeof ergebnis !== "object") {
    ergebnis = istRegal ? { produkte: [], roh: inhalt } : { zutaten: [], sicherheit: "niedrig", roh: inhalt };
  }
  if (istRegal) {
    if (!Array.isArray(ergebnis.produkte)) ergebnis.produkte = [];
    ergebnis.anzahl = ergebnis.produkte.length;
  } else {
    if (!Array.isArray(ergebnis.zutaten)) ergebnis.zutaten = [];
  }
  return { ergebnis, status: resp.status, netzFehler: false, limit: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const prov = anbieter();
  if (!prov) {
    console.error("Vision: kein Anbieter konfiguriert (CF_ACCOUNT_ID/CF_API_TOKEN oder VISION_URL+KEY fehlen).");
    return new Response(JSON.stringify({ fehler: "kein_anbieter", limit: false }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { bild, modus } = await req.json();
    if (!bild || typeof bild !== "string") {
      return new Response(JSON.stringify({ fehler: "Kein Bild übermittelt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // bild = data-URL ("data:image/jpeg;base64,....") oder reines Base64
    const imageUrl = bild.startsWith("data:") ? bild : `data:image/jpeg;base64,${bild}`;

    // Regal-Modus: mehrere Produkte erkennen. Standard: ein Etikett lesen.
    const istRegal = modus === "regal";
    const sysPrompt = istRegal ? REGAL_PROMPT : SYSTEM_PROMPT;
    const userText = istRegal
      ? "Erkenne alle Produkte auf diesem Foto und gib sie als JSON zurück."
      : "Lies die Inhaltsstoffe von diesem Etikett und gib sie als JSON zurück.";

    const istCloudflare = prov.name === "cloudflare";

    // 1. Versuch mit dem Hauptmodell.
    let versuch = await frageVisionModell(
      prov.url, prov.key, prov.modell, istCloudflare, sysPrompt, userText, imageUrl, istRegal,
    );

    // 2. Fallback-Kaskade NUR im Regal-Modus und nur bei Cloudflare:
    //    Wenn das Hauptmodell (Llama 4 Scout) leer/gedrosselt antwortet — etwa
    //    weil es für in der EU ansässige Entwickler keine Multimodal-Lizenz hat —
    //    probieren wir dasselbe Bild mit einem zweiten, EU-tauglichen Vision-Modell.
    // Prüft, ob das Ergebnis LEER ist — je nach Scan-Art anderes Feld:
    // Regal-Scan liefert {produkte:[...]}, Zutaten-Scan liefert {zutaten:[...]}.
    const istErgebnisLeer = (erg: any): boolean => {
      if (!erg) return true;
      const liste = istRegal ? (erg.produkte || []) : (erg.zutaten || []);
      return liste.length === 0;
    };

    // Fallback jetzt für BEIDE Scan-Arten (vorher nur Regal — Bug):
    // Wenn das Hauptmodell nichts/leeres liefert oder ein Netzfehler auftrat,
    // das EU-sichere, vision-fähige Fallback-Modell (Mistral) versuchen.
    const brauchtFallback =
      prov.name === "cloudflare" &&
      CF_VISION_MODELL_FALLBACK &&
      CF_VISION_MODELL_FALLBACK !== prov.modell &&
      (versuch.netzFehler || istErgebnisLeer(versuch.ergebnis));

    if (brauchtFallback) {
      console.log(`${istRegal ? "Regal" : "Zutaten"}-Scan: Hauptmodell ${prov.modell} lieferte nichts — Fallback auf ${CF_VISION_MODELL_FALLBACK}`);
      const fb = await frageVisionModell(
        prov.url, prov.key, CF_VISION_MODELL_FALLBACK, istCloudflare, sysPrompt, userText, imageUrl, istRegal,
      );
      // Fallback übernehmen, wenn er ein nicht-leeres Ergebnis liefert …
      if (fb.ergebnis && !istErgebnisLeer(fb.ergebnis)) {
        versuch = fb;
      } else if (!versuch.ergebnis && fb.ergebnis) {
        versuch = fb; // … oder wenigstens ein sauberes (leeres) Ergebnis statt Netzfehler
      }
    }

    // Echter Netz-/Limit-Fehler ohne verwertbares Ergebnis → sauberer Fehlerstatus,
    // damit die App zwischen "nicht erreichbar" und "nichts erkannt" unterscheiden kann.
    if (versuch.netzFehler && !versuch.ergebnis) {
      return new Response(JSON.stringify({
        fehler: versuch.limit ? "Tageslimit erreicht" : "Vision-Dienst nicht erreichbar",
        limit: versuch.limit,
        status: versuch.status,
      }), {
        status: versuch.limit ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ergebnis = versuch.ergebnis || (istRegal ? { produkte: [], anzahl: 0 } : { zutaten: [], sicherheit: "niedrig" });

    return new Response(JSON.stringify(ergebnis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Vision-Function Fehler:", e);
    return new Response(JSON.stringify({ fehler: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
