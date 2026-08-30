// ═══════════════════════════════════════════════════════════
// clevia Coach — STREAMING-Variante
// ───────────────────────────────────────────────────────────
// Wie coach/index.ts, aber gibt die Antwort als Server-Sent-Event-Stream
// zurück (stream:true an Cloudflare). Der Client zeigt die Wörter, sobald
// sie ankommen — der Coach fühlt sich sofort schnell an, statt mehrere
// Sekunden "tippt..." zu zeigen.
//
// Fällt bei jedem Problem auf den nicht-streamenden coach zurück (Client-Logik).
// ═══════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID") || "";
const CF_API_TOKEN  = Deno.env.get("CF_API_TOKEN")  || "";
const CF_MODELL     = Deno.env.get("CF_MODELL") || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CF_RUN_BASIS  = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run`;

// Baut den System-Prompt (gekürzt hier – identisch zur Nicht-Stream-Variante im Deploy).
function baueSystemPrompt(fakten: string, profil: string[], nutzerKontext: string): string {
  return [
    "Du bist der clevia Coach – ein Begleiter für einen bewussten, schadstoffarmen (Low-Tox) Lebensstil.",
    "Antworte kurz, konkret, umsetzbar und aus der Low-Tox-/Biohacking-Perspektive – nicht beschwichtigend, nicht behördennah.",
    fakten ? `\nGeprüftes clevia-Wissen zur Frage:\n${fakten}` : "",
    profil?.length ? `\nNutzerprofil: ${profil.join(", ")}` : "",
    nutzerKontext ? `\n${nutzerKontext}` : "",
    "\nGib KEINE konkreten Dosierungsempfehlungen für Nahrungsergänzung.",
  ].filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { frage, fakten = "", profil = [], verlauf = [], nutzerKontext = "" } = await req.json();
    if (!frage) throw new Error("Keine Frage");
    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) throw new Error("Cloudflare nicht konfiguriert");

    const messages = [
      { role: "system", content: baueSystemPrompt(fakten, profil, nutzerKontext) },
      ...(Array.isArray(verlauf) ? verlauf : []),
      { role: "user", content: frage },
    ];

    // Cloudflare mit stream:true → text/event-stream
    const cfResp = await fetch(`${CF_RUN_BASIS}/${CF_MODELL}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages, temperature: 0.55, max_tokens: 600, stream: true }),
    });

    if (!cfResp.ok || !cfResp.body) {
      const err = await cfResp.text().catch(() => "");
      throw new Error(`CF-Stream-Fehler: ${cfResp.status} ${err}`);
    }

    // Cloudflare-SSE direkt an den Client durchreichen, aber vereinheitlicht:
    // Wir extrahieren nur den Text und senden 'data: {"t":"..."}' Zeilen,
    // plus ein finales 'data: [DONE]'. Das hält den Client einfach.
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let puffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = cfResp.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            puffer += decoder.decode(value, { stream: true });
            // SSE-Zeilen verarbeiten
            const zeilen = puffer.split("\n");
            puffer = zeilen.pop() || ""; // letzte evtl. unvollständige Zeile behalten
            for (const zeile of zeilen) {
              const z = zeile.trim();
              if (!z.startsWith("data:")) continue;
              const nutz = z.slice(5).trim();
              if (nutz === "[DONE]") { controller.enqueue(encoder.encode("data: [DONE]\n\n")); continue; }
              try {
                const obj = JSON.parse(nutz);
                const t = obj.response ?? "";
                if (t) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t })}\n\n`));
              } catch { /* Teil-JSON ignorieren */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
