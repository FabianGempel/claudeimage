-- ═══════════════════════════════════════════════════════════
-- clevia — RLS-Sicherheits-Fix (behebt "Table publicly accessible")
-- ───────────────────────────────────────────────────────────
-- Supabase hat gewarnt: mindestens eine Tabelle im public-Schema hat
-- KEINE Row-Level Security → jeder mit der Projekt-URL + anon-Key kann
-- sie lesen/ändern/löschen. Dieses Skript schließt die Lücke UMFASSEND:
--
-- TEIL 1: aktiviert RLS auf JEDER Tabelle im public-Schema (auch auf
--         welchen, die wir übersehen haben oder die manuell angelegt
--         wurden). Nach diesem Schritt ist KEINE Tabelle mehr offen —
--         RLS ohne Policy = komplett gesperrt (sicher per Default).
--
-- TEIL 2: setzt für die bekannten clevia-Tabellen die RICHTIGEN Policies,
--         damit die App normal weiterläuft (Nutzer sehen ihre eigenen
--         Daten, öffentliche Caches bleiben lesbar, geschützte DB bleibt
--         dicht).
--
-- Idempotent — beliebig oft ausführbar. Einfach komplett in den
-- Supabase SQL-Editor einfügen und ausführen.
-- ═══════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════
-- TEIL 1: RLS auf ALLEN public-Tabellen aktivieren (die Absicherung)
-- ═══════════════════════════════════════════════════════════
-- Geht durch jede Tabelle im public-Schema und schaltet RLS an, falls
-- noch nicht geschehen. Das allein behebt die Supabase-Warnung schon,
-- weil RLS-ohne-Policy standardmäßig ALLES sperrt (deny by default).

do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
    raise notice 'RLS aktiviert: %', r.tablename;
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════
-- TEIL 2: Korrekte Policies für die bekannten clevia-Tabellen
-- ═══════════════════════════════════════════════════════════
-- Nach Teil 1 ist alles gesperrt. Jetzt öffnen wir gezielt das, was die
-- App braucht — nach dem Prinzip: so wenig Zugriff wie möglich.

-- ── profile: jeder Nutzer nur sein eigenes Profil ───────────
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='profile') then
    drop policy if exists "profil_select_own" on public.profile;
    drop policy if exists "profil_update_own" on public.profile;
    drop policy if exists "Nutzer sieht eigenes Profil" on public.profile;
    drop policy if exists "Nutzer aktualisiert eigenes Profil" on public.profile;
    create policy "profil_select_own" on public.profile
      for select using (auth.uid() = id);
    create policy "profil_update_own" on public.profile
      for update using (auth.uid() = id);
  end if;
end $$;

-- ── tracker_state: jeder Nutzer nur seine eigenen Daten ─────
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='tracker_state') then
    drop policy if exists "tracker_select_own" on public.tracker_state;
    drop policy if exists "tracker_insert_own" on public.tracker_state;
    drop policy if exists "tracker_update_own" on public.tracker_state;
    drop policy if exists "tracker_delete_own" on public.tracker_state;
    create policy "tracker_select_own" on public.tracker_state for select using (auth.uid() = user_id);
    create policy "tracker_insert_own" on public.tracker_state for insert with check (auth.uid() = user_id);
    create policy "tracker_update_own" on public.tracker_state for update using (auth.uid() = user_id);
    create policy "tracker_delete_own" on public.tracker_state for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ── scan_log: jeder Nutzer nur seine eigenen Scans ──────────
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='scan_log') then
    drop policy if exists "scan_select_own" on public.scan_log;
    drop policy if exists "scan_insert_own" on public.scan_log;
    create policy "scan_select_own" on public.scan_log for select using (auth.uid() = user_id);
    create policy "scan_insert_own" on public.scan_log for insert with check (auth.uid() = user_id);
  end if;
end $$;

-- ── produkt_cache: öffentlich lesbar (Barcode→Produkt), nur Angemeldete schreiben ──
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='produkt_cache') then
    drop policy if exists "cache_select_all" on public.produkt_cache;
    drop policy if exists "cache_insert_auth" on public.produkt_cache;
    drop policy if exists "cache_update_auth" on public.produkt_cache;
    drop policy if exists "Jeder darf Produkt-Cache lesen" on public.produkt_cache;
    drop policy if exists "Angemeldete dürfen Cache befüllen" on public.produkt_cache;
    drop policy if exists "Angemeldete dürfen Trefferzähler erhöhen" on public.produkt_cache;
    create policy "cache_select_all" on public.produkt_cache for select using (true);
    create policy "cache_insert_auth" on public.produkt_cache for insert with check (auth.role() = 'authenticated');
    create policy "cache_update_auth" on public.produkt_cache for update using (auth.role() = 'authenticated');
  end if;
end $$;

-- ── lizenzen: NUR über Funktionen/Service-Role, kein Direktzugriff ──
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='lizenzen') then
    drop policy if exists "lizenzen_kein_direktzugriff" on public.lizenzen;
    -- keine Policy für anon/authenticated = komplett dicht.
    -- Stripe-Webhook & Server nutzen Service-Role (umgeht RLS legitim).
    revoke all on public.lizenzen from anon, authenticated;
  end if;
end $$;

-- ── coach_usage: NUR über coach_hit()-Funktion, kein Direktzugriff ──
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='coach_usage') then
    drop policy if exists "coach_usage_kein_direktzugriff" on public.coach_usage;
    -- kein select/insert/update für Nutzer direkt — nur die SECURITY DEFINER
    -- Funktion coach_hit() schreibt. Damit kann niemand die Zähler manipulieren.
    revoke all on public.coach_usage from anon, authenticated;
  end if;
end $$;

-- ── clevia_stoffe: bleibt komplett dicht (nur über Funktion) ──
-- (schon in stoff_db_schema.sql geregelt, hier zur Sicherheit idempotent)
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='clevia_stoffe') then
    drop policy if exists "stoffe_kein_direktzugriff" on public.clevia_stoffe;
    create policy "stoffe_kein_direktzugriff" on public.clevia_stoffe for select using (false);
    revoke all on public.clevia_stoffe from anon, authenticated;
  end if;
end $$;

-- ── clevia_stoff_zugriffe: Zähler-Tabelle, kein Direktzugriff ──
-- (DAS war eine der offenen Tabellen — hatte kein RLS!)
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='clevia_stoff_zugriffe') then
    revoke all on public.clevia_stoff_zugriffe from anon, authenticated;
    -- keine Policy = dicht. Nur Server/Funktionen (Service-Role) schreiben.
  end if;
end $$;

-- ── masten: öffentlich lesbar (EMF-Funkmasten-Verzeichnis) ──
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='masten') then
    drop policy if exists "masten_select_all" on public.masten;
    drop policy if exists "Jeder darf Masten lesen" on public.masten;
    create policy "masten_select_all" on public.masten for select using (true);
  end if;
end $$;

-- ── push_subscriptions: jeder Nutzer nur seine eigenen ──────
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='push_subscriptions') then
    drop policy if exists "push_own_select" on public.push_subscriptions;
    drop policy if exists "push_own_insert" on public.push_subscriptions;
    drop policy if exists "push_own_update" on public.push_subscriptions;
    drop policy if exists "push_own_delete" on public.push_subscriptions;
    create policy "push_own_select" on public.push_subscriptions for select using (auth.uid() = user_id);
    create policy "push_own_insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
    create policy "push_own_update" on public.push_subscriptions for update using (auth.uid() = user_id);
    create policy "push_own_delete" on public.push_subscriptions for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ── app_errors: Nutzer dürfen nur eigene Fehler melden (insert), kein Lesen ──
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='app_errors') then
    drop policy if exists "errors_insert_own" on public.app_errors;
    create policy "errors_insert_own" on public.app_errors
      for insert with check (auth.uid() = user_id or user_id is null);
    -- kein select für Nutzer — Fehler-Logs sieht nur der Betreiber (Service-Role).
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════
-- TEIL 3: Kontrolle — zeigt den RLS-Status aller Tabellen an
-- ═══════════════════════════════════════════════════════════
-- Nach dem Ausführen sollte JEDE Tabelle rls_enabled = true haben.
-- Wenn hier eine Zeile mit false auftaucht: die ist noch offen.

select
  tablename as tabelle,
  rowsecurity as rls_aktiv,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=t.tablename) as anzahl_policies
from pg_tables t
where schemaname = 'public'
order by rowsecurity asc, tablename;
