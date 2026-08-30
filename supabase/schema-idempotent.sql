-- ═══════════════════════════════════════════════════════════
-- clevia Supabase Schema — IDEMPOTENT (mehrfach ausführbar)
-- Accounts, Trial, Subscription, License Keys — serverseitig,
-- damit Trial NICHT über localStorage umgangen werden kann.
--
-- Diese Version kann OHNE Fehler erneut ausgeführt werden, auch
-- wenn Teile schon existieren: jede Policy wird vorher gelöscht
-- (drop ... if exists) und neu erstellt. So kein "already exists".
-- ═══════════════════════════════════════════════════════════

-- Profil-Tabelle (erweitert auth.users von Supabase Auth)
create table if not exists public.profile (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  trial_start timestamptz default now(),
  trial_ends timestamptz default (now() + interval '7 days'),
  status text not null default 'trial',
  stripe_customer_id text,
  stripe_subscription_id text,
  license_key text unique,
  plan text,
  profil_tags jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profile enable row level security;

drop policy if exists "Nutzer sieht eigenes Profil" on public.profile;
create policy "Nutzer sieht eigenes Profil"
  on public.profile for select
  using (auth.uid() = id);

drop policy if exists "Nutzer aktualisiert eigenes Profil" on public.profile;
create policy "Nutzer aktualisiert eigenes Profil"
  on public.profile for update
  using (auth.uid() = id);

-- Beim Registrieren automatisch Profil anlegen + Trial starten
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profile (id, email, trial_start, trial_ends, status)
  values (
    new.id,
    new.email,
    now(),
    now() + interval '7 days',
    'trial'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Funktion: Ist der Nutzer aktuell berechtigt? (Trial läuft ODER bezahlt)
create or replace function public.ist_berechtigt(nutzer_id uuid)
returns boolean as $$
declare
  p record;
begin
  select * into p from public.profile where id = nutzer_id;
  if p is null then return false; end if;
  if p.status = 'active' or p.plan = 'lifetime' then return true; end if;
  if p.status = 'trial' and p.trial_ends > now() then return true; end if;
  return false;
end;
$$ language plpgsql security definer;

-- Scan-Zähler für Free-Tier-Limit (serverseitig gegen Umgehung)
create table if not exists public.scan_log (
  id bigserial primary key,
  user_id uuid references auth.users on delete cascade,
  scan_datum date default current_date,
  anzahl int default 1,
  unique(user_id, scan_datum)
);

alter table public.scan_log enable row level security;

drop policy if exists "Nutzer sieht eigene Scans" on public.scan_log;
create policy "Nutzer sieht eigene Scans"
  on public.scan_log for all
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- PRODUKT-CACHE (der Kern des Null-Kosten-Systems)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.produkt_cache (
  schluessel text primary key,
  schluessel_typ text not null default 'barcode',
  produkt_name text,
  typ text,
  zutaten jsonb not null default '[]'::jsonb,
  bio boolean default false,
  quelle text not null default 'vision',
  treffer int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.produkt_cache enable row level security;

drop policy if exists "Jeder darf Produkt-Cache lesen" on public.produkt_cache;
create policy "Jeder darf Produkt-Cache lesen"
  on public.produkt_cache for select
  using (true);

drop policy if exists "Angemeldete dürfen Cache befüllen" on public.produkt_cache;
create policy "Angemeldete dürfen Cache befüllen"
  on public.produkt_cache for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Angemeldete dürfen Trefferzähler erhöhen" on public.produkt_cache;
create policy "Angemeldete dürfen Trefferzähler erhöhen"
  on public.produkt_cache for update
  using (auth.role() = 'authenticated');

create index if not exists idx_cache_treffer on public.produkt_cache(treffer desc);

-- ═══════════════════════════════════════════════════════════
-- LIZENZEN (serverseitiger Kauf-Flow ohne Account-Zwang)
-- DAS ist die Tabelle, die dein Server für /api/v1/verify braucht.
-- ═══════════════════════════════════════════════════════════
create table if not exists public.lizenzen (
  license_key text primary key,
  email text not null,
  stripe_session_id text unique,
  stripe_customer_id text,
  plan text,
  aktiv boolean not null default true,
  created_at timestamptz default now()
);

alter table public.lizenzen enable row level security;

create index if not exists idx_lizenzen_session on public.lizenzen(stripe_session_id);
create index if not exists idx_lizenzen_email on public.lizenzen(email);

-- Account-Verknüpfung: user_id koppelt Lizenz an den Supabase-Auth-Account.
-- So bekommt ein eingeloggter Käufer automatisch Premium (voller Account-Flow).
alter table public.lizenzen add column if not exists user_id uuid references auth.users on delete set null;
create index if not exists idx_lizenzen_user on public.lizenzen(user_id);

-- Nutzer dürfen ihre EIGENE verknüpfte Lizenz lesen (für Auto-Premium nach Login).
drop policy if exists "eigene_lizenz_lesen" on public.lizenzen;
create policy "eigene_lizenz_lesen" on public.lizenzen
  for select using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- PRODUKT-FLYWHEEL: fertige Bewertung + Trend-Auswertung
-- ───────────────────────────────────────────────────────────
-- Erweitert den Produkt-Cache so, dass nicht nur die Zutaten, sondern die
-- FERTIGE Bewertung (Score, Ampel, Analyse) zentral gespeichert wird. Damit
-- muss die App bei einem bekannten Produkt gar nichts mehr berechnen — Barcode
-- rein, fertige Analyse raus. Bei Millionen Nutzern spart das enorm Rechenzeit
-- und macht jeden wiederholten Scan sofort.
--
-- Skaliert: Lookup über Primary Key (O(1) auch bei Millionen Zeilen). Der
-- treffer-Zähler wird zum Trend-Signal — die meistgescannten Produkte und
-- neu auftauchende Problem-Stoffe werden sichtbar, ganz ohne Extra-Tracking.
-- ═══════════════════════════════════════════════════════════

-- Fertige Bewertung mitspeichern (einmal berechnen, für alle nutzen).
alter table public.produkt_cache add column if not exists bewertung jsonb;
alter table public.produkt_cache add column if not exists score int;
alter table public.produkt_cache add column if not exists ampel text;

-- Region (grob, aus dem Barcode-Länderpräfix ableitbar) für regionale Trends.
-- Kein personenbezogenes Tracking — nur "dieses Produkt wird in DACH oft gescannt".
alter table public.produkt_cache add column if not exists region text;

-- Trefferzähler atomar erhöhen (race-condition-sicher bei vielen gleichzeitigen
-- Nutzern). Statt "lesen, +1, schreiben" (was bei Parallelität Treffer verliert)
-- eine atomare Server-Operation.
create or replace function clevia_produkt_treffer(p_schluessel text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.produkt_cache
  set treffer = treffer + 1, updated_at = now()
  where schluessel = p_schluessel;
$$;
grant execute on function clevia_produkt_treffer(text) to anon, authenticated;

-- TREND-VIEW: die meistgescannten Produkte (für Flywheel-Auswertung).
-- Zeigt, welche Produkte gefragt sind — Basis für "beliebte Alternativen"
-- und um zu sehen, wo die Datenqualität am meisten zählt.
create or replace view clevia_top_produkte as
  select schluessel, produkt_name, typ, ampel, score, treffer, region
  from public.produkt_cache
  where treffer > 1
  order by treffer desc
  limit 500;

-- LÜCKEN-VIEW: Produkte, die oft gescannt, aber schlecht bewertet werden konnten
-- (Ampel unbekannt/grau) → genau da lohnt sich Kuratierung. Das Lücken-Flywheel.
create or replace view clevia_daten_luecken as
  select schluessel, produkt_name, treffer
  from public.produkt_cache
  where (ampel is null or ampel = 'grau') and treffer > 2
  order by treffer desc
  limit 200;

-- Index für schnelle Trend-Abfragen bei Wachstum.
create index if not exists idx_cache_region on public.produkt_cache(region) where region is not null;
create index if not exists idx_cache_ampel on public.produkt_cache(ampel) where ampel is not null;

-- ═══════════════════════════════════════════════════════════
-- ALTERNATIVEN-FLYWHEEL: Empfehlungen aus echtem Verhalten
-- ───────────────────────────────────────────────────────────
-- Der stärkste Burggraben: Wenn ein Produkt rot bewertet wird, will der Nutzer
-- eine bessere Alternative. Statt statischer Listen lernt clevia aus echtem
-- Verhalten — welche GRÜNEN Produkte Menschen nach einem roten Scan tatsächlich
-- gescannt haben. "Menschen, die dieses Shampoo mieden, nahmen dieses hier."
-- Das kann keine Datenbank liefern, nur echte Nutzung. Unkopierbar.
--
-- DATENSCHUTZ: Komplett anonym. Kein Nutzer, kein Gerät, keine Session wird
-- gespeichert — nur das MUSTER "von Produkt A (rot) zu Produkt B (grün)" mit
-- einem Zähler. Aggregiert und personenungebunden.
--
-- Skaliert: Zähler-basiert, Primary Key auf dem Produktpaar. Auch bei Millionen
-- Übergängen bleibt die Abfrage O(1) pro Ausgangsprodukt.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.clevia_alternativen (
  -- Das Produktpaar als Schlüssel: von welchem (schlechten) zu welchem (guten).
  von_schluessel   text not null,     -- rotes Ausgangsprodukt (Barcode/phash)
  zu_schluessel    text not null,     -- grünes Ziel-Produkt, das gewählt wurde
  zu_name          text,              -- Anzeigename des besseren Produkts
  zu_ampel         text,              -- Ampel des Ziels (sollte gruen sein)
  anzahl           bigint default 1,  -- wie oft dieser Wechsel beobachtet wurde
  aktualisiert     timestamptz default now(),
  primary key (von_schluessel, zu_schluessel)
);

-- Schneller Lookup: "zeig mir die besten Alternativen für Produkt X".
create index if not exists idx_alt_von on public.clevia_alternativen(von_schluessel, anzahl desc);

alter table public.clevia_alternativen enable row level security;

-- Lesen: jeder darf Alternativen abfragen (das ist der Nutzen).
drop policy if exists "Alternativen lesen" on public.clevia_alternativen;
create policy "Alternativen lesen" on public.clevia_alternativen
  for select using (true);

-- Schreiben nur über die Funktion (kein direktes Insert vom Client — Missbrauchsschutz).
revoke insert, update, delete on public.clevia_alternativen from anon, authenticated;

-- Übergang erfassen: von rotem zu grünem Produkt. Atomar (race-safe), erhöht den
-- Zähler wenn das Paar schon existiert, legt es sonst an.
create or replace function clevia_lerne_alternative(
  p_von text, p_zu text, p_zu_name text, p_zu_ampel text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nur sinnvolle Übergänge: von ≠ zu, und Ziel sollte grün sein.
  if p_von = p_zu or p_von is null or p_zu is null then
    return;
  end if;
  insert into public.clevia_alternativen (von_schluessel, zu_schluessel, zu_name, zu_ampel, anzahl)
  values (p_von, p_zu, p_zu_name, p_zu_ampel, 1)
  on conflict (von_schluessel, zu_schluessel)
  do update set anzahl = clevia_alternativen.anzahl + 1, aktualisiert = now();
end;
$$;
grant execute on function clevia_lerne_alternative(text,text,text,text) to anon, authenticated;

-- Top-Alternativen für ein Produkt abrufen (die am häufigsten gewählten grünen
-- Nachfolger). Das ist die Empfehlung, die der Nutzer sieht.
create or replace function clevia_hole_alternativen(p_von text)
returns table (zu_schluessel text, zu_name text, zu_ampel text, anzahl bigint)
language sql
security definer
set search_path = public
as $$
  select zu_schluessel, zu_name, zu_ampel, anzahl
  from public.clevia_alternativen
  where von_schluessel = p_von and zu_ampel = 'gruen'
  order by anzahl desc
  limit 5;
$$;
grant execute on function clevia_hole_alternativen(text) to anon, authenticated;

comment on table public.clevia_alternativen is
  'Alternativen-Flywheel: anonyme Produkt-Übergänge (rot→grün) mit Zähler. Basis für Empfehlungen aus echtem Verhalten. Kein Personenbezug.';
