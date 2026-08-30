-- ═══════════════════════════════════════════════════════════
-- clevia — SENDEMASTEN (EMF-Karte)
-- Eigene Masten-Datenbank (Deutschland), damit die EMF-Funktion NICHT von
-- einem Fremd-Server (Overpass) oder einem API-Key (OpenCelliD)
-- abhängt. Einmal aus der offiziellen Bundesnetzagentur-EMF-Datenbank
-- befüllt → für immer die eigene Datenbank, kein Limit, keine Abhängigkeit.
--
-- Umkreissuche via PostGIS (in Supabase bereits eingebaut) mit
-- räumlichem GiST-Index → sofort schnell, auch bei zigtausend Masten.
-- ═══════════════════════════════════════════════════════════

-- PostGIS aktivieren (einmalig; in Supabase vorinstalliert, nur einschalten).
create extension if not exists postgis;

-- ── Masten-Tabelle ────────────────────────────────────────
create table if not exists public.masten (
  id            bigserial primary key,
  -- Stabiler Herkunfts-Schlüssel: 'bnetza/<Standort-ID>' aus der
  -- Bundesnetzagentur-Datenbank, damit ein erneuter Import Duplikate
  -- sauber überschreibt statt doppelt anzulegen.
  osm_id        text unique,
  lat           double precision not null,
  lon           double precision not null,
  -- Anlagentyp aus der Bundesnetzagentur-Quelle: 'Mobilfunk' |
  -- 'Sonstige Funkanlage'. (Konkrete Technik GSM/LTE/5G liefert die Quelle nicht.)
  radio         text default '',
  -- Höhe in Metern (aus height / tower:height), 0 wenn unbekannt.
  hoehe_max     double precision default 0,
  -- Betreiber, falls getaggt (Telekom, Vodafone, Sunrise, A1 …) — rein informativ.
  betreiber     text default '',
  -- PostGIS-Punkt (WGS84, SRID 4326) — wird per Trigger aus lat/lon gefüllt.
  geom          geography(Point, 4326),
  quelle        text not null default 'bundesnetzagentur',
  created_at    timestamptz default now()
);

-- geom automatisch aus lat/lon setzen (bei Insert und Update).
create or replace function public.masten_setze_geom()
returns trigger as $$
begin
  new.geom := ST_SetSRID(ST_MakePoint(new.lon, new.lat), 4326)::geography;
  return new;
end;
$$ language plpgsql;

drop trigger if exists masten_geom_trigger on public.masten;
create trigger masten_geom_trigger
  before insert or update on public.masten
  for each row execute function public.masten_setze_geom();

-- Räumlicher Index → der Kern der Geschwindigkeit.
create index if not exists idx_masten_geom on public.masten using gist (geom);

-- ── Umkreissuche ──────────────────────────────────────────
-- EXAKT die Signatur, die server.js aufruft:
--   supabase.rpc('masten_im_umkreis', { p_lat, p_lon, p_radius_m })
-- Rückgabe passt zu dem, was berechneEmfAusMasten() erwartet:
--   lat, lon, radio, hoehe_max
create or replace function public.masten_im_umkreis(
  p_lat      double precision,
  p_lon      double precision,
  p_radius_m double precision default 1200
)
returns table (
  lat        double precision,
  lon        double precision,
  radio      text,
  hoehe_max  double precision,
  distanz_m  double precision
) as $$
  select
    m.lat,
    m.lon,
    m.radio,
    m.hoehe_max,
    ST_Distance(
      m.geom,
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
    ) as distanz_m
  from public.masten m
  where ST_DWithin(
    m.geom,
    ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
    p_radius_m
  )
  order by distanz_m asc
  limit 200;
$$ language sql stable;

-- ── Row Level Security ────────────────────────────────────
-- Masten sind öffentliche Infrastrukturdaten: jeder darf lesen.
-- Befüllt wird ausschließlich vom Server über den Service-Key
-- (der RLS ohnehin umgeht) — daher keine Insert-Policy nach außen.
alter table public.masten enable row level security;

drop policy if exists "Jeder darf Masten lesen" on public.masten;
create policy "Jeder darf Masten lesen"
  on public.masten for select
  using (true);

-- Fertig. Nächster Schritt: masten_import.mjs ausführen, um die
-- Tabelle mit den Sendemasten aus der Bundesnetzagentur-CSV zu befüllen.
