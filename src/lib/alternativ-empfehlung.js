// ═══════════════════════════════════════════════════════════
// clevia Alternativ-Empfehlung
// ───────────────────────────────────────────────────────────
// Der entscheidende Vorsprung vor Yuka/CodeCheck: Die geben eine
// Ampel und lassen den Nutzer mit dem "schlecht" allein (→ Angst-
// Spirale, der meistgenannte Kritikpunkt). clevia macht daraus
// HANDLUNGSFÄHIGKEIT:
//
//   1. WAS genau ist am Produkt problematisch (welche Stoffe, warum)
//   2. WELCHE konkrete Alternative ist besser
//   3. WARUM die Alternative besser ist (nachvollziehbar, nicht "Vertrau uns")
//
// Das verwandelt "dein Produkt ist rot" in "nimm X statt Y, weil Z".
// Genau die Einordnung, die die Konkurrenz strukturell nicht bietet.
//
// Die Alternativen kommen aus dem eigenen Produktkatalog (wächst mit
// jedem Scan → proprietäres Asset). Die Bewertung nutzt die echte
// clevia-Kaskade (reingereicht), damit die Linie konsistent bleibt.
// ═══════════════════════════════════════════════════════════

const AMPEL_RANG = { gruen: 0, gelb: 1, rot: 2, unbekannt: 3 };

// Analysiert, WARUM ein Produkt die Bewertung bekam, die es hat.
// Gibt die problematischen Stoffe mit Begründung zurück — das ist
// die Basis für "was ist hier schlecht".
export function analysiereProblem(zutaten, bewerteFn) {
  const bewertet = (zutaten || []).map(z => {
    const r = bewerteFn ? bewerteFn(z) : { a: 'unbekannt' };
    // bewerteFn kann String ODER Objekt {a,grund} liefern — beides abfangen.
    const ampel = typeof r === 'string' ? r : (r && r.a) || 'unbekannt';
    const grund = typeof r === 'object' && r ? (r.grund || '') : '';
    return { stoff: z, ampel, grund };
  });

  const rote = bewertet.filter(b => b.ampel === 'rot');
  const gelbe = bewertet.filter(b => b.ampel === 'gelb');

  // Gesamt-Ampel: ein roter Stoff → rot (schwächstes Glied, clevia-Linie).
  let gesamt = 'gruen';
  if (rote.length > 0) gesamt = 'rot';
  else if (gelbe.length > 0) gesamt = 'gelb';
  else if (bewertet.every(b => b.ampel === 'unbekannt')) gesamt = 'unbekannt';

  return {
    gesamt,
    problematisch: rote.map(r => ({ stoff: r.stoff, grund: r.grund || 'Bedenklicher Stoff' })),
    grenzwertig: gelbe.map(g => ({ stoff: g.stoff, grund: g.grund || 'Grenzwertig' })),
    anzahlRot: rote.length,
    anzahlGelb: gelbe.length,
    anzahlGesamt: bewertet.length,
  };
}

// Erzeugt einen menschlichen Erklär-Text: WAS ist am Produkt schlecht.
// Kurz, klar, ohne Fachchinesisch-Overload (Gegenteil der Yuka-Angst).
export function erklaereProblem(analyse) {
  if (analyse.gesamt === 'gruen') {
    return 'Dieses Produkt ist nach der Low-Tox-Linie unbedenklich – keine problematischen Stoffe gefunden.';
  }
  if (analyse.gesamt === 'unbekannt') {
    return 'Die Inhaltsstoffe konnten nicht klar bewertet werden – am besten das Etikett erneut scannen.';
  }
  if (analyse.gesamt === 'rot') {
    const top = analyse.problematisch.slice(0, 3);
    const namen = top.map(t => t.stoff).join(', ');
    const anzahl = analyse.anzahlRot;
    let text = anzahl === 1
      ? `Ein Inhaltsstoff ist problematisch: ${namen}.`
      : `${anzahl} Inhaltsstoffe sind problematisch, u.a. ${namen}.`;
    // Erste konkrete Begründung dazugeben (Mechanismus, kein Behörden-Framing).
    if (top[0]?.grund) text += ` ${top[0].grund}.`;
    return text;
  }
  // gelb
  const namen = analyse.grenzwertig.slice(0, 2).map(g => g.stoff).join(', ');
  return `Grundsätzlich okay, aber grenzwertig: ${namen}. Wenn möglich, gibt es Sauberes.`;
}

// ═══ HAUPT: finde die beste Alternative ══════════════════════
// original:    das bewertete Produkt { produkt, typ, zutaten }
// katalog:     Array möglicher Alternativen (aus dem clevia-Produktkatalog),
//              je { produkt, marke, typ, zutaten, bio }
// bewerteFn:   die echte clevia-Bewertung (stoff) => 'gruen'|... oder {a,grund}
//
// Sucht im selben Produkttyp die grünste, sauberste Alternative und
// begründet, warum sie besser ist. Gibt null, wenn keine bessere existiert.
export function findeAlternative(original, katalog, bewerteFn) {
  const originalAnalyse = analysiereProblem(original.zutaten, bewerteFn);
  // Wenn das Original schon grün ist, braucht es keine Alternative.
  if (originalAnalyse.gesamt === 'gruen') {
    return { brauchtAlternative: false, originalAnalyse };
  }

  const typ = original.typ || 'unbekannt';
  // Kandidaten: gleicher Produkttyp, nicht das Original selbst.
  const kandidaten = (katalog || [])
    .filter(p => p && p.typ === typ)
    .filter(p => normProdukt(p.produkt) !== normProdukt(original.produkt))
    .map(p => {
      const analyse = analysiereProblem(p.zutaten, bewerteFn);
      return { ...p, analyse, _rang: AMPEL_RANG[analyse.gesamt], _rot: analyse.anzahlRot, _gelb: analyse.anzahlGelb };
    })
    // Nur Alternativen, die WIRKLICH besser sind als das Original.
    .filter(p => p._rang < AMPEL_RANG[originalAnalyse.gesamt]);

  if (kandidaten.length === 0) {
    return { brauchtAlternative: true, originalAnalyse, alternative: null,
             hinweis: 'Noch keine bessere Alternative im Katalog – wir suchen weiter.' };
  }

  // Beste wählen: grünste Ampel, dann wenigste rote/gelbe Stoffe, dann Bio.
  kandidaten.sort((a, b) => {
    if (a._rang !== b._rang) return a._rang - b._rang;
    if (a._rot !== b._rot) return a._rot - b._rot;
    if (a._gelb !== b._gelb) return a._gelb - b._gelb;
    if (!!a.bio !== !!b.bio) return a.bio ? -1 : 1;
    return 0;
  });
  const beste = kandidaten[0];

  return {
    brauchtAlternative: true,
    originalAnalyse,
    alternative: {
      produkt: beste.produkt,
      marke: beste.marke || '',
      ampel: beste.analyse.gesamt,
      bio: !!beste.bio,
    },
    // DER Mehrwert: begründen, warum die Alternative besser ist.
    begruendung: baueBegruendung(originalAnalyse, beste),
  };
}

// Erzeugt den Vergleichs-Satz: warum die Alternative besser ist.
function baueBegruendung(originalAnalyse, alternative) {
  const altAmpel = alternative.analyse.gesamt;
  const teile = [];

  if (altAmpel === 'gruen') {
    teile.push('Diese Alternative ist komplett sauber');
  } else if (altAmpel === 'gelb' && originalAnalyse.gesamt === 'rot') {
    teile.push('Diese Alternative hat keine problematischen Stoffe');
  }

  // Konkreter Vergleich der Problemstoffe.
  if (originalAnalyse.anzahlRot > 0 && alternative.analyse.anzahlRot === 0) {
    const wegfall = originalAnalyse.problematisch.slice(0, 2).map(p => p.stoff).join(' und ');
    teile.push(`ohne ${wegfall}`);
  }

  if (alternative.bio) teile.push('und trägt ein Bio-Siegel');

  const satz = teile.join(', ').replace(/\s+/g, ' ').replace(/,\s*([^,]*)$/, ', $1').trim();
  return satz ? satz.charAt(0).toUpperCase() + satz.slice(1) + '.' : 'Insgesamt die bessere Wahl nach der Low-Tox-Linie.';
}

// Produktnamen normalisieren für Vergleich (Original nicht als eigene Alternative).
function normProdukt(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9äöü]/g, '').trim();
}

export const _intern = { AMPEL_RANG, baueBegruendung, normProdukt };
