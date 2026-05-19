-- ============================================================
-- Ta bort medlem ur liga (för liga-ägare/admin)
-- Kör i Supabase SQL Editor (idempotent)
-- ============================================================
--
-- RLS tillåter bara global admin att radera andras pool_memberships.
-- Liga-ägaren (pools.created_by) saknar den rätten. Denna SECURITY
-- DEFINER-funktion gör auktoriseringskoll internt och kringgår RLS
-- på ett kontrollerat sätt.
-- ============================================================

create or replace function public.remove_pool_member(p_pool_id int, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Auktorisering: bara liga-ägaren eller global admin
  if not exists (
        select 1 from public.pools
        where id = p_pool_id and created_by = auth.uid()
      )
     and not public.is_admin()
  then
    raise exception 'Endast liga-ägare eller admin får ta bort medlemmar'
      using errcode = 'insufficient_privilege';
  end if;

  -- Skydda ägaren från att tas bort
  if exists (
        select 1 from public.pools
        where id = p_pool_id and created_by = p_user_id
      )
  then
    raise exception 'Kan inte ta bort liga-ägaren – lämna över ägandeskapet först'
      using errcode = 'check_violation';
  end if;

  delete from public.pool_memberships
  where pool_id = p_pool_id and user_id = p_user_id;

  -- Nollställ aktiv liga om medlemmen hade denna som aktiv
  update public.profiles
  set pool_id = null
  where id = p_user_id and pool_id = p_pool_id;
end;
$$;

grant execute on function public.remove_pool_member(int, uuid) to authenticated;
