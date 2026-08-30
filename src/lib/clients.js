// ═══════════════════════════════════════════════════════════
// Externe Service-Clients — zentral & robust initialisiert.
// Fehlt ein Key, wird der Client null (kein Absturz beim Start —
// das war die Ursache des Weißbildschirm-Bugs). Betroffene Features
// prüfen auf null und zeigen klare Hinweise.
// ═══════════════════════════════════════════════════════════

import Stripe from 'stripe';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

// WebSocket-Implementierung für Node bereitstellen. Die neue supabase-js-Version
// erwartet einen nativen WebSocket (erst ab Node 22 vorhanden). Auf Node 20 würde
// der Client-Aufbau sonst mit "native WebSocket not found" scheitern → EMF/DB tot.
// 'ws' schließt die Lücke unabhängig von der Node-Version.
let WebSocketImpl = undefined;
try {
  const wsModule = await import('ws');
  WebSocketImpl = wsModule.default || wsModule.WebSocket || wsModule;
} catch (e) { console.error('⚠ ws konnte nicht geladen werden:', e.message); }

let stripe = null;
let resend = null;
let supabase = null;

try {
  if (config.stripe.secretKey) stripe = new Stripe(config.stripe.secretKey);
} catch (e) { console.error('⚠ Stripe-Init fehlgeschlagen:', e.message); }

try {
  if (config.resendApiKey) resend = new Resend(config.resendApiKey);
} catch (e) { console.error('⚠ Resend-Init fehlgeschlagen:', e.message); }

try {
  if (config.supabase.url && config.supabase.serviceKey) {
    // Realtime deaktivieren: wird für RPC/DB-Abfragen nicht gebraucht und
    // verlangt sonst einen nativen WebSocket (Node < 22 wirft dort einen Fehler,
    // der den Client-Aufbau komplett scheitern ließ → EMF fand keine Masten).
    supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: WebSocketImpl ? { transport: WebSocketImpl } : { params: { eventsPerSecond: 0 } },
      global: { headers: { 'X-Client-Info': 'clevia-server' } },
    });
  }
} catch (e) { console.error('⚠ Supabase-Init fehlgeschlagen:', e.message); }

export { stripe, resend, supabase };
