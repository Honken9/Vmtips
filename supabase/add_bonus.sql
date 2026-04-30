-- ============================================================
-- Bonustips: skytteligavinnare, flest gula kort, totalt antal mål
-- Kör hela filen i Supabase SQL Editor
-- ============================================================

-- 1. Bonustips per användare
CREATE TABLE IF NOT EXISTS bonus_predictions (
  user_id            uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  top_scorer         text,
  most_yellow_team_id integer REFERENCES teams(id) ON DELETE SET NULL,
  total_goals        integer,
  updated_at         timestamptz DEFAULT now()
);

-- 2. Facit (admin fyller i efter turneringen)
CREATE TABLE IF NOT EXISTS bonus_results (
  id                  integer PRIMARY KEY DEFAULT 1,
  top_scorer          text,
  most_yellow_team_id integer REFERENCES teams(id) ON DELETE SET NULL,
  total_goals         integer,
  confirmed           boolean DEFAULT false,
  updated_at          timestamptz DEFAULT now()
);
INSERT INTO bonus_results (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 3. RLS
ALTER TABLE bonus_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_results      ENABLE ROW LEVEL SECURITY;

-- Bonus predictions: använd egna, admin läser alla
DROP POLICY IF EXISTS "Own bonus predictions"  ON bonus_predictions;
DROP POLICY IF EXISTS "Admin read bonus preds" ON bonus_predictions;
CREATE POLICY "Own bonus predictions"  ON bonus_predictions FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "Admin read bonus preds" ON bonus_predictions FOR SELECT USING (is_admin());

-- Bonus results: alla kan läsa, admin kan skriva
DROP POLICY IF EXISTS "Public read bonus results" ON bonus_results;
DROP POLICY IF EXISTS "Admin write bonus results" ON bonus_results;
CREATE POLICY "Public read bonus results" ON bonus_results FOR SELECT USING (true);
CREATE POLICY "Admin write bonus results" ON bonus_results FOR ALL    USING (is_admin());

-- 4. Uppdatera leaderboard-vyn med bonuspoäng
CREATE OR REPLACE VIEW leaderboard AS
WITH match_pts AS (
  SELECT
    pred.user_id,
    COUNT(*)          FILTER (WHERE m.result_confirmed)                                                                        AS predictions_graded,
    COUNT(*)          FILTER (WHERE m.result_confirmed
                                AND SIGN(pred.pred_home - pred.pred_away) = SIGN(m.home_score - m.away_score)
                                AND NOT (pred.pred_home = m.home_score AND pred.pred_away = m.away_score))                     AS correct_results,
    COUNT(*)          FILTER (WHERE m.result_confirmed
                                AND pred.pred_home = m.home_score
                                AND pred.pred_away = m.away_score)                                                             AS exact_scores
  FROM predictions pred
  JOIN matches m ON m.id = pred.match_id
  GROUP BY pred.user_id
),
bonus_pts AS (
  SELECT
    bp.user_id,
    CASE WHEN br.confirmed THEN
      (CASE WHEN bp.top_scorer          IS NOT NULL AND lower(trim(bp.top_scorer))   = lower(trim(br.top_scorer))   THEN 5 ELSE 0 END
     + CASE WHEN bp.most_yellow_team_id IS NOT NULL AND bp.most_yellow_team_id       = br.most_yellow_team_id       THEN 5 ELSE 0 END
     + CASE WHEN bp.total_goals         IS NOT NULL AND bp.total_goals               = br.total_goals               THEN 5 ELSE 0 END)
    ELSE 0 END AS pts
  FROM bonus_predictions bp
  CROSS JOIN bonus_results br
  WHERE br.id = 1
)
SELECT
  p.id                                                                         AS user_id,
  p.display_name,
  p.tips_locked,
  COALESCE(mp.predictions_graded, 0)                                           AS predictions_graded,
  COALESCE(mp.correct_results,    0)                                           AS correct_results,
  COALESCE(mp.exact_scores,       0)                                           AS exact_scores,
  COALESCE(bp.pts,                0)                                           AS bonus_points,
  ( COALESCE(mp.correct_results, 0) * s.points_correct_result
  + COALESCE(mp.exact_scores,    0) * s.points_exact_score
  + COALESCE(bp.pts,             0) )                                          AS total_points
FROM profiles p
CROSS JOIN settings s
LEFT JOIN match_pts mp ON mp.user_id = p.id
LEFT JOIN bonus_pts  bp ON bp.user_id = p.id;
