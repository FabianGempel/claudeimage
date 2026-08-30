-- sooth+ Coach-Limit v2: 5 Nutzer-Fragen/Tag + Gesamt-Schutz
-- ERSETZT die v1-Funktion. Einmal im SQL-Editor ausführen (auch wenn v1 schon lief).

alter table coach_usage add column if not exists chat_count int not null default 0;

drop function if exists coach_hit();

create or replace function coach_hit(is_chat boolean default false)
returns table(total int, chat int)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t int; c int;
begin
  if uid is null then
    return query select -1, -1; return;
  end if;
  insert into coach_usage (user_id, day, count, chat_count)
  values (uid, current_date, 1, case when is_chat then 1 else 0 end)
  on conflict (user_id, day)
  do update set count = coach_usage.count + 1,
                chat_count = coach_usage.chat_count + case when is_chat then 1 else 0 end
  returning coach_usage.count, coach_usage.chat_count into t, c;
  return query select t, c;
end;
$$;

grant execute on function coach_hit(boolean) to authenticated;
