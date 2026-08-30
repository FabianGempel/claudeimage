// ═══════════════════════════════════════════════════════════
// clevia Live-Kameraführung
// ───────────────────────────────────────────────────────────
// Eine Kamera, die SIEHT statt nur zu knipsen. Analysiert den
// Live-Videostream in Echtzeit auf:
//   • Schärfe   (ist das Bild scharf oder verwackelt?)
//   • Helligkeit(zu dunkel / zu hell / gut?)
//   • Füllung   (ist das Etikett nah/groß genug im Bild?)
// Gibt dem Nutzer sofortiges Feedback ("näher ran", "ruhig halten",
// "zu dunkel") und löst AUTOMATISCH aus, sobald mehrere Frames in
// Folge gut genug sind. Das ist der Unterschied zwischen "Foto machen
// und hoffen" und "die App führt dich zum perfekten Scan".
//
// Reines Vanilla-JS, keine Abhängigkeiten. Als <script> einbindbar
// oder in die App integrierbar. Nutzt nur Browser-APIs (getUserMedia,
// Canvas) — läuft auf jedem modernen Handy.
// ═══════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  // ─── Bildanalyse: Schärfe ────────────────────────────────
  // Schärfe messen über die Varianz des Laplace-Operators — der
  // Standard-Ansatz. Ein scharfes Bild hat starke Kanten (hohe Varianz),
  // ein verwackeltes ist "glatt" (niedrige Varianz). Wir arbeiten auf
  // einer verkleinerten Graustufen-Version, damit es in Echtzeit läuft.
  function schaerfeWert(gray, w, h) {
    let summe = 0, summeQuadrat = 0, n = 0;
    // Laplace-Kernel (vereinfacht): Mitte*4 minus 4 Nachbarn.
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
        summe += lap;
        summeQuadrat += lap * lap;
        n++;
      }
    }
    if (n === 0) return 0;
    const mittel = summe / n;
    return summeQuadrat / n - mittel * mittel; // Varianz
  }

  // ─── Bildanalyse: Helligkeit ─────────────────────────────
  // Durchschnittshelligkeit (0..255). Sagt uns zu dunkel / zu hell / gut.
  function helligkeitWert(gray) {
    let summe = 0;
    for (let i = 0; i < gray.length; i++) summe += gray[i];
    return summe / gray.length;
  }

  // ─── Bildanalyse: Füllung / Kanten-Dichte im Zentrum ─────
  // Grobe Schätzung, ob im mittleren Bereich "viel los" ist (Text/Etikett
  // nah genug) oder ob es leer/weit weg ist. Wir zählen den Anteil starker
  // Kanten in der Bildmitte. Viel Kante zentral = Etikett füllt das Bild.
  function fuellungWert(gray, w, h) {
    const x0 = Math.floor(w * 0.2), x1 = Math.floor(w * 0.8);
    const y0 = Math.floor(h * 0.2), y1 = Math.floor(h * 0.8);
    let kanten = 0, gesamt = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        const gx = Math.abs(gray[i] - gray[i + 1]);
        const gy = Math.abs(gray[i] - gray[i + w]);
        if (gx + gy > 40) kanten++;   // starke lokale Kante
        gesamt++;
      }
    }
    return gesamt ? kanten / gesamt : 0; // Anteil 0..1
  }

  // RGBA-Pixel zu Graustufen-Array (Luminanz).
  function zuGrau(data, w, h) {
    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      // Standard-Luminanz-Gewichtung.
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return gray;
  }

  // ─── Bewertung: aus den Messwerten ein Urteil + Feedback ──
  // Schwellen sind empirisch für Handy-Kameras gewählt und als Optionen
  // überschreibbar. Gibt zurück: { gut, feedback, details }.
  function bewerte(mess, schwellen) {
    const probleme = [];
    // Reihenfolge = Priorität des Feedbacks (nur EINE Meldung zeigen,
    // die wichtigste zuerst — sonst überfordert es).
    if (mess.helligkeit < schwellen.dunkelMin) probleme.push({ code: 'dunkel', text: 'Zu dunkel – mehr Licht' });
    else if (mess.helligkeit > schwellen.hellMax) probleme.push({ code: 'hell', text: 'Zu hell – Blendung vermeiden' });
    if (mess.fuellung < schwellen.fuellungMin) probleme.push({ code: 'fern', text: 'Näher ran ans Etikett' });
    if (mess.schaerfe < schwellen.schaerfeMin) probleme.push({ code: 'unscharf', text: 'Ruhig halten – noch unscharf' });

    const gut = probleme.length === 0;
    return {
      gut,
      feedback: gut ? 'Perfekt – halt still' : probleme[0].text,
      code: gut ? 'ok' : probleme[0].code,
      details: mess,
    };
  }

  // ═══ Hauptklasse ═════════════════════════════════════════
  class KameraFuehrung {
    constructor(opt = {}) {
      this.opt = Object.assign({
        // Analyse-Auflösung (klein = schnell; reicht für Qualitätsmaße).
        analyseBreite: 160,
        // Wie viele gute Frames in Folge, bevor automatisch ausgelöst wird.
        autoAusloeserFrames: 8,
        // Analyse-Takt in ms (nicht jeden Frame, spart Akku).
        taktMs: 120,
        // Automatisch auslösen, wenn stabil gut?
        autoAusloeser: true,
        schwellen: {
          schaerfeMin: 120,    // Laplace-Varianz
          dunkelMin: 45,       // Ø-Helligkeit
          hellMax: 225,
          fuellungMin: 0.06,   // Anteil Kanten zentral
        },
      }, opt);
      if (opt.schwellen) this.opt.schwellen = Object.assign({}, this.constructor.defaultSchwellen(), opt.schwellen);

      this.video = null;
      this.stream = null;
      this._canvas = document.createElement('canvas');
      this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
      this._timer = null;
      this._guteFramesFolge = 0;
      this._callbacks = { feedback: [], ausgeloest: [], fehler: [] };
      this._laeuft = false;
    }

    static defaultSchwellen() {
      return { schaerfeMin: 120, dunkelMin: 45, hellMax: 225, fuellungMin: 0.06 };
    }

    // Events: 'feedback' (bei jeder Analyse), 'ausgeloest' (Foto fertig), 'fehler'.
    on(event, cb) { if (this._callbacks[event]) this._callbacks[event].push(cb); return this; }
    _emit(event, arg) { (this._callbacks[event] || []).forEach(cb => { try { cb(arg); } catch (e) {} }); }

    // Kamera starten und an ein <video>-Element hängen.
    async start(videoEl) {
      this.video = videoEl;
      try {
        // Rückkamera bevorzugen, hohe Auflösung fürs finale Foto.
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (e) {
        this._emit('fehler', { code: 'kein_zugriff', message: String(e && e.message || e) });
        return false;
      }
      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', 'true'); // iOS: nicht Vollbild erzwingen
      await this.video.play().catch(() => {});
      this._laeuft = true;
      this._guteFramesFolge = 0;
      this._timer = setInterval(() => this._analysiere(), this.opt.taktMs);
      return true;
    }

    _analysiere() {
      if (!this._laeuft || !this.video || this.video.readyState < 2) return;
      const vw = this.video.videoWidth, vh = this.video.videoHeight;
      if (!vw || !vh) return;
      const aw = this.opt.analyseBreite;
      const ah = Math.round(aw * vh / vw);
      this._canvas.width = aw; this._canvas.height = ah;
      this._ctx.drawImage(this.video, 0, 0, aw, ah);
      let img;
      try { img = this._ctx.getImageData(0, 0, aw, ah); } catch (e) { return; }
      const gray = zuGrau(img.data, aw, ah);
      const mess = {
        schaerfe: Math.round(schaerfeWert(gray, aw, ah)),
        helligkeit: Math.round(helligkeitWert(gray)),
        fuellung: Math.round(fuellungWert(gray, aw, ah) * 1000) / 1000,
      };
      const urteil = bewerte(mess, this.opt.schwellen);
      this._emit('feedback', urteil);

      // Auto-Auslöser: mehrere gute Frames in Folge → Foto.
      if (urteil.gut) {
        this._guteFramesFolge++;
        if (this.opt.autoAusloeser && this._guteFramesFolge >= this.opt.autoAusloeserFrames) {
          this.ausloesen();
        }
      } else {
        this._guteFramesFolge = 0;
      }
    }

    // Foto in voller Auflösung aufnehmen und als DataURL liefern.
    ausloesen() {
      if (!this._laeuft || !this.video) return null;
      const vw = this.video.videoWidth, vh = this.video.videoHeight;
      const full = document.createElement('canvas');
      full.width = vw; full.height = vh;
      full.getContext('2d').drawImage(this.video, 0, 0, vw, vh);
      const dataUrl = full.toDataURL('image/jpeg', 0.92);
      this._emit('ausgeloest', { bild: dataUrl, breite: vw, hoehe: vh });
      return dataUrl;
    }

    // Fortschritt bis zum Auto-Auslöser (0..1) — für einen Ring/Balken in der UI.
    get fortschritt() {
      return Math.min(1, this._guteFramesFolge / this.opt.autoAusloeserFrames);
    }

    stop() {
      this._laeuft = false;
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
      if (this.video) { this.video.srcObject = null; }
    }
  }

  // Analyse-Funktionen auch einzeln exportieren (für Tests).
  KameraFuehrung._intern = { schaerfeWert, helligkeitWert, fuellungWert, zuGrau, bewerte };

  global.KameraFuehrung = KameraFuehrung;
})(typeof window !== 'undefined' ? window : globalThis);
