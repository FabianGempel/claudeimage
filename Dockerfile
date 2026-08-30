# clevia — Node.js/Express App + Landing + API
# Ein eigenes Dockerfile umgeht Railways Auto-Erkennung vollständig.
# Damit ist der fälschlich als "Deno" erkannte supabase/functions-Ordner
# kein Problem mehr: Railway/Railpack baut exakt nach diesem Rezept,
# es findet keinen Deno-Scan mehr statt.

FROM node:22-slim

# Arbeitsverzeichnis
WORKDIR /app

# Zuerst nur die Manifeste kopieren (bessere Layer-Cache-Nutzung:
# npm ci läuft nur neu, wenn sich die Dependencies ändern)
COPY package.json package-lock.json ./

# Produktions-Dependencies deterministisch installieren.
# --omit=dev spart die Dev-Tools, optionalDependencies (Sentry) bleiben erlaubt.
RUN npm ci --omit=dev

# Restlichen App-Code kopieren (public/, src/ etc.)
# Der supabase/-Ordner wird über .dockerignore ausgeschlossen — er gehört
# auf Supabase, nicht ins App-Image.
COPY . .

# Railway setzt PORT per Env; der Server liest ihn aus process.env.PORT.
# EXPOSE ist nur Dokumentation, der echte Port kommt zur Laufzeit.
EXPOSE 3000

# Produktionsmodus
ENV NODE_ENV=production

# Start
CMD ["node", "src/server.js"]
