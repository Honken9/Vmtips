-- ============================================================
-- SÄKERHETS-BASELINE INFÖR LANSERING
-- Kör SIST i Supabase SQL Editor. Idempotent. Tvingar rätt
-- sluttillstånd oavsett vilken ordning tidigare migrationer kördes.
-- ============================================================

-- ── Helpers (säkerställ att de finns) ───────────────────────
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin = true);
$$;

create or replace function public.current_user_pool_id()
returns int language sql security definer set search_path = public stable as $$
  select pool_id from public.profiles where id = auth.uid();
$$;

-- ── RLS påslaget på alla känsliga tabeller ──────────────────
alter table public.predictions        enable row level security;
alter table public.bonus_predictions   enable row level security;
alter table public.profiles            enable row level security;
alter table public.pools               enable row level security;
alter table public.pool_memberships    enable row level security;
alter table public.pool_payments       enable row level security;
alter table public.pool_member_tags    enable row level security;
alter table public.audit_log           enable row level security;
alter table public.team_squad_overrides enable row level security;

-- ── PREDICTIONS: bara egna + samma liga + admin ─────────────
drop policy if exists "Alla kan se tips"                 on public.predictions;
drop policy if exists "Användare kan hantera egna tips"  on public.predictions;
drop policy if exists "Användare hanterar egna tips"     on public.predictions;
drop policy if exists "Own predictions"                  on public.predictions;
drop policy if exists "Admin read predictions"           on public.predictions;
drop policy if exists "Same pool can read predictions"   on public.predictions;

create policy "Own predictions" on public.predictions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Same pool can read predictions" on public.predictions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = predictions.user_id
        and p.pool_id is not null
        and p.pool_id = public.current_user_pool_id()
    )
  );
create policy "Admin read predictions" on public.predictions
  for select using (public.is_admin());

-- ── BONUS_PREDICTIONS: samma princip ────────────────────────
drop policy if exists "Alla kan se bonustips"                 on public.bonus_predictions;
drop policy if exists "Användare kan hantera egna bonustips"  on public.bonus_predictions;
drop policy if exists "Användare hanterar egna bonustips"     on public.bonus_predictions;
drop policy if exists "Own bonus predictions"                 on public.bonus_predictions;
drop policy if exists "Admin read bonus preds"                on public.bonus_predictions;
drop policy if exists "Same pool can read bonus preds"        on public.bonus_predictions;

create policy "Own bonus predictions" on public.bonus_predictions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Same pool can read bonus preds" on public.bonus_predictions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = bonus_predictions.user_id
        and p.pool_id is not null
        and p.pool_id = public.current_user_pool_id()
    )
  );
create policy "Admin read bonus preds" on public.bonus_predictions
  for select using (public.is_admin());

-- ── PROFILES: publik läsning (leaderboard), egen update, admin allt ──
drop policy if exists "Alla kan se profiler"               on public.profiles;
drop policy if exists "Användare kan uppdatera sin profil" on public.profiles;
drop policy if exists "Användare kan skapa sin profil"     on public.profiles;
drop policy if exists "Admin kan hantera profiler"         on public.profiles;
drop policy if exists "Self update profile"                on public.profiles;
drop policy if exists "Admin manage profiles"              on public.profiles;

create policy "Alla kan se profiler" on public.profiles for select using (true);
create policy "Egen profil-uppdatering" on public.profiles
  for update using (auth.uid() = id);
create policy "Skapa egen profil" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Admin hanterar profiler" on public.profiles
  for all using (public.is_admin());

-- Privilege-escalation-skydd (blockerar self is_admin = true)
create or replace function public.prevent_self_admin_grant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_admin is distinct from new.is_admin then
    if auth.uid() is not null
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    then
      raise exception 'Endast admin får ändra is_admin' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_block_admin_self_grant on public.profiles;
create trigger profiles_block_admin_self_grant
  before update on public.profiles
  for each row execute function public.prevent_self_admin_grant();

-- ── POOLS: raderade osynliga för utomstående ────────────────
drop policy if exists "Alla kan se pools"           on public.pools;
drop policy if exists "Alla auth kan skapa pool"    on public.pools;
drop policy if exists "Skapare kan uppdatera pool"  on public.pools;
drop policy if exists "Admin pools all"             on public.pools;

create policy "Se pools" on public.pools for select using (
  deleted_at is null or created_by = auth.uid() or public.is_admin()
);
create policy "Skapa pool" on public.pools
  for insert with check (auth.uid() is not null);
create policy "Skapare uppdaterar pool" on public.pools
  for update using (auth.uid() = created_by);
create policy "Admin pools all" on public.pools
  for all using (public.is_admin());

-- ── AUDIT_LOG: endast admin läser; skrivs via trigger ───────
drop policy if exists "Admin read audit" on public.audit_log;
create policy "Admin read audit" on public.audit_log
  for select using (public.is_admin());

-- ── Verifiering: lista kvarvarande policies ─────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('predictions','bonus_predictions','profiles','pools','audit_log')
order by tablename, policyname;
