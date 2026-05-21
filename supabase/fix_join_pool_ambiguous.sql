-- ============================================================
-- Fix: "column reference pool_id is ambiguous" i join_pool_by_code
-- Kör i Supabase SQL Editor (idempotent).
-- ============================================================
--
-- Tidigare version hade OUT-params pool_id + pool_name som krockade
-- med kolumnnamn i INSERT...ON CONFLICT och UPDATE-satserna. Här
-- renamar vi OUT-parametrarna till joined_pool_id / joined_pool_name
-- så det inte finns någon tvetydighet alls.
-- ============================================================

-- Drop:a den gamla signaturen om den finns (return-typen ändras)
drop function if exists public.join_pool_by_code(text);

create or replace function public.join_pool_by_code(p_code text)
returns table (joined_pool_id int, joined_pool_name text, joined_was_new boolean)
language plpgsql
security definer
set search_path = public
as $$
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
