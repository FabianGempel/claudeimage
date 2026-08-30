// ═══════════════════════════════════════════════════════════
// Billing-Routen: Währung, Checkout, Erfolg, Verify, Konto.
// Stripe-Flow + Lizenz-Erzeugung. Router-Modul.
// Hinweis: /checkout, /erfolg, /konto liefern HTML (nicht /api/v1),
// weil es Nutzer-Seiten sind. /api/waehrung + /api/verify bleiben
// zusätzlich unter /api/v1 verfügbar (versioniert).
// ═══════════════════════════════════════════════════════════

import { Router } from 'express';
import { config } from '../config.js';
import { stripe, resend } from '../lib/clients.js';
import { findeKeyFuerSession, speichereLizenz, pruefeLizenz, generiereLizenzKey, legeAccountAnUndVerknuepfe, erzeugePasswortLink } from '../lib/lizenzen.js';
import { fehlerSeite, kontoFormularHTML, erfolgsseiteHTML, mailHTML } from '../lib/html-templates.js';

const BASE = config.baseUrl;
const MAIL_FROM = config.mailFrom;
const PREISE = config.stripe.preise;

// ── Währung nach Land ─────────────────────────────────────
export function waehrungFuerRequest(req) {
  const land = (req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || '').toUpperCase();
  if (land === 'CH' || land === 'LI') return 'chf';
  if (land) return 'eur';
  const lang = (req.headers['accept-language'] || '').toLowerCase();
  if (lang.includes('de-ch') || lang.includes('gsw')) return 'chf';
  return 'eur';
}
function preiseFuerRequest(req) {
  return PREISE[waehrungFuerRequest(req)] || PREISE.eur;
}

// ── API-Router (versioniert unter /api/v1) ────────────────
export const billingApiRouter = Router();

billingApiRouter.get('/waehrung', (req, res) => {
  res.json({ waehrung: waehrungFuerRequest(req) });
});

billingApiRouter.get('/verify', async (req, res) => {
  const key = (req.query.key || '').toUpperCase();
  const { gueltig, plan } = await pruefeLizenz(key);
  res.json({ gueltig, plan });
});

// ── Seiten-Router (HTML-Seiten für Nutzer) ────────────────
export const billingPageRouter = Router();

// Checkout starten
billingPageRouter.get('/checkout', async (req, res) => {
  const plan = req.query.plan || 'yearly';
  const waehrung = waehrungFuerRequest(req);
  const preis = preiseFuerRequest(req)[plan];
  if (!preis) return res.status(400).send(fehlerSeite('Ungültiger Plan', 'Bitte wähle einen gültigen Tarif.'));

  if (!config.stripe.secretKey) {
    return res.status(500).send(fehlerSeite('Zahlung noch nicht aktiv',
      'Der Stripe-Schlüssel fehlt auf dem Server. Bitte STRIPE_SECRET_KEY in den Umgebungsvariablen setzen.'));
  }
  if (!preis.price) {
    const suffix = plan.toUpperCase() + (waehrung === 'chf' ? '_CHF' : '');
    return res.status(500).send(fehlerSeite('Tarif noch nicht verknüpft',
      `Für den Tarif „${preis.name}" (${waehrung.toUpperCase()}) fehlt die Stripe-Preis-ID (STRIPE_PRICE_${suffix}). Bitte in den Umgebungsvariablen ergänzen.`));
  }

  const istAbo = plan !== 'lifetime';
  try {
    const session = await stripe.checkout.sessions.create({
      mode: istAbo ? 'subscription' : 'payment',
      line_items: [{ price: preis.price, quantity: 1 }],
      subscription_data: istAbo ? {
        trial_period_days: 14,
        trial_settings: { end_behavior: { missing_payment_method: 'pause' } },
        metadata: { plan }
      } : undefined,
      metadata: { plan, trial: istAbo ? 'true' : 'false' },
      payment_method_collection: istAbo ? 'always' : undefined,
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      customer_creation: istAbo ? undefined : 'always',
      success_url: `${BASE}/erfolg?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE}/`,
      allow_promotion_codes: true,
    });
    res.redirect(session.url);
  } catch (err) {
    console.error('Checkout-Fehler:', err.message);
    res.status(500).send(fehlerSeite('Checkout konnte nicht gestartet werden',
      'Die Zahlung ließ sich nicht öffnen. Meist liegt es an einer noch nicht korrekt hinterlegten Stripe-Preis-ID. Details: ' + (err.message || 'unbekannter Fehler')));
  }
});

// Erfolgsseite: Key generieren, speichern, mailen, anzeigen
billingPageRouter.get('/erfolg', async (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.redirect('/');
  if (!stripe) return res.status(500).send(fehlerSeite('Zahlung nicht konfiguriert',
    'Der Zahlungsdienst ist auf dem Server noch nicht eingerichtet.'));

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('Session-Abruf fehlgeschlagen:', err.message);
    return res.status(500).send(fehlerSeite('Bestellung nicht gefunden',
      'Deine Sitzung ließ sich nicht laden. Falls Geld abgebucht wurde, melde dich bitte bei uns.'));
  }
  const email = session.customer_details?.email || 'unbekannt';

  let key = await findeKeyFuerSession(sessionId);
  if (!key) {
    key = generiereLizenzKey();
    await speichereLizenz(key, { email, sessionId, plan: session.mode });

    // Vollständiger Account: anlegen + Lizenz verknüpfen (geräteübergreifend)
    const { neu } = await legeAccountAnUndVerknuepfe(email, key, { sessionId, plan: session.mode });
    // Passwort-Setzen-Link erzeugen (nur bei neuem Account nötig)
    const passwortLink = neu ? await erzeugePasswortLink(email) : null;

    if (resend) {
      await resend.emails.send({
        from: MAIL_FROM,
        to: email,
        subject: 'Willkommen bei clevia. — dein Zugang 🌿',
        html: mailHTML(key, passwortLink),
      }).catch(e => console.error('Mail-Fehler:', e));
    } else {
      console.warn('⚠ Kein Resend-Key — Bestätigungsmail übersprungen. Key:', key);
    }
  }
  res.send(erfolgsseiteHTML(key, email));
});

// Abo verwalten / kündigen (Stripe-Kundenportal)
billingPageRouter.get('/konto', async (req, res) => {
  if (!stripe) return res.status(500).send(fehlerSeite('Nicht verfügbar',
    'Die Kontoverwaltung ist auf dem Server noch nicht eingerichtet.'));
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.send(kontoFormularHTML());

  try {
    const kunden = await stripe.customers.list({ email, limit: 1 });
    if (!kunden.data.length) {
      return res.send(kontoFormularHTML('Zu dieser E-Mail wurde kein Abo gefunden. Bitte nutze die Adresse, mit der du gekauft hast.'));
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: kunden.data[0].id,
      return_url: `${BASE}/app`,
    });
    return res.redirect(portal.url);
  } catch (err) {
    console.error('Portal-Fehler:', err.message);
    return res.status(500).send(fehlerSeite('Kontoverwaltung noch nicht aktiv',
      'Das Kundenportal muss einmalig im Stripe-Dashboard aktiviert werden (Einstellungen → Kundenportal). Details: ' + (err.message || '')));
  }
});
