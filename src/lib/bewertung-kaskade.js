// ═══════════════════════════════════════════════════════════
// clevia Bewertungskaskade
// ───────────────────────────────────────────────────────────
// Garantiert: JEDER Inhaltsstoff bekommt eine Ampel. Nie "nicht
// vorhanden", nie grau. Die Kaskade probiert von präzise nach breit:
//
//   1. KURIERT_DB (exakt)      – kuratierte Stoffe, höchste Priorität
//   2. Synonym-Auflösung       – ein Stoff hat oft mehrere Namen
//   3. Muster-Bewertung        – chemische/botanische Muster
//   4. Fuzzy-Treffer           – ähnliche bekannte Stoffe (Tippfehler)
//   5. Struktur-Fallback       – letzte Instanz: nie grau, immer ein Urteil
//
// Der Struktur-Fallback ist der Schlüssel gegen "nicht vorhanden":
// Er analysiert die Wortstruktur (Endungen, Bausteine, Zeichen) und
// fällt IMMER eine Entscheidung – im Zweifel nach Low-Tox-Linie eher
// streng (unbekannt-synthetisch → rot, unbekannt-natürlich → grün).
// ═══════════════════════════════════════════════════════════

import { bewerteNachMuster } from './muster-bewertung.js';

// ─── Normalisierung (muss zu KURIERT_DB passen) ──────────────
// toLowerCase + Bindestrich→Leerzeichen + Whitespace kollabieren.
// Umlaute bleiben erhalten (bewusst, wie in KURIERT_DB).
export function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Synonyme: derselbe Stoff, verschiedene Namen ────────────
// INCI vs. Trivialname vs. deutsch. Wird VOR der Bewertung angewandt,
// damit "Wasser", "Water", "Aqua" alle als "aqua" bewertet werden.
const SYNONYME = {
  'water': 'aqua', 'wasser': 'aqua',
  'vitamin e': 'tocopherol', 'vitamin c': 'ascorbic acid',
  'provitamin b5': 'panthenol', 'vitamin b3': 'niacinamide',
  'vitamin b5': 'panthenol',
  'kochsalz': 'sodium chloride', 'salt': 'sodium chloride',
  'glycerine': 'glycerin', 'glycerol': 'glycerin',
  'shea butter': 'butyrospermum parkii butter',
  'sheabutter': 'butyrospermum parkii butter',
  'kokosöl': 'cocos nucifera oil', 'coconut oil': 'cocos nucifera oil',
  'olivenöl': 'olea europaea oil', 'olive oil': 'olea europaea oil',
  'zitronensäure': 'citric acid',
  'natron': 'sodium bicarbonate', 'baking soda': 'sodium bicarbonate',
  'fragrance': 'parfum', 'duftstoff': 'parfum', 'aroma': 'parfum',
  'alcohol denat': 'alcohol denat', 'denatured alcohol': 'alcohol denat',
  'hyaluronic acid': 'sodium hyaluronate', 'hyaluronsäure': 'sodium hyaluronate',
};

function loeseSynonym(key) {
  return SYNONYME[key] || key;
}

// ─── Levenshtein für Fuzzy-Treffer ───────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1), v1 = new Array(b.length + 1);
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

// ─── Struktur-Fallback: die Garantie gegen "nicht vorhanden" ──
// Fällt IMMER eine Entscheidung anhand der Wortstruktur.
// Nach Low-Tox-Linie: im Zweifel eher streng.
function strukturFallback(key) {
  // Natürliche Signale → grün-Tendenz
  const natuerlich = /extract|extrakt|\boil$|\böl|butter|wax|wachs|juice|saft|water$|flower|leaf|root|fruit|seed|bark|gum|clay|salz|salt|mineral|honey|honig|milk|milch|wachs/i;
  // Chemische/synthetische Signale → rot-Tendenz
  const synthetisch = /\d|sulf|phosph|acryl|silox|methyl|ethyl|propyl|butyl|amine$|amide$|chlor|fluor|brom|peg|ppg|eth-|polymer|glycol|paraben|phthal|benz/i;

  const hatNatur = natuerlich.test(key);
  const hatSynth = synthetisch.test(key);

  if (hatNatur && !hatSynth) {
    return { a: 'gruen', grund: 'Struktur deutet auf natürlichen Ursprung', kat: [], quelle: 'struktur' };
  }
  if (hatSynth && !hatNatur) {
    return { a: 'rot', grund: 'Struktur deutet auf synthetischen Stoff – meiden', kat: [], quelle: 'struktur' };
  }
  if (hatSynth && hatNatur) {
    // Beides: nach Low-Tox-Linie zählt das synthetische Signal stärker.
    return { a: 'rot', grund: 'Enthält synthetische Merkmale – meiden', kat: [], quelle: 'struktur' };
  }
  // Weder noch: neutral, aber NICHT "unbekannt" – ein kurzes Wort ohne
  // klare Signale ist meist ein einfacher, eher unbedenklicher Stoff.
  return { a: 'gelb', grund: 'Nicht eindeutig zuzuordnen – vorsichtshalber prüfen', kat: [], quelle: 'struktur' };
}

// ═══ HAUPT: bewerte einen Stoff (lückenlos) ══════════════════
// kuriertDb: Objekt { normKey: { d, i, a, k, g } } – die echte KURIERT_DB.
//            'a' ist die Ampel bzw. 'g' der Ampel-Code (je nach Schema).
//            Wird von außen reingereicht (bleibt an einer Stelle).
// Gibt IMMER { a: 'gruen'|'gelb'|'rot', grund, quelle } – nie null/grau.
export function bewerteStoffLueckenlos(stoff, kuriertDb) {
  const roh = normKey(stoff);
  if (!roh) return { a: 'gelb', grund: 'Leerer Eintrag', quelle: 'leer' };

  // Synonym auflösen (Wasser→aqua etc.)
  const key = loeseSynonym(roh);

  // 1. KURIERT_DB exakt
  if (kuriertDb) {
    const treffer = kuriertDb[key] || kuriertDb[roh];
    if (treffer) {
      // Ampel kann als 'a' (String) oder 'g' (Code 1/2/3) vorliegen.
      const ampel = normalisiereAmpel(treffer.a ?? treffer.g);
      return { a: ampel, grund: treffer.i || treffer.d || 'Kuratiert bewertet', quelle: 'kuriert' };
    }
  }

  // 2. Muster-Bewertung
  const muster = bewerteNachMuster(key);
  if (muster) return { a: muster.a, grund: muster.grund, kat: muster.kat, quelle: 'muster' };

  // 3. Fuzzy-Treffer in KURIERT_DB (Tippfehler-Toleranz)
  if (kuriertDb) {
    const fuzzy = fuzzyTreffer(key, kuriertDb);
    if (fuzzy) {
      const ampel = normalisiereAmpel(fuzzy.eintrag.a ?? fuzzy.eintrag.g);
      return { a: ampel, grund: (fuzzy.eintrag.i || 'Ähnlicher bekannter Stoff') + ' (ähnlich erkannt)', quelle: 'fuzzy' };
    }
  }

  // 4. Struktur-Fallback – IMMER ein Urteil, nie "nicht vorhanden"
  return strukturFallback(key);
}

// Fuzzy: nächster KURIERT_DB-Eintrag innerhalb kleiner Distanz.
function fuzzyTreffer(key, kuriertDb) {
  if (key.length < 5) return null;  // zu kurz für sinnvolle Fuzzy-Suche
  let bestKey = null, bestDist = Infinity;
  const toleranz = Math.min(3, Math.round(key.length * 0.2));
  for (const k in kuriertDb) {
    if (Math.abs(k.length - key.length) > toleranz) continue; // schneller Vorfilter
    const d = levenshtein(key, k);
    if (d < bestDist) { bestDist = d; bestKey = k; }
    if (d === 0) break;
  }
  if (bestKey && bestDist <= toleranz) return { key: bestKey, eintrag: kuriertDb[bestKey], distanz: bestDist };
  return null;
}

// Ampel-Wert vereinheitlichen: akzeptiert 'rot'/'gelb'/'gruen',
// Codes 1/2/3, oder englische Varianten.
function normalisiereAmpel(v) {
  if (v === 1 || v === '1' || v === 'gruen' || v === 'grün' || v === 'green') return 'gruen';
  if (v === 2 || v === '2' || v === 'gelb' || v === 'yellow') return 'gelb';
  if (v === 3 || v === '3' || v === 'rot' || v === 'red') return 'rot';
  // Unbekannter Wert → vorsichtshalber gelb (nie grau/nicht vorhanden)
  return 'gelb';
}

export const _intern = { normKey, loeseSynonym, strukturFallback, fuzzyTreffer, normalisiereAmpel, levenshtein };
