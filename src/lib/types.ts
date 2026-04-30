export type TournamentMode = 'A' | 'B'
export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final'

export const STAGE_LABELS: Record<Stage, string> = {
  group: 'Gruppspel',
  r32: 'Rond 32',
  r16: 'Åttondelsfinaler',
  qf: 'Kvartsfinaler',
  sf: 'Semifinaler',
  '3rd': 'Bronsmatch',
  final: 'Final',
}

export interface Settings {
  id: number
  tournament_mode: TournamentMode
  mode_a_global_lock: boolean
  points_correct_result: number
  points_exact_score: number
  points_winner: number
  points_finalist: number
  updated_at: string
}

export interface Profile {
  id: string
  display_name: string
  is_admin: boolean
  tips_locked: boolean
  tips_locked_at: string | null
  created_at: string
  avatar_url?: string | null
}

export interface Team {
  id: number
  name: string
  code: string
  flag: string
  group_name: string | null
}

export interface Match {
  id: number
  match_number: number
  stage: Stage
  group_name: string | null
  home_team_id: number | null
  away_team_id: number | null
  home_placeholder: string | null
  away_placeholder: string | null
  kickoff_at: string
  venue: string | null
  home_score: number | null
  away_score: number | null
  result_confirmed: boolean
  home_team?: Team
  away_team?: Team
}

export interface Prediction {
  id: number
  user_id: string
  match_id: number
  pred_home: number
  pred_away: number
  locked: boolean
  locked_at: string | null
  created_at: string
  updated_at: string
}

export interface LeaderboardEntry {
  user_id: string
  display_name: string
  tips_locked: boolean
  predictions_graded: number
  correct_results: number
  exact_scores: number
  bonus_points: number
  total_points: number
}

export interface BonusPrediction {
  user_id: string
  top_scorer: string | null
  most_yellow_team_id: number | null
  total_goals: number | null
  updated_at: string
}

export interface BonusResults {
  id: number
  top_scorer: string | null
  most_yellow_team_id: number | null
  total_goals: number | null
  confirmed: boolean
  updated_at: string
}

export type PredictionResult = 'exact' | 'correct' | 'wrong' | 'pending'

export function calcPredictionResult(
  pred: Pick<Prediction, 'pred_home' | 'pred_away'>,
  match: Pick<Match, 'home_score' | 'away_score' | 'result_confirmed'>
): PredictionResult {
  if (!match.result_confirmed || match.home_score == null || match.away_score == null) {
    return 'pending'
  }
  if (pred.pred_home === match.home_score && pred.pred_away === match.away_score) {
    return 'exact'
  }
  const predSign = Math.sign(pred.pred_home - pred.pred_away)
  const realSign = Math.sign(match.home_score - match.away_score)
  return predSign === realSign ? 'correct' : 'wrong'
}

export function calcPoints(
  result: PredictionResult,
  settings: Pick<Settings, 'points_correct_result' | 'points_exact_score'>
): number {
  if (result === 'exact') return settings.points_exact_score
  if (result === 'correct') return settings.points_correct_result
  return 0
}
