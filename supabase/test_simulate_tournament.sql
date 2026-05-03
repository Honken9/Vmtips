-- ============================================================
-- TEST: Simulera ett VM-mästerskap med 50 deltagare
-- Kör i Supabase SQL Editor. Skriver INGET till databasen.
-- ============================================================
--
-- Använder Postgres hashtext() för deterministisk pseudo-slump per
-- (user, match) — varje spelare får unika prediktioner istället för
-- att hamna i samma ekvivalensklass som modulär aritmetik gav.
--
-- Scoringregler (samma som leaderboard-vyn):
--   • Rätt tecken (1/X/2) → 3p
--   • Exakt resultat      → 5p
-- ============================================================

with

  fake_users as (
    select
      i as user_id,
      'Spelare ' || lpad(i::text, 2, '0') as name
    from generate_series(1, 50) i
  ),

  sim_results as (
    select
      m.id as match_id,
      (abs(hashtext('home:' || m.id::text)) % 5)::int as home_score,
      (abs(hashtext('away:' || m.id::text)) % 5)::int as away_score
    from public.matches m
  ),

  sim_predictions as (
    select
      u.user_id,
      u.name,
      m.id as match_id,
      (abs(hashtext('ph:' || u.user_id::text || ':' || m.id::text)) % 5)::int as pred_home,
      (abs(hashtext('pa:' || u.user_id::text || ':' || m.id::text)) % 5)::int as pred_away
    from fake_users u
    cross join public.matches m
  ),

  scored as (
    select
      p.user_id,
      p.name,
      case
        when p.pred_home = r.home_score and p.pred_away = r.away_score then 5
        when (p.pred_home > p.pred_away and r.home_score > r.away_score) or
             (p.pred_home = p.pred_away and r.home_score = r.away_score) or
             (p.pred_home < p.pred_away and r.home_score < r.away_score) then 3
        else 0
      end as pts,
      case
        when p.pred_home = r.home_score and p.pred_away = r.away_score then 1
        else 0
      end as exact_score,
      case
        when (p.pred_home > p.pred_away and r.home_score > r.away_score) or
             (p.pred_home = p.pred_away and r.home_score = r.away_score) or
             (p.pred_home < p.pred_away and r.home_score < r.away_score) then 1
        else 0
      end as correct_sign
    from sim_predictions p
    join sim_results r on r.match_id = p.match_id
  ),

  totals as (
    select
      user_id,
      name,
      sum(pts)          as total_points,
      sum(exact_score)  as exact_scores,
      sum(correct_sign) as correct_results,
      count(*)          as predictions_graded
    from scored
    group by user_id, name
  )

select
  rank() over (
    order by total_points desc, exact_scores desc, correct_results desc
  ) as plats,
  name as namn,
  total_points as poäng,
  exact_scores as exakta,
  correct_results as rätt,
  predictions_graded as matcher
from totals
order by total_points desc, exact_scores desc, correct_results desc;
