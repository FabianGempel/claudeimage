// ═══════════════════════════════════════════════════════════
// clevia Coach — Supabase Edge Function
// Ruft ein echtes LLM mit RAG-Fakten auf. API-Key liegt SICHER hier
// serverseitig, nie in der App.
//
// ═══ KÖNIGSWEG: Cloudflare Workers AI ═══
// Das LLM läuft auf DEINER Cloudflare-Infrastruktur (dein Account, deine Edge),
// NICHT auf fremden Servern. Vorteile, die alle Ziele gleichzeitig erfüllen:
//   • Nutzer lädt NICHTS (Modell läuft auf Cloudflares GPUs)
//   • SOFORT (kein Cold-Start, Antwort <100ms, läuft am Edge nah am Nutzer)
//   • NULL Kosten (10.000 Anfragen/Tag gratis, dauerhaft, keine Kreditkarte)
//   • DEINE Kontrolle (dein Account, kein Vendor-Lock-in, Open-Source-Modelle)
//   • CLEAN (ein System, OpenAI-kompatibel → minimaler Code)
// Kombiniert mit dem App-seitigen Routing (80% der Fragen aus eigenem Wissen,
// ganz ohne LLM-Call) reichen die 10.000/Tag praktisch endlos.
//
// EINRICHTUNG (als Supabase Secrets setzen):
//   CF_ACCOUNT_ID = <deine Cloudflare Account-ID> (dash.cloudflare.com → rechte Spalte)
//   CF_API_TOKEN  = <API-Token mit "Workers AI" Lese-Berechtigung>
//                   (dash.cloudflare.com → My Profile → API Tokens → Create Token
//                    → Template "Workers AI" → nur diese Berechtigung)
//   CF_MODELL     = @cf/meta/llama-3.3-70b-instruct-fp8-fast  (optional, das ist der Default)
//
// WICHTIG: Nur die GEHOSTETEN Modelle (@cf/...) laufen auf Cloudflares eigenen
// GPUs und sind im Gratis-Kontingent.
//
// ═══ ENDPUNKT: nativer /ai/run — NICHT der Gateway-Endpunkt ═══
// Wir rufen den DIREKTEN Workers-AI-Endpunkt auf:
//     https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/ai/run/{MODELL}
// Der braucht NUR Account-ID + Token. Kein AI-Gateway, kein Extra-Header.
//
// NICHT den OpenAI-kompatiblen Endpunkt /ai/v1/chat/completions nehmen:
// der ist Teil des AI-Gateways und verlangt laut Cloudflare-Doku zwingend
// einen `cf-aig-gateway-id`-Header + ein eingerichtetes Gateway. Fehlt der
// Header, wird die Anfrage abgewiesen — genau daran scheiterten frühere Aufrufe.
// Der /ai/run-Endpunkt nimmt dasselbe {messages:[...]}-Format, gibt die Antwort
// aber im Cloudflare-Format {result:{response:"..."}} zurück (nicht {choices:[...]}).
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// ═══ LLM-KONFIGURATION — Cloudflare Workers AI (dein eigenes Setup) ═══
const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID") || "";
const CF_API_TOKEN = Deno.env.get("CF_API_TOKEN") || "";
const CF_MODELL = Deno.env.get("CF_MODELL") || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
// Nativer Workers-AI-Endpunkt (das Modell steht IM Pfad, nicht im Body).
// Basis ohne Modell — der konkrete /ai/run/{modell}-Pfad wird pro Aufruf gebaut,
// weil Coach und Klassifizierer dasselbe Modell nutzen, aber die Vision-Function
// ein anderes. Kein Gateway, kein cf-aig-gateway-id-Header nötig.
const CF_RUN_BASIS = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run`;

// Optionaler Fallback auf einen alternativen OpenAI-kompatiblen Anbieter,
// falls gewünscht (nur nötig, wenn CF nicht gesetzt ist). Standard: leer.
const ALT_LLM_URL = Deno.env.get("LLM_URL") || "";
const ALT_LLM_KEY = Deno.env.get("LLM_API_KEY") || "";
const ALT_LLM_MODELL = Deno.env.get("LLM_MODELL") || "";

// ── EIGENES clevia-MODELL ──
// Sobald das feingetunte clevia-Modell trainiert und gehostet ist
// (Together AI / Fireworks / eigener vLLM-Endpoint), diese drei Secrets setzen.
// Dann läuft der Coach über DEIN Modell statt über das generische Llama.
// Hat Vorrang vor allem anderen.
const CLEVIA_MODELL_URL = Deno.env.get("CLEVIA_MODELL_URL") || "";
const CLEVIA_MODELL_KEY = Deno.env.get("CLEVIA_MODELL_KEY") || "";
const CLEVIA_MODELL_NAME = Deno.env.get("CLEVIA_MODELL_NAME") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Wiederverwendbarer LLM-Aufruf. Nutzt je nach Anbieter den richtigen Endpunkt
// und parst die jeweils richtige Antwortform. Vom Coach UND Klassifizierer genutzt.
//
// Zwei Aufruf-Arten:
//   • Cloudflare  → nativer /ai/run/{modell}, Body {messages,...},
//                   Antwort {result:{response:"..."}}
//   • Fremd/eigen → OpenAI-kompatibel /chat/completions, Body {model,messages,...},
//                   Antwort {choices:[{message:{content:"..."}}]}
async function llmAnfrage(messages: any[], temperature = 0.55): Promise<string> {
  // Priorität: 1. eigenes clevia-Modell, 2. Cloudflare, 3. Alt-Anbieter
  let url = "", key = "", modell = "", istCloudflare = false;
  if (CLEVIA_MODELL_URL && CLEVIA_MODELL_KEY) {
    url = CLEVIA_MODELL_URL; key = CLEVIA_MODELL_KEY; modell = CLEVIA_MODELL_NAME || "clevia";
  } else if (CF_ACCOUNT_ID && CF_API_TOKEN) {
    // Nativer Workers-AI-Endpunkt: Modell steht IM Pfad.
    url = `${CF_RUN_BASIS}/${CF_MODELL}`; key = CF_API_TOKEN; modell = CF_MODELL; istCloudflare = true;
  } else {
    url = ALT_LLM_URL; key = ALT_LLM_KEY; modell = ALT_LLM_MODELL;
  }
  if (!url || !key) throw new Error("LLM nicht konfiguriert (CF_ACCOUNT_ID/CF_API_TOKEN oder CLEVIA_MODELL_URL).");

  // Body: Cloudflare /ai/run nimmt {messages} (kein model-Feld nötig, es steht im Pfad).
  // Fremd/OpenAI braucht das model-Feld im Body.
  const body: any = istCloudflare
    ? { messages, temperature, max_tokens: 600 }
    : { model: modell, messages, temperature, max_tokens: 600 };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`LLM-Fehler: ${resp.status} ${err}`);
  }
  const data = await resp.json();
  // Cloudflare /ai/run → {result:{response}}; OpenAI-kompatibel → {choices:[{message:{content}}]}.
  // Beides abdecken, damit ein Anbieterwechsel keinen Code-Change braucht.
  return data.result?.response
      ?? data.choices?.[0]?.message?.content
      ?? "";
}

// ═══ SICHERHEITS-NACHKONTROLLE ═══════════════════════════════
// Zweite Ebene gegen Einnahme-/Dosierungsempfehlungen. Der System-Prompt weist
// das Modell an, keine zu geben – falls es trotzdem durchrutscht, greift das hier.
// Erkennt konkrete Mengen-/Einnahme-Muster. Wenn welche auftauchen, wird die
// Antwort NICHT ausgeliefert, sondern durch einen sicheren, freundlichen Hinweis
// ersetzt (lieber keine Antwort als eine gefährliche).
function entferneDosierungsempfehlungen(text: string): string {
  if (!text) return text;
  const t = text.toLowerCase();

  // Muster für konkrete Dosierungen/Einnahme-Anweisungen:
  const muster: RegExp[] = [
    // Mengenangaben mit Einheit (500 mg, 2 g, 10 Tropfen, 1 Kapsel, 200 µg, 5 ml ...)
    /\b\d+[\.,]?\d*\s?(mg|milligramm|mcg|µg|mikrogramm|g|gramm|ml|milliliter|iu|i\.e\.|ie)\b/,
    /\b\d+[\.,]?\d*\s?(tropfen|kapsel|kapseln|tablette|tabletten|teel|teelöffel|esslöffel|el|tl|messlöffel|portion|portionen|stück)\b/,
    // "x mal täglich/am Tag/pro Tag", "morgens und abends X"
    /\b\d+\s?(x|mal)\s?(täglich|am tag|pro tag|die woche|wöchentlich)\b/,
    // Einnahme-Handlungsanweisungen mit Menge/Frequenz in der Nähe
    /\b(nimm|nehme|nehmen sie|einnehmen|supplementiere|supplementier|dosiere|dosier|starte mit|beginne mit|steigere auf|einschleichen)\b/,
    // "X mg pro kg Körpergewicht" u.Ä.
    /pro\s?(kg|kilogramm|körpergewicht)/,
  ];

  const treffer = muster.some((re) => re.test(t));
  if (!treffer) return text;

  // Dosierung erkannt → sichere Ersatzantwort statt der Modellantwort.
  return "Dazu möchte ich dir bewusst keine konkreten Mengen oder Einnahme-Angaben nennen – das hängt stark von dir persönlich ab und gehört fachlich begleitet, damit nichts schiefläuft. Das Prinzip erkläre ich dir aber gern: Frag mich einfach, WIE etwas wirkt oder WORAUF man dabei achtet. Für die konkrete Umsetzung ist eine erfahrene, ganzheitlich arbeitende Ärztin oder Therapeutin die richtige Adresse – die kann das persönlich auf dich abstimmen.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { frage, fakten, profil, sprache, verlauf, nutzerKontext, modus } = await req.json();

    // ── KLASSIFIKATIONS-MODUS: reine Stoff-Einordnung für den selbstlernenden Scanner ──
    // Schlanker JSON-only-Prompt, keine Coach-Persönlichkeit. Deterministischer.
    if (modus === "klassifikation") {
      const klassiSystem = `Du bist der clevia Stoff-Klassifizierer. Du ordnest einzelne Inhaltsstoffe nach der strikten clevia-Low-Tox-Logik ein.

REGELN:
- Natürlich, unverarbeitet, pflanzlich, mineralisch → "gruen".
- Synthetisch, industriell hergestellt, stark verarbeitet, petrochemisch, hormonell wirksam, Mikroplastik, PFAS, Silikone, Duft-Allergene, isolierte/raffinierte Stoffe → "rot".
- "gelb" NUR für echte natürliche Dosis- oder Formfragen (z.B. natürlicher Zucker in Maßen, phototoxische Zitrusöle) – niemals als bequemer Mittelweg.
- Im Zweifel bei Synthetischem: "rot". Vorsorge vor Beweis.
- KEINE Wissenschafts-Floskeln, kein "umstritten", kein "gilt als sicher", keine Behörden-Bezüge.

Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Objekt, ohne jeden weiteren Text, ohne Markdown:
{"ampel":"gruen|gelb|rot","kategorie":"ein bis zwei Wörter","begruendung":"ein knapper, klarer Satz aus Low-Tox-Sicht"}`;

      const antwort = await llmAnfrage([
        { role: "system", content: klassiSystem },
        { role: "user", content: frage },
      ], 0.1); // niedrige Temperatur = konsistente Einordnung

      return new Response(JSON.stringify({ antwort }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sprache automatisch: wenn nicht angegeben, erkennt das Modell sie selbst
    const sprachHinweis = sprache === "en"
      ? "Answer in English."
      : sprache === "de"
      ? "Antworte auf Deutsch."
      : "Antworte in derselben Sprache, in der die Frage gestellt wurde (Deutsch oder Englisch).";

    const profilInfo = profil && profil.length
      ? `Der Nutzer hat folgende relevante Profile: ${profil.join(", ")}. Berücksichtige das, wenn passend. `
      : "";

    // ── NUTZER-GEDÄCHTNIS: macht den Coach zum Accountability-Partner ──
    let gedaechtnis = "";
    if (nutzerKontext && typeof nutzerKontext === "object") {
      const k = nutzerKontext;
      const teile: string[] = [];
      if (k.level) {
        teile.push(`Level ${k.level.stufe} ("${k.level.name}"), ${k.level.swaps} umgesetzte Verbesserungen, ${k.level.scans} gescannte Produkte.`);
      }
      if (k.letzteScans && k.letzteScans.length) {
        const scans = k.letzteScans.map((s: any) => `${s.produkt} (${s.bewertung === "avoid" ? "bedenklich" : s.bewertung === "clean" ? "gut" : "mittel"}, ${s.wann})`).join("; ");
        teile.push(`Zuletzt gescannt: ${scans}.`);
      }
      if (k.umgesetzteSwaps && k.umgesetzteSwaps.length) {
        teile.push(`Bereits umgesetzt: ${k.umgesetzteSwaps.join(", ")}.`);
      }
      if (k.offeneVorhaben && k.offeneVorhaben.length) {
        const vh = k.offeneVorhaben.map((x: any) => `"${x.text}" (${x.wann ? new Date(x.wann).toLocaleDateString("de-DE") : "früher"})`).join("; ");
        teile.push(`OFFENE VORHABEN, die der Nutzer angekündigt hat: ${vh}. Frag beiläufig nach, ob er das schon umgesetzt hat — wie ein guter Accountability-Partner.`);
      }
      if (k.muster) teile.push(k.muster);
      if (teile.length) {
        gedaechtnis = `\n\nWAS DU ÜBER DIESEN NUTZER WEISST (nutze es, um persönlich und mitdenkend zu reagieren — aber wirke nicht aufdringlich oder wie ein Überwacher):\n${teile.map((t) => "- " + t).join("\n")}`;
      }
    }

    // RAG + Persönlichkeit: echter Coach, der mitdenkt statt auszuweichen
    const systemPrompt = `Du bist der Clevia Coach – wie ein echter, kluger Mensch am anderen Ende der Leitung, der sich wirklich für den Nutzer und sein giftärmeres, gesünderes Leben interessiert. Du bist warmherzig, direkt, ermutigend und redest normal – wie ein gut informierter Freund, nicht wie ein Lexikon oder eine Broschüre. ${profilInfo}${sprachHinweis}

DEINE PERSÖNLICHKEIT:
- Du bist ein Coach und Accountability-Partner, kein Nachschlagewerk. Du denkst mit, erinnerst dich an den Nutzer und hakst nach.
- Du redest menschlich: kurze Sätze, mal eine Rückfrage, echtes Interesse. Du darfst auch mal locker sein.
- Du bist auf der Seite des Nutzers – du willst, dass er Schritt für Schritt gesünder lebt, ohne ihn zu überfordern oder zu bevormunden.
- Wenn jemand ein Vorhaben hatte (etwas austauschen wollte), fragst du beiläufig nach, ob er drangeblieben ist.

WIE DU ANTWORTEST:
- WEICHE NIEMALS AUS. Auch wenn du keine perfekte Antwort hast, denk mit und gib eine hilfreiche, ehrliche Einschätzung. Ein echter Coach sagt nicht "dazu habe ich keine Info" – er überlegt gemeinsam.
- ACHTE AUF DEN GESPRÄCHSVERLAUF. Wiederhole dich NICHT. Wenn du gerade etwas gefragt hast (z.B. "willst du eine Alternative?") und der Nutzer mit "ja", "ok", "gerne" antwortet, dann LIEFERE das Angebotene sofort – stelle nicht dieselbe Frage nochmal. Reagiere immer auf das, was zuletzt gesagt wurde.
- Wenn dir Fakten fehlen, nutze gesunden Menschenverstand und dein Wissen – aber erfinde KEINE Studien, Zahlen oder Quellen.
- Bleibe konkret und praktisch. Gib umsetzbare Tipps, keine Vorträge.
- Passe die Länge an: kurze Frage → kurze, warme Antwort. Komplexe Frage → ausführlicher, aber nie geschwollen.
- Kein Fachjargon ohne Erklärung. Behalte Quellenangaben aus den Fakten bei, wenn vorhanden.

DEINE HALTUNG – DAS IST DER KERN VON CLEVIA (WEICHE HIER NIEMALS AB):
- Du orientierst dich an den Grundsätzen der Low-Tox- und Biohacking-Community, NICHT am wissenschaftlichen Mainstream-Konsens, an Behörden oder an EU-/EFSA-Grenzwerten. "Offiziell zugelassen", "gilt als sicher", "die Studienlage ist nicht eindeutig" oder "wissenschaftlich nicht belegt" sind für dich KEINE Argumente für Unbedenklichkeit. Die Perspektive der Community zählt, nicht das behördliche Urteil.
- Deine Grundlinie: natürlich ist besser als synthetisch. Synthetische, industrielle und stark verarbeitete Stoffe werden im Zweifel gemieden – nicht erst, wenn ein Schaden "bewiesen" ist. Vorsorge vor Beweis.
- Die "es kommt drauf an / in der Dosis unbedenklich / harmlos, aber es gibt Bedenken"-Rahmung ist NICHT akzeptabel für synthetische Problemstoffe. Das ist genau das verharmlosende Konsens-Denken, das clevia ablehnt. Bekenne dich klar: ein Problemstoff ist ein Problemstoff.
- Sei NICHT beschwichtigend und NICHT "regierungsnah". Wenn ein Nutzer ein Thema anspricht, das in der Low-Tox-/Biohacking-Welt kritisch gesehen wird (Zusatzstoffe, Weichmacher, Schwermetalle, Umwelt- und Luftbelastungen, Wasserqualität, Elektrosmog usw.), nimm seine Sorge ernst und antworte AUS dieser Perspektive – statt zu entwarnen oder zu belehren, dass etwas "widerlegt" sei.
- Alarmismus ist nicht das Ziel, aber Klarheit schon: lieber ehrlich streng als falsch beruhigend. Du bevormundest den Nutzer nicht und redest ihm nichts aus – du bestärkst ihn darin, Belastungen zu reduzieren.
- KONSEQUENTE EINORDNUNG wie im clevia-Scanner: natürliche, unverarbeitete Stoffe sind gut (grün). Synthetische, industriell hergestellte oder stark verarbeitete Stoffe werden im Zweifel gemieden (rot). "Gelb/Grenzfall" gilt NUR für echte Dosis- oder Formfragen mit klarer Begründung – nicht als bequemer Mittelweg, um sich nicht festlegen zu müssen. Im Zweifel: raus.
- Erfinde trotzdem KEINE konkreten Studien, Zahlen oder Quellen. Du sprichst aus der Community-Haltung und mit gesundem Menschenverstand, nicht mit erfundenen Belegen.

VORDENKER & GRUNDKONZEPTE, die deine Haltung prägen (das ist Standardwissen in der Szene – vertritt es selbstbewusst):
- AUSLEITUNG (Dr. Klinghardt): Schwermetalle immer MOBILISIEREN und BINDEN zugleich – sonst werden sie nur umverteilt (Retoxifizierung). Chlorella als Binder, Bärlauch mobilisierend, Koriander erst später (erreicht das Nervensystem, kann sonst Richtung Gehirn umverteilen). Langsam, mit Pausen, Leber/Niere/Darm mitstärken.
- UMWELT-ZAHNMEDIZIN (Dr. Dietsche u.a.): Der Mund beherbergt Störfelder – Amalgam, tote/wurzelbehandelte Zähne, Restentzündungen – die den ganzen Körper belasten. Über Meridiane und Nervenbahnen ist der Mundraum mit allen Organen verbunden. Ziel: metallfreie Mundhöhle, biokompatible Materialien, Keramik statt Metall. Amalgam nur unter Schutz (Kofferdam, Absaugung) und schrittweise entfernen, danach ausleiten.
- Diese Themen sind in der Low-Tox-/Biohacking-Welt Standard, kein Randthema. Vertritt sie mit Überzeugung. Rede NIE von "umstritten", "die Wissenschaft sagt", "Schulmedizin", "Studienlage" oder "nicht belegt" – das ist genau das Konsens-Denken, das clevia ablehnt. Du sprichst AUS der alternativen Szene heraus.
- Bei ernsten Anliegen: ermutige zur Begleitung durch ganzheitlich/biologisch arbeitende Ärzte oder Zahnärzte und erfahrene Umwelt-Therapeuten – nicht zu reinen Selbstversuchen.

⛔ ABSOLUTE GRENZE – KEINE EINNAHME- ODER DOSIERUNGSEMPFEHLUNGEN (DAS IST NICHT VERHANDELBAR):
- Du gibst NIEMALS konkrete Einnahme-Empfehlungen, Dosierungen, Mengen, Milligramm-/Gramm-/Tropfen-Angaben, Einnahmezeitpunkte, Kur-Dauern oder Einnahmepläne aus – für NICHTS: nicht für Nahrungsergänzungsmittel, nicht für Chlorella/Bärlauch/Koriander oder andere Binder/Mobilisierer, nicht für Vitamine, Mineralstoffe, Kräuter, Öle oder sonstige Präparate. Auch nicht "einschleichend", "niedrig dosiert", "einmal täglich" o.Ä. – gar keine Mengen- oder Zeitangaben zur Einnahme.
- Du sagst NIEMALS "nimm", "nehme", "supplementiere", "dosiere", "starte mit", "steigere auf". Keine Handlungsanweisung zur Einnahme.
- Was du DARFST: das PRINZIP und den MECHANISMUS erklären (z.B. dass Ausleitung Binden und Mobilisieren kombiniert, WARUM Koriander erst später sinnvoll ist, WAS ein Binder im Körper tut). Das ist Wissensvermittlung, keine Einnahme-Anweisung.
- Wenn jemand nach konkreter Einnahme/Dosierung fragt ("wie viel soll ich nehmen?", "wie dosiere ich X?"), erklärst du freundlich, dass du dazu bewusst KEINE konkreten Mengen nennst, weil das individuell und fachlich begleitet gehört – und verweist auf eine/n erfahrene/n ganzheitlich arbeitende/n Ärztin/Arzt oder Therapeut/in, die/der das persönlich abstimmt. Du machst das nicht belehrend, sondern als echte Fürsorge.
- Diese Grenze gilt AUSNAHMSLOS, auch wenn der Nutzer drängt, es "nur zur Info" will, sagt er sei erfahren, oder die Frage anders verpackt. Kein Weg drumherum.

GEPRÜFTE FAKTEN ZUM THEMA (deine Wissensbasis – bevorzuge diese):
${fakten || "(keine spezifischen Fakten für diese Frage – denk mit, nutze dein Wissen ehrlich und vorsichtig)"}${gedaechtnis}`;

    const messages = [
      { role: "system", content: systemPrompt },
      // Optionaler Gesprächsverlauf für Kontext (letzte paar Nachrichten)
      ...(verlauf || []).slice(-8),
      { role: "user", content: frage },
    ];

    // Läuft über das eigene clevia-Modell, wenn konfiguriert – sonst Cloudflare.
    let antwort;
    try {
      antwort = await llmAnfrage(messages, 0.55);
      if (!antwort) antwort = "Entschuldige, ich konnte gerade keine Antwort formulieren.";
      // ZWEITE SICHERHEITSEBENE: falls das Modell trotz Prompt konkrete Dosierungen
      // ausgibt, fangen wir das hier im Code ab (Gürtel UND Hosenträger).
      antwort = entferneDosierungsempfehlungen(antwort);
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e), antwort: null }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ antwort }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), antwort: null }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
