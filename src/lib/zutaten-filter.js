// ═══════════════════════════════════════════════════════════
// clevia Zutaten-Filter
// ───────────────────────────────────────────────────────────
// Zweite Verteidigungslinie gegen Nicht-Inhaltsstoffe in der Liste.
// Der Vision-Prompt weist das Modell an, nur echte Stoffe zu liefern —
// falls trotzdem Firmendaten, Mengenangaben, Adressen o.Ä. durchrutschen,
// filtert dieser Code sie hier raus, BEVOR bewertet wird.
//
// Prinzip: erkennen, was KEIN Inhaltsstoff sein kann (harte Ausschlüsse),
// und den Rest behalten. Lieber einen echten Randfall durchlassen als
// eine ganze Adresszeile fälschlich als "Stoff" bewerten.
// ═══════════════════════════════════════════════════════════

// Muster, die einen Eintrag als KEINEN Inhaltsstoff entlarven.
const KEIN_STOFF = [
  // Mengen-/Füllangaben: "50 ml", "200 g", "1 L", "3.4 fl oz", "e 50ml"
  /^\s*e?\s*\d+[.,]?\d*\s*(ml|g|kg|l|mg|fl\.?\s?oz|oz|stück|st|x)\b/i,
  // Reine Zahlen / Codes / Chargen: "123456", "L4028B", "LOT 2024"
  /^\s*(lot|charge|los|batch|ch\.?|ref)\b/i,
  /^\s*[\d\-\/]{4,}\s*$/,               // nur Ziffern/Striche (Barcode, Charge, Datum)
  // Haltbarkeit / PAO: "12M", "MHD 01/2026", "best before", "exp"
  /^\s*\d{1,2}\s?m\s*$/i,               // "12M" (Period after Opening)
  /\b(mhd|exp|best before|haltbar|verwendbar bis|use by)\b/i,
  // Herkunft / Herstellung
  /\b(made in|hergestellt|produced|manufactured|fabriqué|herkunft|origin|vertrieb|vertrieben|imported|importeur|distributed)\b/i,
  /\bin (deutschland|germany|österreich|austria|schweiz|switzerland|italy|italien|france|frankreich|eu)\b/i,
  // Firmen-Rechtsformen (Herstellername)
  /\b(gmbh|ag|kg|ohg|ug|e\.k\.|s\.a\.|s\.r\.l\.|ltd|llc|inc|co\.?\s?kg|& co)\b/i,
  // Adress-Bestandteile
  /\b(str\.|straße|strasse|street|platz|weg|allee|postfach|p\.?o\.?\s?box|d-\d{5}|\d{5}\s+[a-zäöü])/i,
  // Kontakt
  /(www\.|https?:\/\/|@|\.com|\.de|\.at|\.ch|tel\.?|fon|fax|hotline)/i,
  // Überschriften / Meta-Wörter der Liste selbst
  /^\s*(ingredients?|inhaltsstoffe|zutaten|inci|composition|ingrédients|zusammensetzung)\s*:?\s*$/i,
  // Werbe-/Hinweistext-Marker (ganze Sätze, kein Stoffname)
  /\b(dermatologisch|getestet|hautverträglich|ohne|frei von|vegan|tierversuch|nicht an tieren|anwendung|auftragen|vermeiden|augenkontakt|außerhalb|reichweite|kindern|bei berührung|warnhinweis|achtung|vorsicht)\b/i,
  // Symbole/Siegel-Text
  /\b(cosmos|natrue|ecocert|fairtrade|pao|recycling|grüner punkt|der blaue engel)\b/i,
];

// Zusätzliche Plausibilität: ein echter Inhaltsstoff ist meist kurz
// (1–5 Wörter), enthält keine Satzzeichen wie "!" oder "?" und ist kein
// ganzer Satz. Sehr lange Einträge (>8 Wörter) sind fast immer Fließtext.
function wirktWieStoff(eintrag) {
  const s = eintrag.trim();
  if (!s) return false;
  if (s.length < 2) return false;
  if (s.length > 80) return false;            // zu lang für einen Stoffnamen
  if (/[!?;]/.test(s)) return false;          // Satzzeichen → Fließtext
  const woerter = s.split(/\s+/);
  if (woerter.length > 8) return false;        // ganzer Satz, kein Stoff
  // Muss mindestens einen Buchstaben haben (nicht nur Zahlen/Zeichen)
  if (!/[a-zäöüàáâãäßç]/i.test(s)) return false;
  return true;
}

// Hauptfunktion: filtert eine rohe Zutatenliste.
// Gibt { zutaten:[bereinigt], entfernt:[was rausflog] } zurück
// (entfernt ist nützlich fürs Debugging/Transparenz).
export function filtereZutaten(rohListe) {
  if (!Array.isArray(rohListe)) return { zutaten: [], entfernt: [] };
  const zutaten = [];
  const entfernt = [];
  for (const eintrag of rohListe) {
    const s = String(eintrag || '').trim();
    if (!s) continue;
    // Führende Nummerierung/Aufzählungszeichen entfernen: "1. Aqua", "- Aqua", "• Aqua"
    const sauber = s.replace(/^[\s\-•*·]+/, '').replace(/^\d+[.)]\s*/, '').trim();
    if (!sauber) continue;

    const istKeinStoff = KEIN_STOFF.some(re => re.test(sauber));
    if (istKeinStoff || !wirktWieStoff(sauber)) {
      entfernt.push(sauber);
    } else {
      zutaten.push(sauber);
    }
  }
  return { zutaten, entfernt };
}

export const _intern = { KEIN_STOFF, wirktWieStoff };
