// ═══════════════════════════════════════════════════════════
// clevia — Server (Orchestrierung)
// Schlanke Zusammenführung der Module. Keine Business-Logik hier —
// die liegt in src/routes/* und src/lib/*. Enterprise-Prinzip:
// klare Trennung, versionierte API (/api/v1), Health-Check, CORS
// für die getrennte Verkaufsseite.
// ═══════════════════════════════════════════════════════════

import express from 'express';
import { readFileSync } from 'node:fs';
import { config, pruefeConfig } from './config.js';
import { initMonitoring, requestLogger, fehlerHandler, log } from './lib/monitoring.js';

// Route-Module
import { umweltRouter } from './routes/umwelt.js';
import { visionRouter } from './routes/vision.js';
import { billingApiRouter, billingPageRouter } from './routes/billing.js';
import { barcodeRouter } from './routes/barcode.js';
import { sdbRouter } from './routes/sdb.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '12mb' })); // Base64-Bilder für Vision
app.use(requestLogger); // strukturiertes Request-Logging (Observability)

// ── Sicherheits-Header ────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Copyright', '(c) 2026 sooth+ - All rights reserved. clevia. is proprietary.');
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  next();
});

// ── CORS für die getrennte Verkaufsseite ──────────────────
// Die Verkaufsseite (eigenes Repo/Domain) darf die API aufrufen.
// Nur die konfigurierten Origins, nichts anderes.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Health-Check (für Railway, Monitoring, Load-Balancer) ──
// Standard bei allen großen Systemen: ein Endpunkt, der schnell
// "läuft" meldet, ohne Abhängigkeiten zu belasten.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'clevia', env: config.env, zeit: new Date().toISOString() });
});

// ── Statische Dateien ─────────────────────────────────────
// WICHTIG: app.html NIEMALS statisch ausliefern — sie MUSS durch die
// Config-Injektion (sendeApp) laufen, sonst fehlt window.__CLEVIA_CONFIG__
// und Coach/Scanner/Konto sind tot. Deshalb app.html hier abfangen und
// auf die injizierende Route umleiten.
app.get(['/app.html', '/public/app.html'], (req, res) => sendeApp(res));
app.use(express.static('public', { index: false }));
app.use(express.static('.', { index: false }));

// ── Subdomain-Weiche: App + Landing aus EINEM Repo ────────
// Ein Projekt, ein Deploy, zwei Domains — sauber getrennt über den
// Host-Header (modularer Monolith):
//   tryclevia.sooth-light.com → die App        (app.html)
//   clevia.sooth-light.com    → die Verkaufsseite (landing.html)
// App-Host wird per Env APP_HOST gesetzt (Default 'tryclevia').
// Kein Host-Match → Landing (sicherer Default).
// ── App-HTML mit Runtime-Config ausliefern ────────────────
// Der Server injiziert die öffentlichen Supabase-Zugänge als
// window.__CLEVIA_CONFIG__ direkt nach <head>. Der (obfuskierte) App-Code
// liest das über eine globalThis-Brücke → schaltet OFFLINE_MODUS aus,
// aktiviert Konto/Scanner/Coach. Kein Neubau nötig, wenn sich nur die
// Env-Variablen ändern.
let __appHtmlCache = null;
function appHtmlMitConfig() {
  if (__appHtmlCache) return __appHtmlCache;
  let html = readFileSync('./public/app.html', 'utf-8');
  const cfg = {
    supabaseUrl: config.supabase.url,
    supabaseAnonKey: config.supabase.anonKey,
  };
  const script = '<script>window.__CLEVIA_CONFIG__=' + JSON.stringify(cfg) + ';</script>';
  // Nach dem öffnenden <head> einfügen (vor allen App-Skripten).
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>' + script);
  } else {
    html = script + html; // Fallback: ganz vorne
  }
  // NUR cachen, wenn die Config wirklich Werte hat. Sonst würde ein Serverstart
  // mit noch fehlenden Env-Variablen eine config-lose Version dauerhaft einfrieren
  // (genau das macht Coach/Scanner still tot, obwohl die Env später gesetzt ist).
  if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
    __appHtmlCache = html;
  }
  return html;
}
function sendeApp(res) {
  // KRITISCH: app.html NIEMALS cachen. Sie trägt die Runtime-Config
  // (window.__CLEVIA_CONFIG__) und ändert sich bei jedem Deploy. Ohne diese
  // Header cachen (mobile) Browser die HTML aggressiv → Nutzer sehen nach einem
  // Deploy die ALTE Version ohne/mless Config → Coach/Scanner/Paywall kaputt.
  // Die HTML ist klein; sie bei jedem Aufruf frisch zu liefern kostet nichts.
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.send(appHtmlMitConfig());
}

// Diagnose: zeigt OHNE Geheimnisse, ob die Config-Env-Variablen gesetzt sind.
// Aufruf: /api/v1/config-check  → { url_gesetzt, key_gesetzt, cf_gesetzt }
app.get('/api/v1/config-check', (req, res) => {
  res.json({
    url_gesetzt: !!config.supabase.url,
    key_gesetzt: !!config.supabase.anonKey,
    key_laenge: (config.supabase.anonKey || '').length,
    cf_account_gesetzt: !!config.vision.cfAccountId,
    cf_token_gesetzt: !!config.vision.cfApiToken,
  });
});

const APP_HOST_PREFIX = config.appHost;
function istAppHost(req) {
  return (req.headers.host || '').toLowerCase().startsWith(APP_HOST_PREFIX + '.');
}
// Landing-Seite ausliefern — MIT no-store-Headern. Ohne diese cachen
// (mobile) Browser die HTML aggressiv, und nach einem Deploy sieht der
// Besucher die ALTE Landing (z.B. dunkel statt hell). Dieselbe Härtung
// wie bei der App (sendeApp). Die HTML ist klein; frisch liefern kostet nichts.
function sendeLanding(res) {
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.send(readFileSync('./public/landing.html', 'utf-8'));
}
app.get('/', (req, res) => {
  if (istAppHost(req)) return sendeApp(res);
  sendeLanding(res);
});
app.get('/app', (req, res) => sendeApp(res));

// ── Versionierte API (/api/v1) ────────────────────────────
// Alle Programm-Endpunkte unter einer Version. So kann später
// /api/v2 parallel existieren, ohne Bestehendes zu brechen.
app.use('/api/v1', umweltRouter);   // /api/v1/masten, /api/v1/luft
app.use('/api/v1', visionRouter);   // /api/v1/vision
app.use('/api/v1', billingApiRouter); // /api/v1/waehrung, /api/v1/verify
app.use('/api/v1', barcodeRouter);   // /api/v1/produkt
app.use('/api/v1', sdbRouter);       // /api/v1/sdb

// ── Rückwärtskompatibilität: alte /api/* Pfade ────────────
// Die aktuelle App ruft noch /api/masten etc. (ohne /v1). Damit
// nichts bricht, während die App migriert wird, spiegeln wir die
// alten Pfade auf dieselben Router. Kann entfernt werden, sobald
// die App auf /api/v1 umgestellt ist.
app.use('/api', umweltRouter);
app.use('/api', visionRouter);
app.use('/api', billingApiRouter);
app.use('/api', barcodeRouter);
app.use('/api', sdbRouter);

// ── Nutzer-Seiten (HTML) ──────────────────────────────────
app.use('/', billingPageRouter); // /checkout, /erfolg, /konto

// ── Zentraler Fehler-Handler (MUSS ganz am Ende stehen) ───
// Fängt unbehandelte Fehler aus allen Routen, loggt + meldet sie
// (Sentry falls aktiv) und antwortet sauber statt abzustürzen.
app.use(fehlerHandler);

// ── Start ─────────────────────────────────────────────────
await initMonitoring();
pruefeConfig();
app.listen(config.port, () => {
  log('info', 'clevia gestartet', { port: config.port, env: config.env });
});

export { app }; // für Tests
