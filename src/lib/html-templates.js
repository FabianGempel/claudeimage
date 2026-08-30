// ═══════════════════════════════════════════════════════════
// HTML-Templates: Fehlerseite, Erfolgsseite, Konto-Formular, Mail.
// Ausgelagert aus dem Server, damit die Route-Logik schlank bleibt.
// ═══════════════════════════════════════════════════════════

import { config } from '../config.js';

const BASE = config.baseUrl;
const SUPPORT = config.supportEmail;

export function fehlerSeite(titel, text) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titel} — clevia</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    background:#0f1211;color:#e8e6e0;padding:24px;}
  .box{max-width:440px;text-align:center;background:#171b19;border:1px solid #2a302d;
    border-radius:20px;padding:40px 32px;}
  .icon{width:56px;height:56px;margin:0 auto 20px;border-radius:50%;
    background:linear-gradient(135deg,#d4886a,#c96f5a);display:flex;align-items:center;
    justify-content:center;font-size:28px;}
  h1{font-size:21px;margin:0 0 12px;font-weight:650;}
  p{font-size:15px;line-height:1.6;color:#a8a5a0;margin:0 0 24px;}
  a{display:inline-block;background:#e8e6e0;color:#0f1211;text-decoration:none;
    padding:13px 26px;border-radius:12px;font-weight:600;font-size:15px;}
</style></head><body>
  <div class="box">
    <div class="icon">!</div>
    <h1>${titel}</h1>
    <p>${text}</p>
    <a href="/">Zurück zur Startseite</a>
  </div>
</body></html>`;
}

export function kontoFormularHTML(fehler) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Abo verwalten — clevia.</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    background:#0f1211;color:#e8e6e0;padding:24px;}
  .box{max-width:420px;width:100%;text-align:center;background:#171b19;border:1px solid #2a302d;
    border-radius:20px;padding:40px 32px;}
  .icon{width:56px;height:56px;margin:0 auto 20px;border-radius:16px;
    background:linear-gradient(135deg,#9FE0C8,#54B296);display:flex;align-items:center;justify-content:center;}
  h1{font-size:21px;margin:0 0 12px;font-weight:650;}
  p{font-size:14.5px;line-height:1.6;color:#a8a5a0;margin:0 0 22px;}
  input{width:100%;box-sizing:border-box;background:#0f1211;border:1px solid #2a302d;
    border-radius:12px;padding:14px 16px;color:#e8e6e0;font-size:15px;margin-bottom:14px;}
  input:focus{outline:none;border-color:#54B296;}
  button{width:100%;background:linear-gradient(135deg,#9FE0C8,#54B296);color:#0f1211;border:none;
    padding:14px;border-radius:12px;font-weight:650;font-size:15px;cursor:pointer;}
  .err{color:#e0917a;font-size:13.5px;margin-bottom:16px;}
  .back{display:block;margin-top:18px;color:#6a726e;text-decoration:none;font-size:13px;}
</style></head><body>
  <div class="box">
    <div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0f1211" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-linecap="round" stroke-dasharray="42 12" transform="rotate(-100 12 12)"/></svg></div>
    <h1>Abo verwalten</h1>
    <p>Gib die E-Mail-Adresse ein, mit der du dein Abo abgeschlossen hast. Du kommst dann zur sicheren Verwaltung, wo du <b>kündigen</b>, deine Zahlungsart ändern und Rechnungen einsehen kannst.</p>
    ${fehler ? `<div class="err">${fehler}</div>` : ''}
    <form method="get" action="/konto">
      <input type="email" name="email" placeholder="deine@email.de" required autofocus>
      <button type="submit">Weiter zur Verwaltung</button>
    </form>
    <a class="back" href="/app">Zurück zur App</a>
  </div>
</body></html>`;
}

export function erfolgsseiteHTML(key, email) {
  const domainKurz = BASE.replace(/^https?:\/\//, '');
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Willkommen bei clevia</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{background:#0A0A0C}
body{font-family:'Instrument Sans',sans-serif;background:#0A0A0C;color:#FAFAFA;min-height:100vh;padding:56px 22px 48px;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:480px;margin:0 auto}
.mark{width:56px;height:56px;margin:0 auto 32px;display:block}
.eyebrow{text-align:center;font-size:12px;letter-spacing:2.5px;text-transform:uppercase;color:#5FB89E;margin-bottom:18px}
h1{font-family:'Instrument Serif',serif;font-size:38px;font-weight:400;text-align:center;line-height:1.15;margin-bottom:16px;letter-spacing:-.5px}
h1 i{font-style:italic;color:#8FD9C0}
.intro{text-align:center;color:#A1A1AA;font-size:16px;margin-bottom:40px;max-width:400px;margin-left:auto;margin-right:auto}
.key-card{background:#121216;border:1px solid #24242A;border-radius:20px;padding:28px 24px;margin-bottom:28px}
.key-card-label{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717A;text-align:center;margin-bottom:14px}
.key{font-family:'SF Mono',ui-monospace,monospace;font-size:23px;font-weight:500;letter-spacing:1.5px;color:#FAFAFA;text-align:center;user-select:all;word-break:break-all;line-height:1.4}
.key-copy{display:block;width:100%;margin-top:18px;background:#1A1A20;border:1px solid #2E2E36;border-radius:11px;padding:13px;color:#FAFAFA;font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:border-color .2s}
.key-copy:active{border-color:#5FB89E}
.key-note{font-size:13px;color:#71717A;text-align:center;margin-top:16px;line-height:1.5}
.divider{height:1px;background:#1C1C22;margin:36px 0}
.section-title{font-family:'Instrument Serif',serif;font-size:22px;font-style:italic;color:#FAFAFA;margin-bottom:20px}
.incl{display:flex;align-items:flex-start;gap:13px;padding:13px 0;border-bottom:1px solid #17171C}
.incl:last-child{border:none}
.incl-dot{width:20px;height:20px;flex-shrink:0;margin-top:2px}
.incl-dot svg{width:20px;height:20px;stroke:#5FB89E;fill:none;stroke-width:1.6}
.incl-txt{font-size:14.5px;color:#D4D4D8}
.incl-txt b{color:#FAFAFA;font-weight:600}
.steps{counter-reset:s}
.step{display:flex;gap:14px;padding:11px 0;align-items:flex-start}
.step-n{width:25px;height:25px;border-radius:50%;border:1px solid #2E2E36;color:#8FD9C0;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step-t{font-size:14.5px;color:#D4D4D8;padding-top:1px}
.step-t b{color:#FAFAFA;font-weight:600}
.open-btn{display:block;background:linear-gradient(135deg,#8FD9C0,#5FB89E);color:#08110D;text-align:center;padding:16px;border-radius:14px;font-weight:600;text-decoration:none;margin:32px 0 8px;font-size:16px;letter-spacing:.2px}
.open-note{text-align:center;font-size:13px;color:#71717A;margin-bottom:36px}
.hint{background:rgba(143,217,192,.06);border:1px solid rgba(143,217,192,.16);border-radius:13px;padding:17px 18px;font-size:14px;color:#A1A1AA;line-height:1.6}
.hint b{color:#8FD9C0;font-weight:600}
.support{text-align:center;font-size:13px;color:#71717A;margin-top:32px}
.support a{color:#8FD9C0;text-decoration:none}
</style></head><body><div class="wrap">
<svg class="mark" viewBox="0 0 40 40" fill="none"><defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8FD9C0"/><stop offset="1" stop-color="#5FB89E"/></linearGradient></defs><path d="M20 6 C20 6, 11 19, 11 26 C11 31, 15 35, 20 35 C25 35, 29 31, 29 26 C29 19, 20 6, 20 6 Z" fill="url(#m)"/></svg>
<div class="eyebrow">Zugang aktiv</div>
<h1>Schön, dass du <i>da bist</i></h1>
<p class="intro">Deine 14 Tage beginnen jetzt — mit vollem Zugang zu allem. Ganz ohne Einschränkung.</p>

<div class="key-card">
  <div class="key-card-label">Dein Lizenzschlüssel</div>
  <div class="key" id="key">${key}</div>
  <button class="key-copy" onclick="navigator.clipboard.writeText('${key}');this.textContent='Kopiert ✓'">Schlüssel kopieren</button>
  <div class="key-note">Bewahre ihn gut auf — du gibst ihn einmal ein, wenn du clevia zum ersten Mal öffnest.</div>
</div>

<a class="open-btn" href="${BASE}/app">clevia. öffnen</a>
<p class="open-note">Öffne die Seite auf deinem Handy und lege sie auf den Startbildschirm</p>

<div class="divider"></div>

<div class="section-title">Was jetzt für dich dabei ist</div>
<div class="incl"><span class="incl-dot"><svg viewBox="0 0 24 24"><path d="M3 9l9-6 9 6v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg></span><div class="incl-txt"><b>Unbegrenzt scannen</b> — per Foto, Barcode oder Eingabe, so oft du willst</div></div>
<div class="incl"><span class="incl-dot"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg></span><div class="incl-txt"><b>KI-Analyse jedes Stoffs</b> — auch unbekannte Inhaltsstoffe, komplett offline</div></div>
<div class="incl"><span class="incl-dot"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></span><div class="incl-txt"><b>Kleidung & Lebensmittel</b> — Schadstoffe in Textilien, Zusatzstoffe im Essen</div></div>
<div class="incl"><span class="incl-dot"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></span><div class="incl-txt"><b>Dein persönlicher Coach</b> — Antworten zu deinen Produkten, mit Quellen</div></div>
<div class="incl"><span class="incl-dot"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></span><div class="incl-txt"><b>Alles bleibt bei dir</b> — deine Scans verlassen dein Gerät nicht</div></div>

<div class="divider"></div>

<div class="section-title">In drei Schritten startklar</div>
<div class="steps">
  <div class="step"><span class="step-n">1</span><div class="step-t">Öffne <b>${domainKurz}</b> auf deinem Handy</div></div>
  <div class="step"><span class="step-n">2</span><div class="step-t">Lege clevia auf den <b>Startbildschirm</b> — die App zeigt dir wie</div></div>
  <div class="step"><span class="step-n">3</span><div class="step-t">Gib deinen <b>Schlüssel</b> ein — und los geht's</div></div>
</div>

<div class="hint" style="margin-top:28px"><b>Ein Tipp zum Start:</b> Hinterlege in den Einstellungen dein Profil — etwa Schwangerschaft oder Kinder. clevia hebt dann genau die Hinweise hervor, die für dich zählen.</div>

<p class="support">Eine Frage? Schreib uns: <a href="mailto:${SUPPORT}">${SUPPORT}</a></p>
</div></body></html>`;
}

export function mailHTML(key, passwortLink) {
  const domainKurz = BASE.replace(/^https?:\/\//, "");
  // Mit Account (passwortLink vorhanden): Konto-Weg. Sonst: reiner Lizenz-Weg.
  const kontoBlock = passwortLink ? `
<p style="color:#A1A1AA;margin-top:24px">Dein persönliches Konto ist bereits angelegt. Setze jetzt dein Passwort — damit sind deine Bewertungen und dein Premium auf allen Geräten gesichert:</p>
<div style="text-align:center;margin:24px 0">
  <a href="${passwortLink}" style="display:inline-block;background:#8FD9C0;color:#0A0A0C;font-weight:bold;text-decoration:none;padding:14px 32px;border-radius:100px;font-size:16px">Passwort festlegen &amp; loslegen</a>
</div>
<p style="color:#71717A;font-size:13px">Nach dem Festlegen bist du automatisch angemeldet — dein Premium ist sofort da, ohne dass du den Schlüssel eingeben musst. Bewahre den Schlüssel oben trotzdem als Sicherung auf.</p>` : `
<p style="color:#A1A1AA">So aktivierst du clevia:</p>
<ol style="color:#A1A1AA;line-height:1.8">
  <li>Öffne <a href="${BASE}/app" style="color:#8FD9C0">${domainKurz}/app</a> auf deinem Handy</li>
  <li>Füge die App zum Startbildschirm hinzu</li>
  <li>Melde dich an oder gib deinen Lizenzschlüssel ein</li>
</ol>`;

  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0A0C;color:#FAFAFA;padding:32px;border-radius:16px">
<h1 style="font-size:24px;color:#8FD9C0">Willkommen bei clevia 🌿</h1>
<p style="color:#A1A1AA">Dein Premium-Zugang ist aktiv. 14 Tage gratis, danach wie gewählt.</p>
<div style="background:#141418;border:1px solid #26262C;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
  <div style="font-size:11px;letter-spacing:2px;color:#8FD9C0">DEIN LIZENZSCHLÜSSEL</div>
  <div style="font-size:22px;font-weight:bold;font-family:monospace;letter-spacing:2px;margin-top:8px">${key}</div>
</div>
${kontoBlock}
<p style="color:#71717A;font-size:13px;margin-top:24px">Fragen? Antworte einfach auf diese Mail.</p>
</div>`;
}
