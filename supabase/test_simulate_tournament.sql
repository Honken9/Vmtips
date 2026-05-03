-- ============================================================
-- TEST: Simulera ett VM-mästerskap med 50 deltagare
-- Kör i Supabase SQL Editor. Skriver INGET till databasen.
-- ============================================================
--
-- Scoringregler (samma som leaderboard-vyn):
--   • Rätt tecken (1/X/2)            → 3p
--   • Exakt resultat                 → 5p
--
-- Distribution (försök efterlikna verkliga matchresultat):
--   • home_score / away_score        → mest 0-3 mål, ibland upp till 5
--   • pred_home / pred_away          → samma fördelning per användare
--
-- Använder setseed() så samma resultat reproduceras varje gång.
-- ============================================================

with
  seed as (select setseed(0.42)),

  fake_users as (
    select
      i as user_id,
      'Spelare ' || lpad(i::text, 2, '0') as name
    from generate_series(1, 50) i, seed
  ),

  -- Realistisk poängdistribution: 0-3 mål vanligast, sällan över 4
  sim_results as (
    select
      m.id as match_id,
      (case
         when r1 < 0.18 then 0
         when r1 < 0.45 then 1
         when r1 < 0.72 then 2
         when r1 < 0.88 then 3
         when r1 < 0.96 then 4
         else 5
       end) as home_score,
      (case
         when r2 < 0.18 then 0
         when r2 < 0.45 then 1
         when r2 < 0.72 then 2
         when r2 < 0.88 then 3
         when r2 < 0.96 then 4
         else 5
       end) as away_score
    from public.matches m
    cross join lateral (select random() as r1, random() as r2) r
  ),

  sim_predictions as (
    select
      u.user_id,
      u.name,
      m.id as match_id,
      (case
         when r1 < 0.18 then 0
         when r1 < 0.45 then 1
         when r1 < 0.72 then 2
         when r1 < 0.88 then 3
         when r1 < 0.96 then 4
         else 5
       end) as pred_home,
      (case
         when r2 < 0.18 then 0
         when r2 < 0.45 then 1
         when r2 < 0.72 then 2
         when r2 < 0.88 then 3
         when r2 < 0.96 then 4
         else 5
       end) as pred_away
    from fake_users u
    cross join public.matches m
    cross join lateral (select random() as r1, random() as r2) r
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
      end as exact,
      case
        when (p.pred_home > p.pred_away and r.home_score > r.away_score) or
             (p.pred_home = p.pred_away and r.home_score = r.away_score) or
             (p.pred_home < p.pred_away and r.home_score < r.away_score) then 1
        else 0
      end as correct
    from sim_predictions p
    join sim_results r on r.match_id = p.match_id
  ),

  totals as (
    select
      user_id,
      name,
      sum(pts)     as total_points,
      sum(exact)   as exact_scores,
      sum(correct) as correct_results,
      count(*)     as predictions_graded
    from scored
    group by user_id, name
  )

select
  rank() over (order by total_points desc, exact_scores desc, correct_results desc) as plats,
  name as namn,
  total_points as poäng,
  exact_scores as exakta,
  correct_results as rätt,
  predictions_graded as matcher
from totals
order by total_points desc, exact_scores desc, correct_results desc;
