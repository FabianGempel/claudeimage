// ═══════════════════════════════════════════════════════════
// Lizenz-Key-Generierung & -Validierung (serverseitig).
// Kompatibel mit der App-Validierung.
// Der Präfix ist "CLEVIA-" — exakt wie ihn die App-Validierung
// (istGueltigerCode in app.html) erwartet. Beide Seiten nutzen
// dieselbe Prüfziffer-Logik (charCode-Summe von Block1 mod 36).
// ═══════════════════════════════════════════════════════════

import crypto from 'crypto';

const KEY_PREFIX = 'CLEVIA'; // muss mit der App-Validierung übereinstimmen

function pruefzeichen(teil) {
  let summe = 0;
  for (const c of teil) summe += c.charCodeAt(0);
  return '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[summe % 36];
}

export function generiereLizenzKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = (n) => Array.from({ length: n }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  const block1 = rand(4);
  const block2 = rand(4);
  const block3 = rand(3) + pruefzeichen(block1);
  return `${KEY_PREFIX}-${block1}-${block2}-${block3}`;
}

export function validiereKey(key) {
  const m = key.match(new RegExp(`^${KEY_PREFIX}-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$`));
  if (!m) return false;
  return m[3][3] === pruefzeichen(m[1]);
}
