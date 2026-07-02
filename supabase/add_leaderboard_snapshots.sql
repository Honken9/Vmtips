-- ============================================================
-- Leaderboard-snapshots: frys en "före"-bild av tabellen så att
-- poängändringar (t.ex. slutspelsregeln) kan jämföras efteråt.
--
-- Helt additivt – rör inga befintliga tabeller eller vyer.
-- Endast admin kan läsa/skriva. Kör i Supabase SQL Editor. Idempotent.
-- ============================================================

create table if not exists public.leaderboard_snapshots (
  id         bigserial primary key,
  label      text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.leaderboard_snapshot_rows (
  snapshot_id        bigint not null references public.leaderboard_snapshots(id) on delete cascade,
  user_id            uuid not null,
  display_name       text not null,
  pool_id            int,
  predictions_graded int not null default 0,
  correct_results    int not null default 0,
  exact_scores       int not null default 0,
  bonus_points       int not null default 0,
  total_points       int not null default 0,
  primary key (snapshot_id, user_id)
);

create index if not exists idx_snapshot_rows_snapshot
  on public.leaderboard_snapshot_rows(snapshot_id);

alter table public.leaderboard_snapshots enable row level security;
alter table public.leaderboard_snapshot_rows enable row level security;

drop policy if exists "Admin read snapshots" on public.leaderboard_snapshots;
create policy "Admin read snapshots" on public.leaderboard_snapshots
  for select using (public.is_admin());

drop policy if exists "Admin write snapshots" on public.leaderboard_snapshots;
create policy "Admin write snapshots" on public.leaderboard_snapshots
  for all using (public.is_admin());

drop policy if exists "Admin read snapshot rows" on public.leaderboard_snapshot_rows;
create policy "Admin read snapshot rows" on public.leaderboard_snapshot_rows
  for select using (public.is_admin());

drop policy if exists "Admin write snapshot rows" on public.leaderboard_snapshot_rows;
create policy "Admin write snapshot rows" on public.leaderboard_snapshot_rows
  for all using (public.is_admin());
