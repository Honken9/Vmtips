-- ============================================================
-- Slutspelspoäng: 3p per rätt lag per omgång (fr.o.m. 16-delarna)
-- + 5p för rätt världsmästare. Slutspelsmatchernas siffror ger
-- INTE längre tecken-/exaktpoäng – de styr bara deltagarens träd.
--
-- OBS! Detta ÄNDRAR poängberäkningen. Ta ett snapshot i
-- /admin/snapshots INNAN du kör detta, så kan du jämföra efteråt.
--
-- Poängen materialiseras i user_knockout_points av
-- POST /api/admin/recompute-knockout-points (körs automatiskt
-- efter varje resultat i admin, samt via knapp).
--
-- Idempotent. Kör i Supabase SQL Editor.
-- ============================================================

-- ── 1) Tabell för materialiserade slutspelspoäng ─────────────
create table if not exists public.user_knockout_points (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  points      int not null default 0,
  breakdown   jsonb,
  computed_at timestamptz not null default now()
);

alter table public.user_knockout_points enable row level security;

-- Läsning öppen (samma transparens som predictions – leaderboarden är publik)
drop policy if exists "Alla kan se slutspelspoäng" on public.user_knockout_points;
create policy "Alla kan se slutspelspoäng" on public.user_knockout_points
  for select using (true);
-- Ingen write-policy: endast service-role (recompute-endpointen) skriver.

-- ── 2) Ny leaderboard-vy ─────────────────────────────────────
-- Ändringar mot tidigare version:
--   a) tecken/exakt/graded räknas ENBART på gruppspelsmatcher
--   b) + user_knockout_points.points i totalen
drop view if exists public.leaderboard cascade;

create or replace view public.leaderboard as
with gs as (
  select
    coalesce(points_correct_result, 3)  as pcr,
    coalesce(points_exact_score,    5)  as pes,
    coalesce(points_winner,         10) as pw,
    coalesce(points_finalist,       5)  as pf,
    coalesce(points_total_goals,    5)  as ptg
  from public.settings where id = 1
),
pool_pts as (
  select
    pr.id as user_id,
    coalesce(po.points_correct_result, (select pcr from gs), 3)  as pcr,
    coalesce(po.points_exact_score,    (select pes from gs), 5)  as pes,
    coalesce(po.points_winner,         (select pw  from gs), 10) as pw,
    coalesce(po.points_finalist,       (select pf  from gs), 5)  as pf,
    coalesce(po.points_total_goals,    (select ptg from gs), 5)  as ptg
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
              and abs(bp.total_goals - br.total_goals) < pp.ptg
            then greatest(0, pp.ptg - abs(bp.total_goals - br.total_goals))
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
    where m.result_confirmed = true and pred.locked = true and m.stage = 'group'
  ) as predictions_graded,
  count(pred.id) filter (
    where m.result_confirmed = true and pred.locked = true and m.stage = 'group'
    and (
      (pred.pred_home > pred.pred_away and m.home_score > m.away_score) or
      (pred.pred_home = pred.pred_away and m.home_score = m.away_score) or
      (pred.pred_home < pred.pred_away and m.home_score < m.away_score)
    )
  ) as correct_results,
  count(pred.id) filter (
    where m.result_confirmed = true and pred.locked = true and m.stage = 'group'
    and pred.pred_home = m.home_score and pred.pred_away = m.away_score
  ) as exact_scores,
  coalesce((select bp.bonus_points from bonus_pts bp where bp.user_id = p.id), 0) as bonus_points,
  coalesce(
    sum(
      case
        when m.result_confirmed = true and pred.locked = true and m.stage = 'group' then
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
    ), 0) as group_points,
  coalesce((select ukp.points from public.user_knockout_points ukp where ukp.user_id = p.id), 0) as knockout_points,
  coalesce(
    sum(
      case
        when m.result_confirmed = true and pred.locked = true and m.stage = 'group' then
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
  + coalesce((select ukp.points from public.user_knockout_points ukp where ukp.user_id = p.id), 0)
  as total_points
from public.profiles p
left join public.predictions pred on pred.user_id = p.id
left join public.matches m on pred.match_id = m.id
left join pool_pts pp on pp.user_id = p.id
group by p.id, p.display_name, p.pool_id, p.tips_locked
order by total_points desc, exact_scores desc, correct_results desc;
