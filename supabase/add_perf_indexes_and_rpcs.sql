-- ============================================================
-- Prestanda-optimering för 1000+ användare
-- Kör i Supabase SQL Editor (idempotent — säkert att rerunna)
-- ============================================================

-- ─── Index ──────────────────────────────────────────────────
-- Predictions: viktigaste tabellen vid skala (100k+ rader)
create index if not exists idx_predictions_user on public.predictions(user_id);
create index if not exists idx_predictions_match on public.predictions(match_id);
create index if not exists idx_predictions_user_locked on public.predictions(user_id, locked);
create index if not exists idx_predictions_match_locked on public.predictions(match_id, locked);

-- Profiles: pool_id används i RLS-subqueries och leaderboard-filter
create index if not exists idx_profiles_pool on public.profiles(pool_id);
create index if not exists idx_profiles_admin on public.profiles(is_admin) where is_admin = true;

-- Matches: kickoff och stage queriadas ofta
create index if not exists idx_matches_kickoff on public.matches(kickoff_at);
create index if not exists idx_matches_stage on public.matches(stage);
create index if not exists idx_matches_confirmed on public.matches(result_confirmed) where result_confirmed = true;

-- Pool-relationer
create index if not exists idx_pool_memberships_user on public.pool_memberships(user_id);
create index if not exists idx_pool_memberships_pool on public.pool_memberships(pool_id);
create index if not exists idx_pool_payments_pool_user on public.pool_payments(pool_id, user_id);

-- ─── RPC: populärast tipps per kommande match per liga ──────
-- Returnerar top-1 mest tippade resultat per nästkommande N matcher,
-- bara för medlemmar i angiven liga. Server-side aggregering så vi
-- slipper skicka 100k predictions till klienten.
create or replace function public.popular_picks_for_pool(
  p_pool_id int,
  p_limit int default 5
)
returns table (
  match_id int,
  pred_home int,
  pred_away int,
  votes bigint,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with pool_users as (
    select id from public.profiles where pool_id = p_pool_id
  ),
  upcoming as (
    select id from public.matches
    where kickoff_at > now() and result_confirmed = false
    order by kickoff_at
    limit p_limit
  ),
  tallies as (
    select
      pred.match_id,
      pred.pred_home,
      pred.pred_away,
      count(*) as v
    from public.predictions pred
    join pool_users pu on pu.id = pred.user_id
    where pred.match_id in (select id from upcoming)
    group by pred.match_id, pred.pred_home, pred.pred_away
  ),
  ranked as (
    select
      t.match_id,
      t.pred_home,
      t.pred_away,
      t.v,
      sum(t.v) over (partition by t.match_id) as total,
      row_number() over (partition by t.match_id order by t.v desc) as rn
    from tallies t
  )
  select match_id, pred_home, pred_away, v as votes, total
  from ranked
  where rn = 1
  order by match_id;
$$;

-- ─── RPC: dagens vinnare per liga ───────────────────────────
-- Räknar ihop poäng från avslutade matcher som spelades på given datum
-- (Stockholm-tid skickas in som ymd-sträng från klienten).
create or replace function public.daily_winner_for_pool(
  p_pool_id int,
  p_match_ids int[]
)
returns table (
  user_id uuid,
  display_name text,
  points int,
  matches int
)
language sql
stable
security definer
set search_path = public
as $$
  with pool_users as (
    select id, display_name from public.profiles where pool_id = p_pool_id
  ),
  pts as (
    select
      pred.user_id,
      sum(case
        when pred.pred_home = m.home_score and pred.pred_away = m.away_score
          then (select points_exact_score from public.settings where id = 1)
        when sign(pred.pred_home - pred.pred_away) = sign(m.home_score - m.away_score)
          then (select points_correct_result from public.settings where id = 1)
        else 0
      end) as points,
      count(*) as matches
    from public.predictions pred
    join public.matches m on m.id = pred.match_id
    join pool_users pu on pu.id = pred.user_id
    where pred.locked = true
      and m.result_confirmed = true
      and m.id = any(p_match_ids)
    group by pred.user_id
  )
  select pu.id as user_id, pu.display_name, p.points::int, p.matches::int
  from pts p
  join pool_users pu on pu.id = p.user_id
  order by p.points desc
  limit 1;
$$;

-- ─── RPC: räkna ligans medlemmar ────────────────────────────
-- Liten helper som låter UI:t visa "23 medlemmar" snabbt utan att
-- ladda hela profiles-tabellen.
create or replace function public.pool_member_count(p_pool_id int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.profiles where pool_id = p_pool_id;
$$;

-- ─── Permissions: låt authenticated-användare kalla RPC:erna ─
grant execute on function public.popular_picks_for_pool(int, int) to authenticated;
grant execute on function public.daily_winner_for_pool(int, int[]) to authenticated;
grant execute on function public.pool_member_count(int) to authenticated;
