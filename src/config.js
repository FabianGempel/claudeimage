// ═══════════════════════════════════════════════════════════
// Zentrale Konfiguration — EIN Ort für alle Umgebungsvariablen.
// Vorteil (Enterprise-Prinzip): Kein Verstreuen von process.env über
// den ganzen Code. Alles hier, typisiert, mit Defaults und einer
// Validierung beim Start, die fehlende kritische Werte klar meldet.
// ═══════════════════════════════════════════════════════════

export const config = {
  // Umgebung: 'production' | 'staging' | 'development'
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  // Domains
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  appHost: (process.env.APP_HOST || 'tryclevia').toLowerCase(),

  // Mail
  mailFrom: process.env.MAIL_FROM || 'clevia <noreply@sooth.de>',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@sooth.de',

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    preise: {
      eur: {
        monthly:  { price: process.env.STRIPE_PRICE_MONTHLY,       name: 'Monatlich', betrag: '19 €/Monat' },
        yearly:   { price: process.env.STRIPE_PRICE_YEARLY,        name: 'Jährlich',  betrag: '149 €/Jahr' },
        lifetime: { price: process.env.STRIPE_PRICE_LIFETIME,      name: 'Lifetime',  betrag: '499 € einmalig' },
      },
      chf: {
        monthly:  { price: process.env.STRIPE_PRICE_MONTHLY_CHF,   name: 'Monatlich', betrag: 'CHF 19/Monat' },
        yearly:   { price: process.env.STRIPE_PRICE_YEARLY_CHF,    name: 'Jährlich',  betrag: 'CHF 149/Jahr' },
        lifetime: { price: process.env.STRIPE_PRICE_LIFETIME_CHF,  name: 'Lifetime',  betrag: 'CHF 499 einmalig' },
      },
    },
  },

  // Resend (Mail)
  resendApiKey: process.env.RESEND_API_KEY || '',

  // Supabase (Service-Key: NUR serverseitig)
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    // Öffentlicher anon-Key: wird in die App injiziert (Frontend-Auth/Coach/Vision).
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },

  // Vision-KI — Cloudflare Workers AI als Standard, Fremd-Anbieter optional
  vision: {
    cfAccountId: process.env.CF_ACCOUNT_ID || '',
    cfApiToken: process.env.CF_API_TOKEN || '',
    cfModell: process.env.CF_VISION_MODELL || '@cf/meta/llama-4-scout-17b-16e-instruct',
    // Fremd-Override (nur aktiv wenn fremdUrl gesetzt)
    fremdUrl: process.env.VISION_URL || '',
    fremdKey: process.env.VISION_API_KEY || process.env.GEMINI_API_KEY || '',
    fremdModell: process.env.VISION_MODELL || 'gemini-2.5-flash',
  },

  // EMF-Masten & Luft
  openCellIdKey: process.env.OPENCELLID_KEY || '',
  waqiToken: process.env.WAQI_TOKEN || '',

  // Erlaubte CORS-Origins (die getrennte Verkaufsseite darf die API aufrufen)
  corsOrigins: (process.env.CORS_ORIGINS || 'https://clevia.sooth-light.com,https://tryclevia.sooth-light.com')
    .split(',').map(s => s.trim()).filter(Boolean),

  // Monitoring / Fehler-Tracking (optional — nur aktiv wenn DSN gesetzt)
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN || '',
  },
};

// ── Start-Validierung ─────────────────────────────────────
// Meldet fehlende kritische Konfiguration klar in den Logs, ohne den
// Server abstürzen zu lassen (betroffene Features zeigen dann Hinweise).
export function pruefeConfig() {
  const warnungen = [];
  if (!config.stripe.secretKey) warnungen.push('STRIPE_SECRET_KEY fehlt → Checkout zeigt Hinweisseite');
  if (!config.resendApiKey) warnungen.push('RESEND_API_KEY fehlt → keine Bestätigungsmails');
  if (!config.supabase.url || !config.supabase.serviceKey) warnungen.push('SUPABASE_URL/SERVICE_KEY fehlt → Lizenzen in Datei (nicht deploy-fest)');
  const visionOk = (config.vision.cfAccountId && config.vision.cfApiToken) || (config.vision.fremdUrl && config.vision.fremdKey);
  if (!visionOk) warnungen.push('Vision nicht konfiguriert (CF_ACCOUNT_ID+CF_API_TOKEN oder VISION_URL+KEY) → Scanner nutzt Offline-OCR');
  if (!config.waqiToken) warnungen.push('WAQI_TOKEN fehlt → Luftqualität nicht verfügbar');

  if (warnungen.length) {
    console.warn('⚠ Konfigurations-Hinweise:');
    warnungen.forEach(w => console.warn('   •', w));
  }
  console.log(`✓ clevia startet in Umgebung: ${config.env}`);
  return warnungen;
}
