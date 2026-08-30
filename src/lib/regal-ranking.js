// ═══════════════════════════════════════════════════════════
// clevia Regal-Ranking
// ───────────────────────────────────────────────────────────
// Nimmt die vom Vision-Modell erkannten Produkte eines Regals und
// rankt sie nach der Low-Tox-Bewertung. Ergebnis: "Das grünste
// Produkt hier ist X" — eine Kaufentscheidung in einem Blick.
//
// Das ist das Alleinstellungsmerkmal: kein anderer Scanner sagt dir,
// WELCHES von zehn Produkten im Regal das beste ist. Er bewertet
// höchstens eins nach dem anderen.
//
// Die eigentliche Stoff-Bewertung kommt von AUSSEN rein (die echte
// KURIERT_DB-Logik der App), damit hier keine zweite, abweichende
// Bewertung entsteht. Diese Engine kümmert sich nur ums Aggregieren
// und Sortieren — die Ampel-Wahrheit bleibt an einer Stelle.
// ═══════════════════════════════════════════════════════════

// Ampel-Rang für Sortierung und Aggregation.
// Niedriger = besser (grün vor gelb vor rot vor unbekannt).
const AMPEL_RANG = { gruen: 0, gelb: 1, rot: 2, unbekannt: 3 };

// Aus den Einzel-Ampeln der Zutaten eines Produkts die GESAMT-Ampel bilden.
// Low-Tox-Logik: ein einziger roter Stoff macht das Produkt rot
// ("das schwächste Glied zählt") — das ist bewusst streng, passt zur
// clevia-Philosophie (nicht "im Schnitt ok", sondern "enthält Problematisches").
function produktAmpel(zutatenAmpeln) {
  if (!zutatenAmpeln || zutatenAmpeln.length === 0) return 'unbekannt';
  let hatRot = false, hatGelb = false, hatBewertet = false;
  for (const a of zutatenAmpeln) {
    if (a === 'rot') { hatRot = true; hatBewertet = true; }
    else if (a === 'gelb') { hatGelb = true; hatBewertet = true; }
    else if (a === 'gruen') { hatBewertet = true; }
  }
  if (!hatBewertet) return 'unbekannt';
  if (hatRot) return 'rot';
  if (hatGelb) return 'gelb';
  return 'gruen';
}

// Feinscore innerhalb einer Ampel (für Sortierung bei Gleichstand).
// Mehr rote Stoffe = schlechter; höherer Anteil grün = besser.
// Gibt 0..1, niedriger = besser, damit es zum AMPEL_RANG passt.
function feinScore(zutatenAmpeln) {
  if (!zutatenAmpeln || zutatenAmpeln.length === 0) return 0.5;
  let rot = 0, gelb = 0, gruen = 0;
  for (const a of zutatenAmpeln) {
    if (a === 'rot') rot++;
    else if (a === 'gelb') gelb++;
    else if (a === 'gruen') gruen++;
  }
  const bewertet = rot + gelb + gruen;
  if (bewertet === 0) return 0.5;
  // Gewichteter Problemanteil: rot zählt voll, gelb halb.
  return (rot + gelb * 0.5) / bewertet;
}

// ═══ HAUPT: Produkte ranken ══════════════════════════════════
// produkte:   Array vom Vision-Modell (je {marke,name,typ,position,zutaten,bio,lesbarkeit})
// bewerteFn:  Funktion (stoffName) => 'gruen'|'gelb'|'rot'|'unbekannt'
//             (die echte KURIERT_DB-Bewertung der App wird hier reingereicht)
//
// Gibt zurück: sortierte Liste (bestes zuerst) + Highlights (bestes/schlechtestes).
export function rankeRegal(produkte, bewerteFn) {
  const liste = (produkte || []).filter(p => p && (p.marke || p.name));
  if (liste.length === 0) return { ok: false, grund: 'keine_produkte' };

  const bewertet = liste.map((p, idx) => {
    const zutaten = Array.isArray(p.zutaten) ? p.zutaten : [];
    // Jede Zutat mit der echten Bewertungsfunktion einordnen.
    const ampeln = zutaten.map(z => {
      try { return bewerteFn ? bewerteFn(z) : 'unbekannt'; }
      catch { return 'unbekannt'; }
    });
    const ampel = produktAmpel(ampeln);
    const score = feinScore(ampeln);
    // Wie viele rote/gelbe/grüne Stoffe (für die Anzeige "3 bedenkliche Stoffe").
    const zaehler = { rot: 0, gelb: 0, gruen: 0, unbekannt: 0 };
    ampeln.forEach(a => { zaehler[a] = (zaehler[a] || 0) + 1; });

    return {
      marke: p.marke || '',
      name: p.name || '',
      typ: p.typ || 'unbekannt',
      position: p.position || null,
      bio: p.bio === true,
      lesbarkeit: p.lesbarkeit || 'niedrig',
      ampel,
      // Wenn keine Zutaten lesbar waren, ist die Bewertung vorläufig —
      // die App kann das Produkt dann über Marke+Name in ihrer DB nachschlagen.
      bewertungBasis: zutaten.length > 0 ? 'zutaten' : 'nur_identitaet',
      stoffZaehler: zaehler,
      anzahlZutaten: zutaten.length,
      _rang: AMPEL_RANG[ampel],
      _score: score,
      _originalIdx: idx,
    };
  });

  // Sortieren: erst nach Ampel (grün→rot→unbekannt), dann nach Feinscore,
  // dann Bio als Tiebreaker (Bio vor Nicht-Bio), dann Originalreihenfolge.
  bewertet.sort((a, b) => {
    if (a._rang !== b._rang) return a._rang - b._rang;
    if (a._score !== b._score) return a._score - b._score;
    if (a.bio !== b.bio) return a.bio ? -1 : 1;
    return a._originalIdx - b._originalIdx;
  });

  // Highlights: bestes und schlechtestes BEWERTETES Produkt (unbekannte ignorieren).
  const bewerteteProdukte = bewertet.filter(p => p.ampel !== 'unbekannt');
  const bestes = bewerteteProdukte[0] || null;
  const schlechtestes = bewerteteProdukte.length > 1
    ? bewerteteProdukte[bewerteteProdukte.length - 1]
    : null;

  // Aufräumen: interne Sortier-Felder aus der Ausgabe entfernen.
  const sauber = bewertet.map(({ _rang, _score, _originalIdx, ...rest }) => rest);

  return {
    ok: true,
    anzahl: sauber.length,
    produkte: sauber,
    bestes: bestes ? { marke: bestes.marke, name: bestes.name, ampel: bestes.ampel } : null,
    schlechtestes: schlechtestes ? { marke: schlechtestes.marke, name: schlechtestes.name, ampel: schlechtestes.ampel } : null,
    // Kurz-Empfehlung als fertiger Satz für die UI.
    empfehlung: bestes
      ? `Bester Fund: ${[bestes.marke, bestes.name].filter(Boolean).join(' ')}`
      : 'Keine eindeutige Bewertung möglich – Produkte einzeln scannen.',
  };
}

export const _intern = { produktAmpel, feinScore, AMPEL_RANG };
