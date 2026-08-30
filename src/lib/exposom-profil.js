// ═══════════════════════════════════════════════════════════
// clevia Exposom-Profil — der Trend über Zeit (die Oura-Mechanik)
// ───────────────────────────────────────────────────────────
// Oura verkauft nicht die Messung, sondern den TREND: "dein Wert
// steigt, seit du X tust". Genau das macht dieses Modul für das
// Exposom — die Summe dessen, was du in und auf deinen Körper bringst.
//
// Aus jedem Scan wird eine "Belastungspunktzahl" abgeleitet und über
// Zeit aggregiert. Der Nutzer sieht nicht 100 Einzelscans, sondern:
// "Deine Schadstoff-Belastung diesen Monat ist um 30% gesunken."
//
// FUNKTIONIERT KOMPLETT OHNE WEARABLE. Ring-Daten kommen später als
// zusätzliche Korrelationsschicht dazu (der Trend allein ist der Wert).
//
// Kern-Idee der Belastung:
//   - rote Stoffe belasten stark, gelbe mittel, grüne entlasten
//   - je mehr rote Produkte im Alltag, desto höher die Belastung
//   - der Score ist relativ und über Zeit vergleichbar (nicht absolut)
// ═══════════════════════════════════════════════════════════

// Belastungsgewicht eines einzelnen Scans (0 = sauber, höher = belastender).
// Basiert auf der clevia-Ampel des Gesamtergebnisses UND der Stoff-Zusammensetzung.
export function scanBelastung(scan) {
  if (!scan) return 0;
  // Grundlast nach Gesamt-Ampel
  let last = 0;
  const amp = scan.gesamt || scan.ampel;
  if (amp === 'avoid' || amp === 'rot') last = 10;
  else if (amp === 'caution' || amp === 'gelb') last = 4;
  else if (amp === 'clean' || amp === 'gruen' || amp === 'grün') last = 0;
  else last = 2; // unbekannt → leichte Vorsichtslast
  // Feinjustierung über den Score (0-10, niedriger = schlechter), falls vorhanden
  if (typeof scan.score === 'number') {
    // Score 10 = perfekt (0 Zusatzlast), Score 0 = +5 Last
    last += Math.max(0, (10 - scan.score) * 0.5);
  }
  return Math.round(last * 10) / 10;
}

// Hilfsfunktion: Tag (YYYY-MM-DD) aus Zeitstempel.
function tagVon(ts) {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}
// Hilfsfunktion: ISO-Wochenschlüssel (YYYY-Www) aus Zeitstempel.
function wocheVon(ts) {
  const d = new Date(ts);
  const jahr = d.getUTCFullYear();
  // Wochennummer grob (ausreichend für Aggregation)
  const start = new Date(Date.UTC(jahr, 0, 1));
  const woche = Math.ceil((((d - start) / 86400000) + start.getUTCDay() + 1) / 7);
  return `${jahr}-W${String(woche).padStart(2, '0')}`;
}

// ═══ HAUPT: Exposom-Profil aus dem Scan-Verlauf berechnen ═══
// verlauf: Array von Scans mit {t (Zeitstempel), score, gesamt, ...}
// Gibt Trend, aktuelle Belastung, Vergleich zu Vorperiode, Einordnung.
export function berechneExposom(verlauf, opts = {}) {
  const scans = (verlauf || []).filter(s => s && s.t);
  if (scans.length === 0) {
    return { hatDaten: false, anzahlScans: 0 };
  }

  const jetzt = opts.jetzt || Date.now();
  const TAG = 86400000;

  // Belastung pro Scan
  const mitLast = scans.map(s => ({ t: s.t, last: scanBelastung(s), ampel: s.gesamt || s.ampel }));

  // Zeitfenster: dieser Monat (30 Tage) vs. Vormonat
  const diesenMonat = mitLast.filter(s => s.t >= jetzt - 30 * TAG);
  const vormonat = mitLast.filter(s => s.t < jetzt - 30 * TAG && s.t >= jetzt - 60 * TAG);

  // Durchschnittsbelastung je Fenster
  const schnitt = arr => arr.length ? arr.reduce((a, b) => a + b.last, 0) / arr.length : null;
  const lastDiesenMonat = schnitt(diesenMonat);
  const lastVormonat = schnitt(vormonat);

  // Trend: Veränderung in Prozent (negativ = besser geworden)
  let trendProzent = null, richtung = 'stabil';
  if (lastVormonat !== null && lastDiesenMonat !== null) {
    if (lastVormonat > 0.3) {
      // Normaler Fall: prozentuale Veränderung, aber gekappt auf ±99%
      // (extreme Werte wie "2700%" sind mathematisch korrekt, aber unverständlich)
      const roh = ((lastDiesenMonat - lastVormonat) / lastVormonat) * 100;
      trendProzent = Math.max(-99, Math.min(99, Math.round(roh)));
      if (trendProzent <= -10) richtung = 'besser';
      else if (trendProzent >= 10) richtung = 'schlechter';
    } else {
      // Vormonat war (fast) sauber: Prozent wäre sinnlos. Absolute Richtung.
      if (lastDiesenMonat > lastVormonat + 1) { richtung = 'schlechter'; trendProzent = null; }
      else if (lastDiesenMonat < lastVormonat - 0.5) { richtung = 'besser'; trendProzent = null; }
      else { richtung = 'stabil'; trendProzent = 0; }
    }
  }

  // Anteil sauberer Scans (grün) diesen Monat
  const gruenAnteil = diesenMonat.length
    ? Math.round((diesenMonat.filter(s => s.ampel === 'clean' || s.ampel === 'gruen' || s.ampel === 'grün').length / diesenMonat.length) * 100)
    : null;

  // Belastungs-Level (verständliche Einordnung, nicht nackte Zahl)
  let level = 'niedrig', levelText = '';
  const ref = lastDiesenMonat !== null ? lastDiesenMonat : schnitt(mitLast);
  if (ref === null) { level = 'unbekannt'; }
  else if (ref < 2) { level = 'niedrig'; levelText = 'Deine Produktwahl ist überwiegend sauber.'; }
  else if (ref < 5) { level = 'mittel'; levelText = 'Einige belastende Produkte in deinem Alltag.'; }
  else { level = 'hoch'; levelText = 'Viele belastende Produkte – hier lohnt sich Umsteigen.'; }

  // Wochen-Zeitreihe für einen Graphen (letzte ~12 Wochen)
  const wochen = {};
  mitLast.forEach(s => {
    const w = wocheVon(s.t);
    if (!wochen[w]) wochen[w] = { summe: 0, anzahl: 0 };
    wochen[w].summe += s.last;
    wochen[w].anzahl += 1;
  });
  const zeitreihe = Object.entries(wochen)
    .map(([woche, v]) => ({ woche, belastung: Math.round((v.summe / v.anzahl) * 10) / 10, scans: v.anzahl }))
    .sort((a, b) => a.woche.localeCompare(b.woche))
    .slice(-12);

  return {
    hatDaten: true,
    anzahlScans: scans.length,
    scansDiesenMonat: diesenMonat.length,
    belastungAktuell: lastDiesenMonat !== null ? Math.round(lastDiesenMonat * 10) / 10 : null,
    belastungVormonat: lastVormonat !== null ? Math.round(lastVormonat * 10) / 10 : null,
    trendProzent,
    richtung,
    gruenAnteil,
    level,
    levelText,
    zeitreihe,
  };
}

// Erzeugt den verständlichen Trend-Satz für die UI (die Oura-Sprache).
export function exposomText(profil) {
  if (!profil || !profil.hatDaten) {
    return { titel: 'Dein Exposom-Profil', text: 'Scanne ein paar Produkte, dann zeigt clevia hier deinen Belastungs-Trend über Zeit.', hatDaten: false };
  }
  // Nicht genug Historie für einen Vergleich?
  if (profil.trendProzent === null) {
    return {
      titel: 'Dein Exposom-Profil wächst',
      text: `${profil.anzahlScans} Produkte erfasst. Sobald du über zwei Monate scannst, zeigt clevia deinen Belastungs-Trend. Aktuelles Level: ${profil.level}.`,
      hatDaten: true, level: profil.level,
    };
  }
  // Der Kern-Satz: Trend über Zeit (Oura-Mechanik)
  let kern;
  if (profil.richtung === 'besser') {
    kern = profil.trendProzent !== null
      ? `Deine Schadstoff-Belastung ist diesen Monat um ${Math.abs(profil.trendProzent)}% gesunken. Weiter so – deine Produktwahl wird sauberer.`
      : `Deine Belastung ist diesen Monat spürbar gesunken. Weiter so – deine Produktwahl wird sauberer.`;
  } else if (profil.richtung === 'schlechter') {
    kern = profil.trendProzent !== null
      ? `Deine Belastung ist diesen Monat um ${profil.trendProzent}% gestiegen. Ein paar belastende Produkte haben sich eingeschlichen.`
      : `Deine Belastung ist diesen Monat gestiegen. Ein paar belastende Produkte haben sich eingeschlichen.`;
  } else {
    kern = `Deine Belastung ist stabil. Level: ${profil.level}.`;
  }
  return { titel: 'Dein Exposom-Trend', text: kern, hatDaten: true, level: profil.level, trend: profil.trendProzent, richtung: profil.richtung };
}

export const _intern = { tagVon, wocheVon };
