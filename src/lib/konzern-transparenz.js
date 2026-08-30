// ═══════════════════════════════════════════════════════════
// clevia Konzern-Transparenz
// ───────────────────────────────────────────────────────────
// Deckt auf, welcher Konzern hinter einer Marke steht. Menschen
// boykottieren H&M, kaufen aber & Other Stories — ohne zu wissen,
// dass es derselbe Konzern ist. Diese Verschleierung sichtbar zu
// machen ist genau die Transparenz, die eine bewusste Community will.
//
// Der Graben (schwer kopierbar): nicht die Anzeige-Logik, sondern die
// gepflegte, verifizierte Zuordnung tausender Marken zu Mutterkonzernen.
// Das ist Jahre Kuratierungsarbeit — wie die KURIERT_DB.
//
// Deckt Mode UND Konsumgüter/Kosmetik/Lebensmittel ab, weil beide
// für eine Low-Tox/Ethik-App relevant sind.
// ═══════════════════════════════════════════════════════════

// Struktur: markenNormKey → { konzern, land, hinweis?, kategorie }
// hinweis = optionale ethische/gesundheitliche Einordnung (clevia-Haltung)
export const KONZERN_DB = {
  // ── MODE: Inditex (Zara-Konzern) ──
  'zara': { konzern: 'Inditex', land: 'Spanien', kategorie: 'mode' },
  'bershka': { konzern: 'Inditex', land: 'Spanien', kategorie: 'mode' },
  'pull&bear': { konzern: 'Inditex', land: 'Spanien', kategorie: 'mode' },
  'pull and bear': { konzern: 'Inditex', land: 'Spanien', kategorie: 'mode' },
  'stradivarius': { konzern: 'Inditex', land: 'Spanien', kategorie: 'mode' },
  'massimo dutti': { konzern: 'Inditex', land: 'Spanien', kategorie: 'mode' },
  'oysho': { konzern: 'Inditex', land: 'Spanien', kategorie: 'mode' },

  // ── MODE: H&M-Gruppe (dein Beispiel!) ──
  'h&m': { konzern: 'H&M Group', land: 'Schweden', kategorie: 'mode' },
  'h and m': { konzern: 'H&M Group', land: 'Schweden', kategorie: 'mode' },
  'hm': { konzern: 'H&M Group', land: 'Schweden', kategorie: 'mode' },
  '& other stories': { konzern: 'H&M Group', land: 'Schweden', hinweis: 'Gehört zu H&M – wirkt eigenständig/hochwertiger, gleicher Konzern', kategorie: 'mode' },
  'other stories': { konzern: 'H&M Group', land: 'Schweden', hinweis: 'Gehört zu H&M – wirkt eigenständig/hochwertiger, gleicher Konzern', kategorie: 'mode' },
  'cos': { konzern: 'H&M Group', land: 'Schweden', hinweis: 'Gehört zu H&M – Premium-Linie, gleicher Konzern', kategorie: 'mode' },
  'monki': { konzern: 'H&M Group', land: 'Schweden', kategorie: 'mode' },
  'weekday': { konzern: 'H&M Group', land: 'Schweden', kategorie: 'mode' },
  'arket': { konzern: 'H&M Group', land: 'Schweden', kategorie: 'mode' },

  // ── MODE: weitere große Gruppen ──
  'uniqlo': { konzern: 'Fast Retailing', land: 'Japan', kategorie: 'mode' },
  'gu': { konzern: 'Fast Retailing', land: 'Japan', kategorie: 'mode' },
  'primark': { konzern: 'Associated British Foods', land: 'Irland/UK', kategorie: 'mode' },
  'esprit': { konzern: 'Esprit Holdings', land: 'Hongkong', kategorie: 'mode' },
  'c&a': { konzern: 'Cofra Holding', land: 'Deutschland/NL', kategorie: 'mode' },
  'gucci': { konzern: 'Kering', land: 'Frankreich', kategorie: 'mode' },
  'saint laurent': { konzern: 'Kering', land: 'Frankreich', kategorie: 'mode' },
  'balenciaga': { konzern: 'Kering', land: 'Frankreich', kategorie: 'mode' },
  'bottega veneta': { konzern: 'Kering', land: 'Frankreich', kategorie: 'mode' },
  'louis vuitton': { konzern: 'LVMH', land: 'Frankreich', kategorie: 'mode' },
  'dior': { konzern: 'LVMH', land: 'Frankreich', kategorie: 'mode' },
  'fendi': { konzern: 'LVMH', land: 'Frankreich', kategorie: 'mode' },
  'celine': { konzern: 'LVMH', land: 'Frankreich', kategorie: 'mode' },
  'loewe': { konzern: 'LVMH', land: 'Frankreich', kategorie: 'mode' },

  // ── KOSMETIK: L'Oréal ──
  'l\'oréal': { konzern: 'L\'Oréal', land: 'Frankreich', kategorie: 'kosmetik' },
  'loreal': { konzern: 'L\'Oréal', land: 'Frankreich', kategorie: 'kosmetik' },
  'garnier': { konzern: 'L\'Oréal', land: 'Frankreich', kategorie: 'kosmetik' },
  'maybelline': { konzern: 'L\'Oréal', land: 'Frankreich', kategorie: 'kosmetik' },
  'la roche posay': { konzern: 'L\'Oréal', land: 'Frankreich', kategorie: 'kosmetik' },
  'la roche-posay': { konzern: 'L\'Oréal', land: 'Frankreich', kategorie: 'kosmetik' },
  'vichy': { konzern: 'L\'Oréal', land: 'Frankreich', kategorie: 'kosmetik' },
  'cerave': { konzern: 'L\'Oréal', land: 'Frankreich', hinweis: 'Gehört zu L\'Oréal – als "Clean"-Marke vermarktet, Großkonzern', kategorie: 'kosmetik' },
  'kiehl\'s': { konzern: 'L\'Oréal', land: 'Frankreich', kategorie: 'kosmetik' },
  'kiehls': { konzern: 'L\'Oréal', land: 'Frankreich', kategorie: 'kosmetik' },
  'the body shop': { konzern: 'Natura &Co (ehem. L\'Oréal)', land: 'Brasilien', kategorie: 'kosmetik' },

  // ── KOSMETIK: Estée Lauder ──
  'estée lauder': { konzern: 'Estée Lauder', land: 'USA', kategorie: 'kosmetik' },
  'estee lauder': { konzern: 'Estée Lauder', land: 'USA', kategorie: 'kosmetik' },
  'mac': { konzern: 'Estée Lauder', land: 'USA', kategorie: 'kosmetik' },
  'clinique': { konzern: 'Estée Lauder', land: 'USA', kategorie: 'kosmetik' },
  'la mer': { konzern: 'Estée Lauder', land: 'USA', kategorie: 'kosmetik' },
  'the ordinary': { konzern: 'Estée Lauder (DECIEM)', land: 'Kanada', hinweis: 'Mehrheitlich Estée Lauder – als unabhängig wahrgenommen', kategorie: 'kosmetik' },
  'deciem': { konzern: 'Estée Lauder', land: 'Kanada', kategorie: 'kosmetik' },

  // ── KOSMETIK/KONSUM: Unilever ──
  'dove': { konzern: 'Unilever', land: 'UK/NL', kategorie: 'kosmetik' },
  'axe': { konzern: 'Unilever', land: 'UK/NL', kategorie: 'kosmetik' },
  'rexona': { konzern: 'Unilever', land: 'UK/NL', kategorie: 'kosmetik' },
  'dermalogica': { konzern: 'Unilever', land: 'UK/NL', kategorie: 'kosmetik' },
  'ren': { konzern: 'Unilever', land: 'UK/NL', hinweis: 'Gehört zu Unilever – "Clean Skincare"-Marke im Großkonzern', kategorie: 'kosmetik' },

  // ── KOSMETIK/KONSUM: Procter & Gamble ──
  'olay': { konzern: 'Procter & Gamble', land: 'USA', kategorie: 'kosmetik' },
  'pantene': { konzern: 'Procter & Gamble', land: 'USA', kategorie: 'kosmetik' },
  'head & shoulders': { konzern: 'Procter & Gamble', land: 'USA', kategorie: 'kosmetik' },
  'oral-b': { konzern: 'Procter & Gamble', land: 'USA', kategorie: 'kosmetik' },
  'gillette': { konzern: 'Procter & Gamble', land: 'USA', kategorie: 'kosmetik' },

  // ── KONSUM: Beiersdorf (deutsch) ──
  'nivea': { konzern: 'Beiersdorf', land: 'Deutschland', kategorie: 'kosmetik' },
  'eucerin': { konzern: 'Beiersdorf', land: 'Deutschland', kategorie: 'kosmetik' },
  'labello': { konzern: 'Beiersdorf', land: 'Deutschland', kategorie: 'kosmetik' },
  'la prairie': { konzern: 'Beiersdorf', land: 'Deutschland', kategorie: 'kosmetik' },

  // ── LEBENSMITTEL: Nestlé ──
  'nestlé': { konzern: 'Nestlé', land: 'Schweiz', kategorie: 'lebensmittel' },
  'nestle': { konzern: 'Nestlé', land: 'Schweiz', kategorie: 'lebensmittel' },
  'maggi': { konzern: 'Nestlé', land: 'Schweiz', kategorie: 'lebensmittel' },
  'nescafé': { konzern: 'Nestlé', land: 'Schweiz', kategorie: 'lebensmittel' },
  'kitkat': { konzern: 'Nestlé', land: 'Schweiz', kategorie: 'lebensmittel' },
  'vittel': { konzern: 'Nestlé', land: 'Schweiz', kategorie: 'lebensmittel' },
  'san pellegrino': { konzern: 'Nestlé', land: 'Schweiz', kategorie: 'lebensmittel' },

  // ── LEBENSMITTEL: weitere Riesen ──
  'coca-cola': { konzern: 'The Coca-Cola Company', land: 'USA', kategorie: 'lebensmittel' },
  'fanta': { konzern: 'The Coca-Cola Company', land: 'USA', kategorie: 'lebensmittel' },
  'sprite': { konzern: 'The Coca-Cola Company', land: 'USA', kategorie: 'lebensmittel' },
  'vio': { konzern: 'The Coca-Cola Company', land: 'USA', kategorie: 'lebensmittel' },
  'innocent': { konzern: 'The Coca-Cola Company', land: 'USA', hinweis: 'Gehört zu Coca-Cola – als nachhaltige Smoothie-Marke vermarktet', kategorie: 'lebensmittel' },
  'pepsi': { konzern: 'PepsiCo', land: 'USA', kategorie: 'lebensmittel' },
  'lay\'s': { konzern: 'PepsiCo', land: 'USA', kategorie: 'lebensmittel' },
  'milka': { konzern: 'Mondelēz', land: 'USA', kategorie: 'lebensmittel' },
  'oreo': { konzern: 'Mondelēz', land: 'USA', kategorie: 'lebensmittel' },
  'toblerone': { konzern: 'Mondelēz', land: 'USA', kategorie: 'lebensmittel' },
};

// Normalisiert einen Markennamen für den Lookup.
function normMarke(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ═══ HAUPT: Konzern hinter einer Marke ═══════════════════════
// Gibt { gefunden, konzern, land, hinweis, kategorie, geschwister }
// geschwister = andere Marken desselben Konzerns (für "gehört zur selben Familie wie...")
export function findeKonzern(marke) {
  const key = normMarke(marke);
  if (!key) return { gefunden: false };

  let treffer = KONZERN_DB[key];
  // Fuzzy: Marke könnte als Teil eines längeren Namens vorkommen
  // ("Nivea Soft" → "nivea"). Wortweise prüfen.
  if (!treffer) {
    const woerter = key.split(' ');
    for (let n = woerter.length; n >= 1 && !treffer; n--) {
      for (let i = 0; i + n <= woerter.length && !treffer; i++) {
        const kandidat = woerter.slice(i, i + n).join(' ');
        if (KONZERN_DB[kandidat]) treffer = KONZERN_DB[kandidat];
      }
    }
  }
  if (!treffer) return { gefunden: false };

  // Geschwistermarken desselben Konzerns finden (echte andere Marken,
  // keine Schreibvarianten der gesuchten Marke, keine Dubletten).
  const treffer_konzern = treffer.konzern;
  const gesehen = new Set();      // gegen Schreibvarianten-Dubletten
  const geschwister = [];
  // Schreibvarianten der GESUCHTEN Marke sammeln (die nie Geschwister sein dürfen).
  const selbstVarianten = new Set(
    Object.entries(KONZERN_DB)
      .filter(([, v]) => v.konzern === treffer_konzern)
      .map(([k]) => k)
      .filter(k => aehnlich(k, key))
  );
  selbstVarianten.add(key);

  for (const [k, v] of Object.entries(KONZERN_DB)) {
    if (v.konzern !== treffer_konzern) continue;
    if (selbstVarianten.has(k)) continue;         // Schreibvariante der gesuchten Marke
    // Kanonische Form für Dubletten-Check (z.B. "h&m"/"h and m"/"hm").
    const kanon = k.replace(/[^a-z0-9]/g, '');
    if (gesehen.has(kanon)) continue;
    gesehen.add(kanon);
    const anzeige = k.replace(/\b\w/g, c => c.toUpperCase());
    geschwister.push(anzeige);
    if (geschwister.length >= 6) break;
  }

  return {
    gefunden: true,
    konzern: treffer.konzern,
    land: treffer.land,
    hinweis: treffer.hinweis || null,
    kategorie: treffer.kategorie,
    geschwister: geschwister.slice(0, 6),
  };
}

// Grobe Ähnlichkeit zweier Marken-Keys (für Schreibvarianten-Erkennung).
// "h&m" ~ "h and m" ~ "hm" (gleiche Buchstaben-Essenz).
function aehnlich(a, b) {
  const essenz = s => s.replace(/[^a-z0-9]/g, '').replace(/and/g, '');
  return essenz(a) === essenz(b);
}

// Erzeugt den Transparenz-Hinweis als fertigen Text für die UI.
export function konzernHinweisText(marke) {
  const k = findeKonzern(marke);
  if (!k.gefunden) return null;
  let text = `${marke} gehört zum Konzern ${k.konzern}`;
  if (k.land) text += ` (${k.land})`;
  text += '.';
  if (k.hinweis) text += ` ${k.hinweis}.`;
  if (k.geschwister.length > 0) {
    text += ` Weitere Marken desselben Konzerns: ${k.geschwister.slice(0, 4).join(', ')}.`;
  }
  return { text, konzern: k.konzern, hinweis: k.hinweis, geschwister: k.geschwister };
}

export const _intern = { normMarke, KONZERN_ANZAHL: Object.keys(KONZERN_DB).length };
