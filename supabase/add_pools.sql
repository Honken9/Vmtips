-- ============================================================
-- Pools (tipsligor) – varje användare tävlar bara mot andra i sin pool
-- Kör i Supabase SQL Editor
-- ============================================================

create table if not exists public.pools (
  id serial primary key,
  name text not null,
  description text,
  invite_code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.pools enable row level security;

-- Alla inloggade kan se pool-info (display av poolnamn på tabell osv).
drop policy if exists "Alla kan se pools" on public.pools;
create policy "Alla kan se pools" on public.pools
  for select using (true);

-- Vem som helst inloggad får skapa en pool.
drop policy if exists "Alla auth kan skapa pool" on public.pools;
create policy "Alla auth kan skapa pool" on public.pools
  for insert with check (auth.uid() is not null);

-- Pool-skaparen kan uppdatera sin pool.
drop policy if exists "Skapare kan uppdatera pool" on public.pools;
create policy "Skapare kan uppdatera pool" on public.pools
  for update using (auth.uid() = created_by);

-- Admin kan göra allt.
drop policy if exists "Admin pools all" on public.pools;
create policy "Admin pools all" on public.pools
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Lägg till pool_id på profiles (en pool per användare).
alter table public.profiles
  add column if not exists pool_id int references public.pools(id) on delete set null;

create index if not exists idx_profiles_pool_id on public.profiles(pool_id);

-- Default-pool så befintliga användare inte är "föräldralösa".
insert into public.pools (id, name, description, invite_code)
  values (1, 'Allmänt', 'Standardgrupp – alla deltagare innan pools fanns', 'ALLMNT')
  on conflict (id) do nothing;

-- Återställ sequencen om id 1 redan finns från seed
select setval(
  pg_get_serial_sequence('public.pools', 'id'),
  greatest((select max(id) from public.pools), 1)
);

-- Migrera alla nuvarande användare till default-poolen.
update public.profiles
   set pool_id = 1
 where pool_id is null;

-- ============================================================
-- Uppdatera leaderboard-vyn så pool_id syns
-- ============================================================
-- (Vi vill kunna filtrera leaderboard per pool på frontend.)
drop view if exists public.leaderboard cascade;

create or replace view public.leaderboard as
with bonus_pts as (
  select
    bp.user_id,
    coalesce(
      (case when br.confirmed and br.top_scorer is not null
              and lower(bp.top_scorer) = lower(br.top_scorer)
            then (select points_winner from public.settings limit 1)
            else 0 end), 0
    )
    + coalesce(
      (case when br.confirmed and br.most_yellow_team_id is not null
              and bp.most_yellow_team_id = br.most_yellow_team_id
            then (select points_finalist from public.settings limit 1)
            else 0 end), 0
    )
    + coalesce(
      (case when br.confirmed and br.total_goals is not null and bp.total_goals is not null
              and abs(bp.total_goals - br.total_goals) <= 5
            then greatest(0, 5 - abs(bp.total_goals - br.total_goals))
            else 0 end), 0
    ) as bonus_points
  from public.bonus_predictions bp
  left join public.bonus_results br on br.id = 1
)
select
  p.id as user_id,
  p.display_name,
  p.pool_id,
  p.tips_locked,
  count(pred.id) filter (
    where m.result_confirmed = true and pred.locked = true
  ) as predictions_graded,
  count(pred.id) filter (
    where m.result_confirmed = true and pred.locked = true
    and (
      (pred.pred_home > pred.pred_away and m.home_score > m.away_score) or
      (pred.pred_home = pred.pred_away and m.home_score = m.away_score) or
      (pred.pred_home < pred.pred_away and m.home_score < m.away_score)
    )
  ) as correct_results,
  count(pred.id) filter (
    where m.result_confirmed = true and pred.locked = true
    and pred.pred_home = m.home_score and pred.pred_away = m.away_score
  ) as exact_scores,
  coalesce((select bp.bonus_points from bonus_pts bp where bp.user_id = p.id), 0) as bonus_points,
  coalesce(
    sum(
      case
        when m.result_confirmed = true and pred.locked = true then
          case
            when pred.pred_home = m.home_score and pred.pred_away = m.away_score then
              (select points_exact_score from public.settings limit 1)
            when (
              (pred.pred_home > pred.pred_away and m.home_score > m.away_score) or
              (pred.pred_home = pred.pred_away and m.home_score = m.away_score) or
              (pred.pred_home < pred.pred_away and m.home_score < m.away_score)
            ) then
              (select points_correct_result from public.settings limit 1)
            else 0
          end
        else 0
      end
    ),
  0)
  + coalesce((select bp.bonus_points from bonus_pts bp where bp.user_id = p.id), 0)
  as total_points
from public.profiles p
left join public.predictions pred on pred.user_id = p.id
left join public.matches m on pred.match_id = m.id
group by p.id, p.display_name, p.pool_id, p.tips_locked
order by total_points desc, exact_scores desc, correct_results desc;
