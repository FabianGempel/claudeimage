-- ═══════════════════════════════════════════════════════════
-- clevia geschützte Stoff-Datenbank — der wertvolle "Long Tail"
-- ───────────────────────────────────────────────────────────
-- Die häufigen Allerwelts-Stoffe (Aqua, Standard-Tenside …) bleiben
-- im Client für flüssiges Offline. Der wertvolle, schwer recherchierte
-- Rest lebt HIER auf dem Server, hinter einer API — mit F12 nicht
-- kopierbar. Online holt der Client die Bewertung per Batch, cached sie
-- lokal; offline greift Client-Kern + Muster-Kaskade als Fallback.
--
-- Idempotent (mehrfach ausführbar).
-- ═══════════════════════════════════════════════════════════

-- ── Stoff-Bewertungstabelle ─────────────────────────────────
create table if not exists clevia_stoffe (
  id          bigint generated always as identity primary key,
  norm_key    text unique not null,          -- normalisierter Schlüssel (wie im Client: lower, Bindestrich→Space)
  d           text,                          -- deutscher Name (display)
  i           text,                          -- INCI-Name
  a           text not null,                 -- Ampel: gruen|gelb|rot|grau
  k           text,                          -- Kategorie (Pflanzenöl, Tensid …)
  g           text                           -- Begründung/Grund
);

-- Schneller Lookup per norm_key (das ist die einzige Abfrage-Art).
create index if not exists idx_stoffe_norm on clevia_stoffe (norm_key);

-- ── RLS: nur Lesen erlaubt, nur über die Funktion ───────────
alter table clevia_stoffe enable row level security;

-- Kein direkter Tabellen-Zugriff für anon/authenticated — der Schutz.
-- Zugriff NUR über die SECURITY DEFINER Funktion unten (kontrolliert,
-- kein "select *", kein Bulk-Download der ganzen Tabelle).
drop policy if exists "stoffe_kein_direktzugriff" on clevia_stoffe;
create policy "stoffe_kein_direktzugriff" on clevia_stoffe
  for select using (false);   -- niemand darf die Tabelle direkt lesen

-- ── Batch-Bewertungsfunktion (der API-Eingang) ──────────────
-- Nimmt ein Array normalisierter Schlüssel, gibt NUR die Treffer zurück.
-- SECURITY DEFINER umgeht RLS kontrolliert (Funktion darf lesen, Nutzer nicht).
-- LIMIT verhindert, dass jemand die ganze DB in einem Call abzieht.
create or replace function clevia_bewerte_stoffe(schluessel text[])
returns table (norm_key text, d text, i text, a text, k text, g text)
language sql
security definer
set search_path = public
as $$
  select s.norm_key, s.d, s.i, s.a, s.k, s.g
  from clevia_stoffe s
  where s.norm_key = any(schluessel)
  limit 100;   -- max 100 Stoffe pro Anfrage (ein Produkt hat nie mehr)
$$;

-- Ausführungsrecht für die Funktion (nur die Funktion, nicht die Tabelle).
grant execute on function clevia_bewerte_stoffe(text[]) to anon, authenticated;
revoke all on clevia_stoffe from anon, authenticated;

-- ── Anti-Scraping: Zähler pro Schlüssel (optional, für Monitoring) ──
-- Wenn eine IP/Session ungewöhnlich viele verschiedene Stoffe abfragt,
-- könnte das ein Scraping-Versuch sein. Hier nur die Infrastruktur;
-- Rate-Limiting macht die Edge Function.
create table if not exists clevia_stoff_zugriffe (
  tag         date default current_date,
  anzahl      bigint default 0,
  primary key (tag)
);

comment on function clevia_bewerte_stoffe is
  'Batch-Bewertung: Array von norm_keys rein, nur Treffer raus. Schützt die DB vor Bulk-Download.';

-- ═══════════════════════════════════════════════════════════
-- LERNENDE DATENBANK: Rückschreiben neuer KI-Bewertungen
-- ───────────────────────────────────────────────────────────
-- Wenn die KI (stoff-agent) einen bisher unbekannten Stoff nach clevias
-- Low-Tox-Philosophie bewertet, wird das Ergebnis HIER zentral gespeichert.
-- Damit profitiert JEDER nächste Nutzer sofort — die DB wächst mit jedem
-- Scan aller Nutzer. Das ist der Datengraben: je mehr gescannt wird, desto
-- vollständiger und uneinholbarer wird clevia.
--
-- Sicherheit: Nur die Edge Function (mit service_role) darf schreiben,
-- niemals der Client direkt. Bestehende Einträge (kuratiert) werden NICHT
-- überschrieben — kuratierte Qualität hat Vorrang vor KI.
-- ═══════════════════════════════════════════════════════════

-- Herkunfts-Spalte: unterscheidet kuratierte von KI-gelernten Einträgen.
alter table clevia_stoffe add column if not exists quelle text default 'kuratiert';
alter table clevia_stoffe add column if not exists erstellt timestamptz default now();

-- Einfüge-Funktion: fügt eine neue KI-Bewertung hinzu, NUR wenn der Stoff
-- noch nicht existiert (kuratierte Einträge bleiben unangetastet).
create or replace function clevia_lerne_stoff(
  p_norm_key text, p_d text, p_i text, p_a text, p_k text, p_g text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existiert boolean;
begin
  -- Nur gültige Ampeln akzeptieren (kein Müll in die DB).
  if p_a not in ('gruen','gelb','rot','grün') then
    return false;
  end if;
  -- Schon vorhanden? Dann nichts tun (kuratierte Qualität hat Vorrang).
  select exists(select 1 from clevia_stoffe where norm_key = p_norm_key) into existiert;
  if existiert then
    return false;
  end if;
  -- Neu einfügen, markiert als KI-gelernt.
  insert into clevia_stoffe (norm_key, d, i, a, k, g, quelle)
  values (p_norm_key, p_d, p_i, p_a, p_k, p_g, 'ki')
  on conflict (norm_key) do nothing;
  return true;
end;
$$;

-- NUR service_role (die Edge Function) darf lernen — niemals der Client.
revoke all on function clevia_lerne_stoff(text,text,text,text,text,text) from anon, authenticated;
grant execute on function clevia_lerne_stoff(text,text,text,text,text,text) to service_role;

comment on function clevia_lerne_stoff is
  'Lernende DB: fügt neue KI-Bewertung zentral hinzu (nur wenn Stoff neu). Kuratierte Einträge bleiben unberührt. Nur Edge Function darf schreiben.';
