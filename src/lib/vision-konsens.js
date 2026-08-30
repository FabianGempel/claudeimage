// ═══════════════════════════════════════════════════════════
// Vision-Konsens-Engine
// ───────────────────────────────────────────────────────────
// Statt EINEM Modell-Aufruf ("frag einmal, hoff dass es stimmt")
// macht der Scanner MEHRERE unabhängige Durchläufe und bildet aus
// ihnen einen abgesicherten Konsens. Das eliminiert Lesefehler:
// wenn 3 von 3 Durchläufen "Cetearyl Alcohol" lesen, ist es sicher;
// liest einer "Cetary Alcohl", wird er von der Mehrheit korrigiert.
//
// Das ist der Kern-Unterschied zwischen "liest Etiketten" (einfach)
// und "versteht Etiketten zuverlässig" (Top-Level). Ein Scanner, der
// bei schlechten Fotos versagt, fühlt sich nie hochwertig an —
// Konsens macht ihn robust genau da, wo Nutzer sonst abspringen.
// ═══════════════════════════════════════════════════════════

// Normalisiert einen Stoffnamen für den Vergleich (nicht für die Anzeige).
// Kleinbuchstaben, Sonderzeichen weg, Mehrfach-Leerzeichen zu einem.
// So werden "Cetearyl Alcohol", "cetearyl  alcohol" und "Cetearyl-Alcohol"
// als derselbe Stoff erkannt.
function normStoff(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9äöü ]/g, ' ')   // Sonderzeichen → Leerzeichen
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein-Distanz: wie viele Zeichen-Änderungen trennen zwei Strings.
// Braucht man, um Lesefehler zu erkennen: "cetary alcohl" vs "cetearyl alcohol"
// sind nah beieinander (wenige Änderungen) → wahrscheinlich derselbe Stoff.
function levenshtein(a, b) {
  a = normStoff(a); b = normStoff(b);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

// Sind zwei Stoffnamen "derselbe Stoff"? Exakt gleich, Präfix (verkürzt
// gelesen) ODER nur durch wenige Zeichen getrennt (Lesefehler-Toleranz).
function gleicherStoff(a, b) {
  const na = normStoff(a), nb = normStoff(b);
  if (na === nb) return true;
  if (!na || !nb) return false;
  const maxLen = Math.max(na.length, nb.length);
  const minLen = Math.min(na.length, nb.length);
  // Kurze Namen (≤4 Zeichen) müssen EXAKT gleich sein.
  if (minLen <= 4) return false;
  // Präfix-Fall: der kürzere ist ein wortweiser Anfang des längeren.
  // "butyrospermum parkii" ⊂ "butyrospermum parkii butter" → derselbe Stoff,
  // nur einmal ohne das abschließende Wort gelesen. Nur greifen lassen, wenn
  // der gemeinsame Anfang substanziell ist (≥ halbe Länge des längeren).
  const kurz = na.length <= nb.length ? na : nb;
  const lang = na.length <= nb.length ? nb : na;
  if (lang.startsWith(kurz + ' ') && kurz.length >= lang.length * 0.5) return true;
  const dist = levenshtein(na, nb);
  // Toleranz skaliert mit Länge: ~25% dürfen abweichen, Deckel 5 Zeichen.
  const toleranz = Math.min(5, Math.max(1, Math.round(maxLen * 0.25)));
  return dist <= toleranz;
}

// Aus mehreren Schreibweisen desselben Stoffs die BESTE für die Anzeige wählen.
// Heuristik: die häufigste Schreibweise; bei Gleichstand die mit korrekter
// Groß-/Kleinschreibung (INCI-Namen sind Title Case: "Cetearyl Alcohol").
function besteSchreibweise(varianten) {
  const zaehler = new Map();
  for (const v of varianten) {
    const key = v.trim();
    zaehler.set(key, (zaehler.get(key) || 0) + 1);
  }
  let beste = varianten[0], maxAnzahl = 0;
  for (const [name, anzahl] of zaehler) {
    const titleCaseBonus = /^[A-ZÄÖÜ]/.test(name) ? 0.5 : 0;
    if (anzahl + titleCaseBonus > maxAnzahl) {
      maxAnzahl = anzahl + titleCaseBonus;
      beste = name;
    }
  }
  return beste;
}

// ═══ KERN: Konsens aus mehreren Durchläufen bilden ═══════════
// Bekommt ein Array von Einzel-Ergebnissen (je {zutaten:[...], produkt, typ, bio}).
// Gibt EIN abgesichertes Ergebnis zurück, plus Vertrauens-Info pro Stoff.
//
// Ein Stoff kommt in die finale Liste, wenn er in genug Durchläufen
// auftaucht (Mehrheit). Stoffe, die nur ein einziger Durchlauf "gesehen"
// hat, während andere Durchläufe sie nicht sahen, sind verdächtig
// (Halluzination oder Fehllesung) und werden markiert, nicht einfach übernommen.
export function bildeKonsens(ergebnisse) {
  const gueltige = (ergebnisse || []).filter(e => e && Array.isArray(e.zutaten));
  if (gueltige.length === 0) return { ok: false, grund: 'nicht_lesbar' };

  const anzahlDurchlaeufe = gueltige.length;
  // Schwelle: bei 1 Durchlauf reicht 1; bei 2 reichen beide-oder-1 (tolerant);
  // ab 3 Durchläufen verlangen wir Mehrheit (>50%).
  const mehrheit = anzahlDurchlaeufe >= 3
    ? Math.ceil(anzahlDurchlaeufe / 2)
    : 1;

  // Alle Stoff-Nennungen sammeln (mit Original-Schreibweise + aus welchem Durchlauf).
  const nennungen = [];
  gueltige.forEach((e, durchlaufIdx) => {
    e.zutaten.forEach(z => {
      if (z && String(z).trim()) nennungen.push({ name: String(z).trim(), durchlauf: durchlaufIdx });
    });
  });

  // Nennungen zu Stoff-Gruppen zusammenfassen (Lesefehler-tolerant).
  const gruppen = []; // je: { varianten:[], durchlaeufe:Set }
  for (const n of nennungen) {
    let gruppe = gruppen.find(g => g.varianten.some(v => gleicherStoff(v, n.name)));
    if (!gruppe) { gruppe = { varianten: [], durchlaeufe: new Set() }; gruppen.push(gruppe); }
    gruppe.varianten.push(n.name);
    gruppe.durchlaeufe.add(n.durchlauf);
  }

  // Jede Gruppe bewerten: in wie vielen Durchläufen kam sie vor?
  const sicher = [];       // in Konsens aufgenommen
  const unsicher = [];     // nur von Minderheit gesehen → markiert
  for (const g of gruppen) {
    const gesehenIn = g.durchlaeufe.size;
    const name = besteSchreibweise(g.varianten);
    const vertrauen = gesehenIn / anzahlDurchlaeufe; // 0..1
    if (gesehenIn >= mehrheit) {
      sicher.push({ name, vertrauen, gesehenIn, von: anzahlDurchlaeufe });
    } else {
      unsicher.push({ name, vertrauen, gesehenIn, von: anzahlDurchlaeufe });
    }
  }

  // Reihenfolge: sichere Stoffe zuerst, innerhalb nach Vertrauen absteigend,
  // dabei die ursprüngliche Reihenfolge der ersten Nennung grob erhalten.
  sicher.sort((a, b) => b.vertrauen - a.vertrauen);

  // Metadaten (produkt, typ, bio) per Mehrheit aus den Durchläufen.
  const produkt = mehrheitsWert(gueltige.map(e => e.produkt).filter(Boolean));
  const typ = mehrheitsWert(gueltige.map(e => e.typ).filter(Boolean)) || 'unbekannt';
  const bio = gueltige.filter(e => e.bio === true).length > anzahlDurchlaeufe / 2;

  // Gesamt-Vertrauen: Anteil der Stoffe, die von allen Durchläufen gesehen wurden.
  const einstimmig = sicher.filter(s => s.gesehenIn === anzahlDurchlaeufe).length;
  const gesamtVertrauen = sicher.length ? einstimmig / sicher.length : 0;
  const sicherheit = gesamtVertrauen >= 0.8 ? 'hoch' : gesamtVertrauen >= 0.5 ? 'mittel' : 'niedrig';

  return {
    ok: true,
    produkt: produkt || '',
    typ,
    bio,
    zutaten: sicher.map(s => s.name),
    // Zusatz-Info für die App (optional nutzbar für UI/Debugging):
    konsens: {
      durchlaeufe: anzahlDurchlaeufe,
      sicherheit,
      gesamtVertrauen: Math.round(gesamtVertrauen * 100) / 100,
      unsicher: unsicher.map(u => ({ name: u.name, nurGesehenIn: u.gesehenIn, von: u.von })),
      proStoff: sicher.map(s => ({ name: s.name, vertrauen: Math.round(s.vertrauen * 100) / 100 })),
    },
  };
}

// Häufigsten Wert aus einer Liste (für produkt/typ-Mehrheit).
function mehrheitsWert(werte) {
  if (!werte.length) return '';
  const z = new Map();
  for (const w of werte) {
    const k = String(w).trim().toLowerCase();
    z.set(k, (z.get(k) || 0) + 1);
  }
  let best = '', max = 0, bestOriginal = '';
  for (const w of werte) {
    const k = String(w).trim().toLowerCase();
    if (z.get(k) > max) { max = z.get(k); best = k; bestOriginal = String(w).trim(); }
  }
  return bestOriginal;
}

// Für Tests exportieren.
export const _intern = { normStoff, levenshtein, gleicherStoff, besteSchreibweise, mehrheitsWert };
