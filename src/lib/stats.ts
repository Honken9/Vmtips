import type { Match, Prediction, Settings, LeaderboardEntry, Team } from './types'

// Avgör om en match räknas som "spelad idag" i Stockholm-tid.
export function isMatchOnStockholmDate(kickoffIso: string, ymd: string): boolean {
  const matchDay = new Date(kickoffIso).toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Stockholm',
  })
  return matchDay === ymd
}

export function stockholmToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

function pointsForPrediction(
  pred: { pred_home: number; pred_away: number },
  match: { home_score: number | null; away_score: number | null },
  settings: Pick<Settings, 'points_correct_result' | 'points_exact_score'>
): number {
  if (match.home_score == null || match.away_score == null) return 0
  if (pred.pred_home === match.home_score && pred.pred_away === match.away_score) {
    return settings.points_exact_score
  }
  const predSign = Math.sign(pred.pred_home - pred.pred_away)
  const realSign = Math.sign(match.home_score - match.away_score)
  if (predSign === realSign) return settings.points_correct_result
  return 0
}

export interface DailyWinner {
  user_id: string
  display_name: string
  points: number
  matches: number
}

// Bästa tippare idag (mest poäng från matcher som avgjordes idag).
export function calcDailyWinner(args: {
  matches: Match[]
  predictions: (Prediction & { profile?: { display_name: string } })[]
  profilesById: Map<string, string>  // user_id → display_name
  settings: Pick<Settings, 'points_correct_result' | 'points_exact_score'>
  ymd: string
}): DailyWinner | null {
  const todaysFinishedMatchIds = new Set(
    args.matches
      .filter(m => m.result_confirmed && isMatchOnStockholmDate(m.kickoff_at, args.ymd))
      .map(m => m.id)
  )
  if (todaysFinishedMatchIds.size === 0) return null

  const matchById = new Map(args.matches.map(m => [m.id, m]))
  const perUser = new Map<string, { points: number; matches: number }>()

  for (const p of args.predictions) {
    if (!p.locked) continue
    if (!todaysFinishedMatchIds.has(p.match_id)) continue
    const m = matchById.get(p.match_id)
    if (!m || !m.result_confirmed) continue
    const pts = pointsForPrediction(p, m, args.settings)
    const cur = perUser.get(p.user_id) ?? { points: 0, matches: 0 }
    cur.points += pts
    cur.matches += 1
    perUser.set(p.user_id, cur)
  }

  let best: DailyWinner | null = null
  for (const [user_id, val] of perUser) {
    if (!best || val.points > best.points) {
      best = {
        user_id,
        display_name: args.profilesById.get(user_id) ?? '?',
        points: val.points,
        matches: val.matches,
      }
    }
  }
  return best
}

// Mest exakta resultat (högst exact_scores).
export function topExactScorer(entries: LeaderboardEntry[]): LeaderboardEntry | null {
  if (entries.length === 0) return null
  return [...entries].sort((a, b) => b.exact_scores - a.exact_scores)[0]
}

export interface PopularPick {
  match_id: number
  home_team: Team | null
  away_team: Team | null
  kickoff_at: string
  pred_home: number
  pred_away: number
  votes: number
  total: number
}

// Mest populära tipset per match (för 5 kommande matcher).
export function popularPicks(args: {
  matches: Match[]
  predictions: Prediction[]
  limit?: number
}): PopularPick[] {
  const limit = args.limit ?? 5
  const now = Date.now()
  const upcoming = args.matches
    .filter(m => new Date(m.kickoff_at).getTime() > now && !m.result_confirmed)
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))
    .slice(0, limit)

  const result: PopularPick[] = []
  for (const m of upcoming) {
    const tally = new Map<string, number>()
    let total = 0
    for (const p of args.predictions) {
      if (p.match_id !== m.id) continue
      total++
      const key = `${p.pred_home}-${p.pred_away}`
      tally.set(key, (tally.get(key) ?? 0) + 1)
    }
    if (total === 0) continue
    let bestKey = ''
    let bestVotes = 0
    for (const [k, v] of tally) {
      if (v > bestVotes) {
        bestKey = k
        bestVotes = v
      }
    }
    const [h, a] = bestKey.split('-').map(Number)
    result.push({
      match_id: m.id,
      home_team: m.home_team ?? null,
      away_team: m.away_team ?? null,
      kickoff_at: m.kickoff_at,
      pred_home: h,
      pred_away: a,
      votes: bestVotes,
      total,
    })
  }
  return result
}
