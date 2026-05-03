-- ============================================================
-- TEST: Simulera ett VM-mästerskap med 50 deltagare
-- Kör i Supabase SQL Editor. Skriver INGET till databasen.
-- ============================================================
--
-- Fix från förra versionen: Postgres cache:ade random() i lateral-
-- subqueryn så alla matcher hamnade på samma resultat. Använder nu
-- deterministisk pseudo-slump (modulo + primtal) som varierar per
-- (user_id, match_id) — samma resultat varje körning.
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

  -- Matchresultat – deterministiskt från match.id
  -- Värden i intervallet 0-4 med viss spread tack vare primtals-multipliers
  sim_results as (
    select
      m.id as match_id,
      ((m.id * 7  + 3) % 5)::int as home_score,
      ((m.id * 11 + 5) % 5)::int as away_score
    from public.matches m
  ),

  -- Tippade resultat – deterministiskt från (user_id, match_id)
  sim_predictions as (
    select
      u.user_id,
      u.name,
      m.id as match_id,
      ((u.user_id * 13 + m.id * 17 + 1) % 5)::int as pred_home,
      ((u.user_id * 19 + m.id * 23 + 7) % 5)::int as pred_away
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
