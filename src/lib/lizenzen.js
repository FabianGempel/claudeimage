// ═══════════════════════════════════════════════════════════
// Lizenz-Datenschicht — primär Supabase (deploy-fest), Datei nur
// als Fallback in der Entwicklung. Kapselt allen DB-Zugriff für
// Lizenzen an einer Stelle (Repository-Pattern).
// ═══════════════════════════════════════════════════════════

import fs from 'fs';
import { supabase } from './clients.js';
import { generiereLizenzKey } from './lizenz-key.js';

const DB_FILE = './lizenzen.json';

function ladeDateiDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE)); } catch { return {}; }
}
function speichereDateiDB(db) {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
  catch (e) { console.error('Datei-DB Fehler:', e.message); }
}

export async function findeKeyFuerSession(sessionId) {
  if (supabase) {
    const { data } = await supabase.from('lizenzen')
      .select('license_key').eq('stripe_session_id', sessionId).maybeSingle();
    return data?.license_key || null;
  }
  const db = ladeDateiDB();
  return Object.keys(db).find(k => db[k].sessionId === sessionId) || null;
}

export async function speichereLizenz(key, { email, sessionId, plan }) {
  if (supabase) {
    const { error } = await supabase.from('lizenzen').insert({
      license_key: key, email, stripe_session_id: sessionId, plan, aktiv: true,
    });
    if (error) console.error('Supabase-Lizenz-Fehler:', error.message);
    return;
  }
  const db = ladeDateiDB();
  db[key] = { email, sessionId, plan, erstellt: new Date().toISOString(), aktiv: true };
  speichereDateiDB(db);
}

export async function pruefeLizenz(key) {
  if (supabase) {
    const { data } = await supabase.from('lizenzen')
      .select('aktiv,plan').eq('license_key', key).maybeSingle();
    return { gueltig: !!data && data.aktiv, plan: data?.plan };
  }
  const db = ladeDateiDB();
  const e = db[key];
  return { gueltig: !!e && e.aktiv, plan: e?.plan };
}


// ═══════════════════════════════════════════════════════════
// ACCOUNT-ANLAGE nach Kauf — legt einen Supabase-Auth-Account an
// (mit der Stripe-E-Mail) und verknüpft die Lizenz automatisch mit
// der user_id. Der Nutzer setzt danach nur noch sein Passwort.
// So ist Premium geräteübergreifend und wiederherstellbar.
// ═══════════════════════════════════════════════════════════
export async function legeAccountAnUndVerknuepfe(email, key, { sessionId, plan } = {}) {
  if (!supabase || !email || email === 'unbekannt') return { userId: null, neu: false };
  try {
    // 1. Existiert schon ein Account mit dieser E-Mail?
    const { data: liste } = await supabase.auth.admin.listUsers();
    let user = liste?.users?.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    let neu = false;

    // 2. Falls nicht: Account anlegen (E-Mail bereits bestätigt, da über Stripe verifiziert)
    if (!user) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,               // Stripe hat die E-Mail schon verifiziert
        user_metadata: { plan, quelle: 'kauf' },
      });
      if (error) { console.error('Account-Anlage fehlgeschlagen:', error.message); }
      else { user = created.user; neu = true; }
    }

    // 3. Lizenz mit user_id verknüpfen (in der lizenzen-Tabelle)
    if (user) {
      await supabase.from('lizenzen')
        .update({ user_id: user.id })
        .eq('license_key', key);
    }
    return { userId: user?.id || null, neu };
  } catch (e) {
    console.error('Account-Verknüpfung Fehler:', e.message);
    return { userId: null, neu: false };
  }
}

// Erzeugt einen Passwort-Setzen-Link (Magic Link), den der Nutzer per Mail bekommt.
export async function erzeugePasswortLink(email) {
  if (!supabase || !email) return null;
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',                    // Recovery = "Passwort setzen/zurücksetzen"
      email,
    });
    if (error) { console.error('Link-Erzeugung fehlgeschlagen:', error.message); return null; }
    return data?.properties?.action_link || null;
  } catch (e) { console.error('Link Fehler:', e.message); return null; }
}

export { generiereLizenzKey };
