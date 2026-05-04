-- ============================================================
-- Multi-liga: en användare kan vara med i flera ligor samtidigt
-- profiles.pool_id sparas som "aktiv liga" – pool_memberships
-- spårar samtliga medlemskap.
-- Kör i Supabase SQL Editor.
-- ============================================================

create table if not exists public.pool_memberships (
  pool_id int not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

-- Backfill: alla nuvarande profiles.pool_id → motsvarande membership
insert into public.pool_memberships (pool_id, user_id)
  select pool_id, id from public.profiles where pool_id is not null
on conflict do nothing;

create index if not exists idx_pool_memberships_user on public.pool_memberships(user_id);
create index if not exists idx_pool_memberships_pool on public.pool_memberships(pool_id);

alter table public.pool_memberships enable row level security;

-- Egna memberships kan läsas
drop policy if exists "Egna memberships – read" on public.pool_memberships;
create policy "Egna memberships – read" on public.pool_memberships
  for select using (auth.uid() = user_id);

-- Egna memberships kan läggas till (gå med i liga)
drop policy if exists "Egna memberships – insert" on public.pool_memberships;
create policy "Egna memberships – insert" on public.pool_memberships
  for insert with check (auth.uid() = user_id);

-- Egna memberships kan tas bort (lämna liga)
drop policy if exists "Egna memberships – delete" on public.pool_memberships;
create policy "Egna memberships – delete" on public.pool_memberships
  for delete using (auth.uid() = user_id);

-- Admin kan göra allt
drop policy if exists "Admin all memberships" on public.pool_memberships;
create policy "Admin all memberships" on public.pool_memberships
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
