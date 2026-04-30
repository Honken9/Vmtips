import { Match, Team } from './types'

export interface StandingsRow {
  team: Team
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  pts: number
  position: number
  group: string
}

export function calcGroupStandings(
  groupTeams: Team[],
  groupMatches: Match[],
  preds: Record<number, { home: string; away: string }>
): StandingsRow[] {
  const map: Record<number, {
    team: Team; group: string
    played: number; won: number; drawn: number; lost: number
    gf: number; ga: number; pts: number
  }> = {}

  groupTeams.forEach(t => {
    map[t.id] = { team: t, group: t.group_name ?? '', played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 }
  })

  groupMatches.forEach(m => {
    if (!m.home_team_id || !m.away_team_id) return
    let hg: number, ag: number
    if (m.result_confirmed && m.home_score != null && m.away_score != null) {
      hg = m.home_score; ag = m.away_score
    } else {
      const p = preds[m.id]
      if (!p || p.home === '' || p.away === '') return
      hg = parseInt(p.home); ag = parseInt(p.away)
      if (isNaN(hg) || isNaN(ag)) return
    }
    const h = map[m.home_team_id], a = map[m.away_team_id]
    if (!h || !a) return
    h.played++; a.played++
    h.gf += hg; h.ga += ag
    a.gf += ag; a.ga += hg
    if (hg > ag)        { h.won++;  a.lost++; h.pts += 3 }
    else if (hg === ag) { h.drawn++; a.drawn++; h.pts++;  a.pts++ }
    else                { a.won++;  h.lost++; a.pts += 3 }
  })

  return Object.values(map)
    .map(r => ({ ...r, gd: r.gf - r.ga, position: 0 }))
    .sort((a, b) =>
      b.pts !== a.pts ? b.pts - a.pts :
      b.gd  !== a.gd  ? b.gd  - a.gd  :
      b.gf  !== a.gf  ? b.gf  - a.gf  :
      a.team.name.localeCompare(b.team.name)
    )
    .map((r, i) => ({ ...r, position: i + 1 }))
}

export function calcAllGroupStandings(
  teams: Team[],
  groupMatches: Match[],
  preds: Record<number, { home: string; away: string }>
): Record<string, StandingsRow[]> {
  const groups = [...new Set(teams.map(t => t.group_name).filter(Boolean))] as string[]
  return Object.fromEntries(groups.map(g => [
    g,
    calcGroupStandings(
      teams.filter(t => t.group_name === g),
      groupMatches.filter(m => m.group_name === g),
      preds
    )
  ]))
}

export function getBest8Third(standings: Record<string, StandingsRow[]>): StandingsRow[] {
  return Object.values(standings)
    .map(s => s[2]).filter(Boolean)
    .sort((a, b) =>
      b.pts !== a.pts ? b.pts - a.pts :
      b.gd  !== a.gd  ? b.gd  - a.gd  :
      b.gf  !== a.gf  ? b.gf  - a.gf  :
      a.team.name.localeCompare(b.team.name)
    )
    .slice(0, 8)
}

// ─── Bracket-definitioner ──────────────────────────────────────────────────────
// '1X' = vinnare grupp X, '2X' = tvåa, 'T3_N' = Nth bästa trea
export const R32_BRACKET: [string, string][] = [
  ['1A', '2B'], ['1C', '2D'], ['1E', '2F'], ['1G', '2H'],
  ['1I', '2J'], ['1K', '2L'], ['1B', '2A'], ['1D', '2C'],
  ['1F', '2E'], ['1H', '2G'], ['1J', '2I'], ['1L', '2K'],
  ['T3_1', 'T3_5'], ['T3_2', 'T3_6'], ['T3_3', 'T3_7'], ['T3_4', 'T3_8'],
]

// [hemmaindex i föregående runda, bortaindex]
export const R16_BRACKET: [number, number][] = [
  [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11], [12, 13], [14, 15],
]
export const QF_BRACKET: [number, number][] = [[0, 1], [2, 3], [4, 5], [6, 7]]
export const SF_BRACKET: [number, number][] = [[0, 1], [2, 3]]
