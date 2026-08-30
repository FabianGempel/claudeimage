// ═══════════════════════════════════════════════════════════
// Monitoring — strukturiertes Logging + Fehler-Tracking.
//
// Zwei Ebenen, beide anbieter-unabhängig:
//  1. Strukturierte Logs (JSON in Produktion) — maschinenlesbar,
//     von jedem Log-Dienst (Railway, Grafana, Datadog) auswertbar.
//  2. Fehler-Tracking via Sentry — NUR aktiv, wenn SENTRY_DSN gesetzt
//     ist. Ohne DSN läuft alles normal weiter (nur Logs). Kein Lock-in:
//     Sentry ist offener Standard, jederzeit austauschbar.
// ═══════════════════════════════════════════════════════════

import { config } from '../config.js';

let sentry = null;

// Sentry nur laden, wenn ein DSN konfiguriert ist (optionaler Baustein).
export async function initMonitoring() {
  const dsn = config.monitoring.sentryDsn;
  if (!dsn) {
    log('info', 'Monitoring: strukturierte Logs aktiv (kein Sentry-DSN → Fehler-Tracking aus)');
    return;
  }
  try {
    // Dynamischer Import: @sentry/node muss nur installiert sein, wenn genutzt.
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: config.env,
      tracesSampleRate: config.env === 'production' ? 0.1 : 1.0,
    });
    sentry = Sentry;
    log('info', 'Monitoring: Sentry-Fehler-Tracking aktiv', { env: config.env });
  } catch (e) {
    log('warn', 'Sentry-Init fehlgeschlagen — läuft mit Logs weiter', { fehler: e.message });
  }
}

// ── Strukturiertes Logging ────────────────────────────────
// In Produktion: JSON (maschinenlesbar). In Entwicklung: lesbar.
export function log(level, message, meta = {}) {
  const eintrag = { level, message, ...meta, zeit: new Date().toISOString() };
  if (config.env === 'production') {
    // JSON-Zeile — Log-Dienste parsen das automatisch.
    console.log(JSON.stringify(eintrag));
  } else {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    console.log(`[${level}] ${message}${metaStr}`);
  }
}

// ── Fehler erfassen ───────────────────────────────────────
// Loggt immer strukturiert; schickt zusätzlich an Sentry, wenn aktiv.
export function erfasseFehler(fehler, kontext = {}) {
  log('error', fehler.message || String(fehler), {
    ...kontext,
    stack: fehler.stack,
  });
  if (sentry) {
    sentry.captureException(fehler, { extra: kontext });
  }
}

// ── Express-Middleware: Request-Logging ───────────────────
// Loggt jeden Request mit Dauer und Status — Basis für Observability.
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const dauer = Date.now() - start;
    // Health-Checks nicht loggen (sonst Log-Spam alle 30s).
    if (req.path === '/health') return;
    log('info', 'request', {
      methode: req.method,
      pfad: req.path,
      status: res.statusCode,
      dauer_ms: dauer,
    });
  });
  next();
}

// ── Express-Middleware: Fehler-Handler (ganz am Ende) ─────
// Fängt unbehandelte Fehler in Routen, loggt + meldet sie,
// und gibt dem Nutzer eine saubere Antwort statt eines Absturzes.
export function fehlerHandler(err, req, res, next) {
  erfasseFehler(err, { methode: req.method, pfad: req.path });
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, grund: 'serverfehler' });
}
