-- ============================================================
-- Audit-log uppdatering: spara hela raden vid UPDATE så vi kan slå
-- upp kontext (match_id, pool_id, user_id) i UI:n även när bara
-- ett enskilt fält ändrats.
-- Kör i Supabase SQL Editor (idempotent — ersätter befintlig funktion).
-- ============================================================

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb;
  v_record_id text;
begin
  if tg_op = 'DELETE' then
    v_changes := to_jsonb(OLD);
    v_record_id := coalesce(
      (to_jsonb(OLD) ->> 'id'),
      (to_jsonb(OLD) ->> 'user_id'),
      ''
    );
  elsif tg_op = 'INSERT' then
    v_changes := to_jsonb(NEW);
    v_record_id := coalesce(
      (to_jsonb(NEW) ->> 'id'),
      (to_jsonb(NEW) ->> 'user_id'),
      ''
    );
  else  -- UPDATE
    select jsonb_object_agg(
      o.key,
      jsonb_build_object('old', o.value, 'new', n.value)
    )
    into v_changes
    from jsonb_each(to_jsonb(OLD)) o
    join jsonb_each(to_jsonb(NEW)) n using (key)
    where o.value is distinct from n.value
      and o.key not in ('updated_at', 'last_avatar_generated_at');

    if v_changes is null or v_changes = '{}'::jsonb then
      return NEW;
    end if;

    -- Lägg till hela nya raden under _row så UI:n kan slå upp kontext
    v_changes := v_changes || jsonb_build_object('_row', to_jsonb(NEW));

    v_record_id := coalesce(
      (to_jsonb(NEW) ->> 'id'),
      (to_jsonb(NEW) ->> 'user_id'),
      ''
    );
  end if;

  insert into public.audit_log (user_id, action, table_name, record_id, changes)
  values (auth.uid(), lower(tg_op), tg_table_name, v_record_id, v_changes);

  return coalesce(NEW, OLD);
end;
$$;
