-- ============================================================
-- Fix: "column reference pool_id is ambiguous" i join_pool_by_code
-- Kör i Supabase SQL Editor (idempotent).
-- ============================================================
--
-- OUT-parametrarna pool_id och pool_name krockade med kolumnnamn
-- i INSERT...ON CONFLICT och UPDATE-satserna. #variable_conflict
-- use_column gör att kolumnerna vinner vid namnkrock.
-- ============================================================

create or replace function public.join_pool_by_code(p_code text)
returns table (pool_id int, pool_name text, was_new boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_pool record;
  v_was_new boolean;
begin
  if v_uid is null then
    raise exception 'Måste vara inloggad';
  end if;

  select id, name into v_pool
  from public.pools
  where invite_code = upper(trim(p_code)) and deleted_at is null;

  if v_pool.id is null then
    raise exception 'Ogiltig invite-kod' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.pool_memberships (pool_id, user_id)
  values (v_pool.id, v_uid)
  on conflict (pool_id, user_id) do nothing;
  v_was_new := found;

  update public.profiles set pool_id = v_pool.id where id = v_uid;

  return query select v_pool.id, v_pool.name, v_was_new;
end;
$$;

grant execute on function public.join_pool_by_code(text) to authenticated;
