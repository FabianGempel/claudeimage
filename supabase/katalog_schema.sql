-- ═══════════════════════════════════════════════════════════
-- clevia Produktkatalog — das wachsende, proprietäre Asset
-- ───────────────────────────────────────────────────────────
-- Jeder Scan reichert diese zentrale Datenbank an. Anders als
-- localStorage (gerätegebunden, flüchtig) entsteht hier ein
-- dauerhaftes, gemeinsames DACH-Produktverzeichnis mit clevias
-- Low-Tox-Bewertungen — genau das Asset, das Yuka (6 Mio. Produkte)
-- so wertvoll macht und das ein Käufer bewertet.
--
-- Idempotent: kann mehrfach ausgeführt werden (DROP POLICY IF EXISTS).
-- ═══════════════════════════════════════════════════════════

-- ── Haupttabelle: Produkte ──────────────────────────────────
create table if not exists clevia_produkte (
  id            bigint generated always as identity primary key,
  barcode       text unique,                    -- EAN/GTIN, wenn per Barcode gescannt (null bei Foto-only)
  produkt       text not null,                  -- Produktname
  marke         text,                           -- Marke/Hersteller
  typ           text default 'unbekannt',       -- kosmetik|lebensmittel|reiniger|supplement|textil
  zutaten       jsonb default '[]'::jsonb,       -- Array der Inhaltsstoffe (exakt wie gelesen)
  ampel         text,                           -- gruen|gelb|rot|unbekannt (clevia-Bewertung)
  anzahl_rot    int default 0,                  -- wie viele rote Stoffe (für Ranking/Alternativen)
  anzahl_gelb   int default 0,
  bio           boolean default false,
  quelle        text,                           -- 'scan'|'barcode'|'openfoodfacts'|... (Herkunft der Daten)
  scan_anzahl   int default 1,                  -- wie oft gescannt (Popularität → wertvoll für Ranking)
  erst_scan     timestamptz default now(),
  letzt_scan    timestamptz default now(),
  -- Für Volltextsuche + Alternativen: normalisierter Name.
  norm_name     text generated always as (lower(regexp_replace(coalesce(produkt,''), '[^a-zA-Z0-9]', '', 'g'))) stored
);

-- Indizes für schnelle Alternativ-Suche (Typ + Ampel) und Barcode-Lookup.
create index if not exists idx_produkte_barcode on clevia_produkte (barcode) where barcode is not null;
create index if not exists idx_produkte_typ_ampel on clevia_produkte (typ, ampel);
create index if not exists idx_produkte_norm on clevia_produkte (norm_name);
-- Für "beste Alternative im Typ": Typ + wenige rote Stoffe zuerst.
create index if not exists idx_produkte_alt on clevia_produkte (typ, anzahl_rot, anzahl_gelb);

-- ── Scan-Historie (optional, pro Nutzer) ────────────────────
-- Zeigt, WAS Nutzer im DACH-Raum scannen → wertvolle Marktdaten.
create table if not exists clevia_scans (
  id          bigint generated always as identity primary key,
  produkt_id  bigint references clevia_produkte(id) on delete set null,
  barcode     text,
  ampel       text,
  user_hash   text,                             -- anonymisierter Nutzer (kein Klarname)
  gescannt_am timestamptz default now()
);
create index if not exists idx_scans_zeit on clevia_scans (gescannt_am desc);
create index if not exists idx_scans_produkt on clevia_scans (produkt_id);

-- ── RLS: öffentlicher Lesezugriff, Schreiben nur über Service-Key ──
alter table clevia_produkte enable row level security;
alter table clevia_scans enable row level security;

drop policy if exists "produkte_lesen" on clevia_produkte;
create policy "produkte_lesen" on clevia_produkte for select using (true);

drop policy if exists "scans_lesen" on clevia_scans;
create policy "scans_lesen" on clevia_scans for select using (true);
-- Schreiben passiert serverseitig mit Service-Key (umgeht RLS), daher keine
-- INSERT-Policy für anon — verhindert Manipulation des Katalogs von außen.

-- ── Funktion: Produkt hinzufügen oder aktualisieren (Upsert) ──
-- Wird bei jedem erfolgreichen Scan serverseitig aufgerufen.
-- Existiert der Barcode schon → scan_anzahl++, letzt_scan aktualisieren.
-- Neu → einfügen. So wächst der Katalog ohne Duplikate.
create or replace function clevia_produkt_upsert(
  p_barcode text,
  p_produkt text,
  p_marke text,
  p_typ text,
  p_zutaten jsonb,
  p_ampel text,
  p_anzahl_rot int,
  p_anzahl_gelb int,
  p_bio boolean,
  p_quelle text
) returns bigint
language plpgsql
security definer
as $$
declare
  v_id bigint;
begin
  if p_barcode is not null and p_barcode <> '' then
    -- Barcode bekannt → per Barcode upserten.
    insert into clevia_produkte (barcode, produkt, marke, typ, zutaten, ampel, anzahl_rot, anzahl_gelb, bio, quelle)
    values (p_barcode, p_produkt, p_marke, p_typ, p_zutaten, p_ampel, p_anzahl_rot, p_anzahl_gelb, p_bio, p_quelle)
    on conflict (barcode) do update set
      -- Nur überschreiben, wenn neue Daten mehr Zutaten haben (bessere Lesung).
      produkt     = case when jsonb_array_length(excluded.zutaten) >= jsonb_array_length(clevia_produkte.zutaten) then excluded.produkt else clevia_produkte.produkt end,
      zutaten     = case when jsonb_array_length(excluded.zutaten) >  jsonb_array_length(clevia_produkte.zutaten) then excluded.zutaten else clevia_produkte.zutaten end,
      ampel       = case when jsonb_array_length(excluded.zutaten) >  jsonb_array_length(clevia_produkte.zutaten) then excluded.ampel else clevia_produkte.ampel end,
      anzahl_rot  = case when jsonb_array_length(excluded.zutaten) >  jsonb_array_length(clevia_produkte.zutaten) then excluded.anzahl_rot else clevia_produkte.anzahl_rot end,
      anzahl_gelb = case when jsonb_array_length(excluded.zutaten) >  jsonb_array_length(clevia_produkte.zutaten) then excluded.anzahl_gelb else clevia_produkte.anzahl_gelb end,
      bio         = clevia_produkte.bio or excluded.bio,
      scan_anzahl = clevia_produkte.scan_anzahl + 1,
      letzt_scan  = now()
    returning id into v_id;
  else
    -- Kein Barcode (Foto-only) → per normalisiertem Namen deduplizieren.
    select id into v_id from clevia_produkte
      where norm_name = lower(regexp_replace(coalesce(p_produkt,''), '[^a-zA-Z0-9]', '', 'g'))
        and typ = p_typ
      limit 1;
    if v_id is not null then
      update clevia_produkte set scan_anzahl = scan_anzahl + 1, letzt_scan = now() where id = v_id;
    else
      insert into clevia_produkte (produkt, marke, typ, zutaten, ampel, anzahl_rot, anzahl_gelb, bio, quelle)
      values (p_produkt, p_marke, p_typ, p_zutaten, p_ampel, p_anzahl_rot, p_anzahl_gelb, p_bio, p_quelle)
      returning id into v_id;
    end if;
  end if;
  return v_id;
end;
$$;

-- ── Funktion: beste Alternative im Katalog finden ───────────
-- Serverseitige Alternativ-Suche (schnell, nutzt Index). Gibt die
-- grünste, sauberste Alternative im selben Typ, die besser ist.
create or replace function clevia_finde_alternative(
  p_typ text,
  p_ampel text,
  p_ausschluss_barcode text default null
) returns setof clevia_produkte
language sql
stable
as $$
  select * from clevia_produkte
  where typ = p_typ
    and (p_ausschluss_barcode is null or barcode is distinct from p_ausschluss_barcode)
    and case p_ampel
      when 'rot'  then ampel in ('gruen','gelb')
      when 'gelb' then ampel = 'gruen'
      else false
    end
  order by
    case ampel when 'gruen' then 0 when 'gelb' then 1 else 2 end,
    anzahl_rot asc,
    anzahl_gelb asc,
    bio desc,
    scan_anzahl desc
  limit 5;
$$;

-- ── View: Katalog-Statistik (fürs Dashboard / Wertnachweis) ──
create or replace view clevia_katalog_stats as
select
  count(*)                                    as produkte_gesamt,
  count(*) filter (where ampel = 'gruen')     as gruen,
  count(*) filter (where ampel = 'gelb')      as gelb,
  count(*) filter (where ampel = 'rot')       as rot,
  count(*) filter (where barcode is not null) as mit_barcode,
  count(distinct typ)                         as produkttypen,
  sum(scan_anzahl)                            as scans_gesamt,
  max(letzt_scan)                             as letzter_scan
from clevia_produkte;
