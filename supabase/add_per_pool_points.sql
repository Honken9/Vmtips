-- ============================================================
-- Poängsystem per liga (med global settings som fallback)
-- Kör i Supabase SQL Editor (idempotent)
-- ============================================================
--
-- Lägger nullbara poäng-kolumner på pools. Är de null används den
-- globala settings-raden (id=1), och i sista hand hårdkodade default.
-- Leaderboard-vyn och daily_winner_for_pool räknar nu per spelares liga.
-- ============================================================

alter table public.pools
  add column if not exists points_correct_result int,
  add column if not exists points_exact_score    int,
  add column if not exists points_winner          int,
  add column if not exists points_finalist        int;

-- ── Leaderboard-vy med per-liga-poäng ───────────────────────
drop view if exists public.leaderboard cascade;

create or replace view public.leaderboard as
with gs as (
  select
    coalesce(points_correct_result, 3) as pcr,
    coalesce(points_exact_score,    5) as pes,
    coalesce(points_winner,         10) as pw,
    coalesce(points_finalist,       5) as pf
  from public.settings where id = 1
),
pool_pts as (
  select
    pr.id as user_id,
    coalesce(po.points_correct_result, (select pcr from gs), 3) as pcr,
    coalesce(po.points_exact_score,    (select pes from gs), 5) as pes,
    coalesce(po.points_winner,         (select pw  from gs), 10) as pw,
    coalesce(po.points_finalist,       (select pf  from gs), 5) as pf
  from public.profiles pr
  left join public.pools po on po.id = pr.pool_id
),
bonus_pts as (
  select
    bp.user_id,
    coalesce(
      (case when br.confirmed and br.top_scorer is not null
              and lower(bp.top_scorer) = lower(br.top_scorer)
            then pp.pw else 0 end), 0)
    + coalesce(
      (case when br.confirmed and br.most_yellow_team_id is not null
              and bp.most_yellow_team_id = br.most_yellow_team_id
            then pp.pf else 0 end), 0)
    + coalesce(
      (case when br.confirmed and br.total_goals is not null and bp.total_goals is not null
              and abs(bp.total_goals - br.total_goals) <= 5
            then greatest(0, 5 - abs(bp.total_goals - br.total_goals))
            else 0 end), 0
    ) as bonus_points
  from public.bonus_predictions bp
  left join public.bonus_results br on br.id = 1
  left join pool_pts pp on pp.user_id = bp.user_id
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
            when pred.pred_home = m.home_score and pred.pred_away = m.away_score then pp.pes
            when (
              (pred.pred_home > pred.pred_away and m.home_score > m.away_score) or
              (pred.pred_home = pred.pred_away and m.home_score = m.away_score) or
              (pred.pred_home < pred.pred_away and m.home_score < m.away_score)
            ) then pp.pcr
            else 0
          end
        else 0
      end
    ), 0)
  + coalesce((select bp.bonus_points from bonus_pts bp where bp.user_id = p.id), 0)
  as total_points
from public.profiles p
left join public.predictions pred on pred.user_id = p.id
left join public.matches m on pred.match_id = m.id
left join pool_pts pp on pp.user_id = p.id
group by p.id, p.display_name, p.pool_id, p.tips_locked, pp.pcr, pp.pes
order by total_points desc, exact_scores desc, correct_results desc;

-- ── daily_winner_for_pool med per-liga-poäng ────────────────
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
  with cfg as (
    select
      coalesce(po.points_correct_result,
        (select coalesce(points_correct_result,3) from public.settings where id=1), 3) as pcr,
      coalesce(po.points_exact_score,
        (select coalesce(points_exact_score,5)   from public.settings where id=1), 5) as pes
    from public.pools po where po.id = p_pool_id
  ),
  pool_users as (
    select id, display_name from public.profiles where pool_id = p_pool_id
  ),
  pts as (
    select
      pred.user_id,
      sum(case
        when pred.pred_home = m.home_score and pred.pred_away = m.away_score
          then (select pes from cfg)
        when sign(pred.pred_home - pred.pred_away) = sign(m.home_score - m.away_score)
          then (select pcr from cfg)
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
  select pu.id, pu.display_name, p.points::int, p.matches::int
  from pts p join pool_users pu on pu.id = p.user_id
  order by p.points desc
  limit 1;
$$;

grant execute on function public.daily_winner_for_pool(int, int[]) to authenticated;
