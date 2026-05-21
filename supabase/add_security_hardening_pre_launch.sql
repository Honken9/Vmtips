-- ============================================================
-- Säkerhetshärdning inför lansering – konkreta fixar
-- Kör SIST i Supabase SQL Editor (idempotent).
-- ============================================================
--
-- Fixar tre konkreta säkerhetshål som identifierades vid pre-launch-audit:
--
--   1. lock_user_tips saknade auth-check → vem som helst kunde låsa vem som
--      helsts tips från devtools. Nu kräver den att caller är samma user,
--      pool-ägare för p_user_id:s pool, admin eller service-role.
--
--   2. pool_memberships INSERT var öppen för authenticated (RLS=auth.uid()=
--      user_id). Användare kunde lägga till sig själv i vilken liga som
--      helst genom att gissa pool_id. Vi tar bort den direkta INSERT-
--      möjligheten och tvingar alla joins via join_pool_by_code() som
--      validerar invite-koden. Pool-skaparen läggs till via tg_add_owner_member-
--      triggern vid pool-insert.
--
--   3. profile.pool_id kunde självmuteras till valfri pool_id via supabase-js.
--      Trigger blockerar nu byte till en pool användaren inte är medlem i.
--
--   4. lock_predictions_at_kickoff saknade auth-check – nu admin/service-role.
-- ============================================================

-- ── 1) lock_user_tips med auth-check ────────────────────────
create or replace function public.lock_user_tips(p_user_id uuid, p_only_group boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pool_id int;
begin
  -- Tillåt: service-role | egen user | admin | pool-ägaren för p_user_id:s pool
  if v_uid is null then
    null;
  elsif v_uid = p_user_id then
    null;
  elsif exists (select 1 from public.profiles where id = v_uid and is_admin = true) then
    null;
  else
    select pool_id into v_pool_id from public.profiles where id = p_user_id;
    if v_pool_id is null
       or not exists (select 1 from public.pools where id = v_pool_id and created_by = v_uid)
    then
      raise exception 'Inte tillåtet att låsa andra användares tips'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Samma kropp som tidigare
  if p_only_group then
    update public.predictions
    set locked = true, locked_at = now()
    from public.matches m
    where public.predictions.match_id = m.id
      and public.predictions.user_id = p_user_id
      and public.predictions.locked = false
      and m.stage = 'group';
  else
    update public.predictions
    set locked = true, locked_at = now()
    where user_id = p_user_id and locked = false;
  end if;

  if not p_only_group then
    update public.profiles
    set tips_locked = true, tips_locked_at = now()
    where id = p_user_id;
  end if;
end;
$$;

-- ── 2) lock_predictions_at_kickoff: admin eller service-role ─
create or replace function public.lock_predictions_at_kickoff()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  then
    raise exception 'Endast admin får trigga lock_predictions_at_kickoff'
      using errcode = 'insufficient_privilege';
  end if;
  update public.predictions
  set locked = true, locked_at = now()
  where locked = false
    and match_id in (select id from public.matches where kickoff_at <= now());
end;
$$;

-- ── 3) join_pool_by_code: ENDA godkända vägen att gå med i en liga ─
create or replace function public.join_pool_by_code(p_code text)
returns table (pool_id int, pool_name text, was_new boolean)
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

  -- Validera invite-koden
  select id, name into v_pool
  from public.pools
  where invite_code = upper(trim(p_code)) and deleted_at is null;

  if v_pool.id is null then
    raise exception 'Ogiltig invite-kod' using errcode = 'invalid_parameter_value';
  end if;

  -- Lägg till medlemskap idempotent
  insert into public.pool_memberships (pool_id, user_id)
  values (v_pool.id, v_uid)
  on conflict (pool_id, user_id) do nothing;
  v_was_new := found;

  -- Sätt aktiv liga (triggern profiles_block_pool_id_jump tillåter detta
  -- eftersom pool_memberships nu finns)
  update public.profiles set pool_id = v_pool.id where id = v_uid;

  return query select v_pool.id, v_pool.name, v_was_new;
end;
$$;

grant execute on function public.join_pool_by_code(text) to authenticated;

-- ── 4) Trigger: blockera obehörig självmutation av profile.pool_id ─
create or replace function public.prevent_unauthorized_pool_id_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.pool_id is distinct from new.pool_id then
    -- Tillåtna fall:
    -- a) Sätta null (lämna aktiv liga)
    if new.pool_id is null then return new; end if;
    -- b) Service-role (auth.uid() = null) – för cron, admin-server-actions, RPCs
    if auth.uid() is null then return new; end if;
    -- c) Admin
    if exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
      return new;
    end if;
    -- d) Användaren själv – men bara till en pool de redan är medlemmar i
    if auth.uid() = new.id
       and exists (
         select 1 from public.pool_memberships
         where user_id = new.id and pool_id = new.pool_id
       )
    then return new; end if;

    raise exception 'Endast medlem kan välja en liga som aktiv'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_pool_id_jump on public.profiles;
create trigger profiles_block_pool_id_jump
  before update on public.profiles
  for each row execute function public.prevent_unauthorized_pool_id_change();

-- ── 5) Återkalla INSERT på pool_memberships från authenticated ─
-- Endast SECURITY DEFINER-funktioner (join_pool_by_code, tg_add_owner_member)
-- kan nu skapa medlemskap. DELETE behåller vi så folk kan lämna ligor.
drop policy if exists "Egna memberships – insert" on public.pool_memberships;
revoke insert on public.pool_memberships from authenticated;

-- ── 6) Säkerställ tg_add_owner_member (skapar membership när pool skapas) ─
-- Om triggern redan finns från tidigare migration är detta en no-op.
create or replace function public.tg_add_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.pool_memberships (pool_id, user_id)
    values (new.id, new.created_by)
    on conflict (pool_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists pools_add_owner_member on public.pools;
create trigger pools_add_owner_member
  after insert on public.pools
  for each row execute function public.tg_add_owner_member();
