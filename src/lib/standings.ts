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

/**
 * Returns the 8 best third-placed teams in ranked order.
 *
 * Ranking per FIFA 2026: points → goal difference → goals for → (fair-play +
 * FIFA ranking, not implemented). If the 8th and 9th place cannot be
 * separated by the implemented criteria, `ambiguous` is true and the caller
 * must surface a warning rather than silently pick one.
 */
export function getBest8Third(
  standings: Record<string, StandingsRow[]>
): { teams: StandingsRow[]; ambiguous: boolean } {
  const thirds = Object.values(standings)
    .map(s => s[2])
    .filter(Boolean)
    .sort((a, b) =>
      b.pts !== a.pts ? b.pts - a.pts :
      b.gd  !== a.gd  ? b.gd  - a.gd  :
      b.gf  !== a.gf  ? b.gf  - a.gf  :
      0
    )
  const teams = thirds.slice(0, 8)
  // Tie between the 8th and 9th placed third: implemented criteria can't
  // separate them. Don't pick silently.
  const eq = (a: StandingsRow, b: StandingsRow) =>
    a.pts === b.pts && a.gd === b.gd && a.gf === b.gf
  const ambiguous = thirds.length > 8 && eq(thirds[7], thirds[8])
  return { teams, ambiguous }
}

// ─── Bracket-definitioner enligt FIFA WC 2026 ────────────────────────────────
// Slot-syntax i R32_BRACKET:
//   '1X' = vinnare grupp X
//   '2X' = tvåa grupp X
//   'TH_1A' = trean som Annex C placerar i match 79 (vinnare A)
//   'TH_1B' = trean som möter vinnare B (match 85), osv.
// Ordningen följer match-nummer 73 → 88.
export const R32_BRACKET: [string, string][] = [
  ['2A', '2B'],     // 73
  ['1E', 'TH_1E'],  // 74
  ['1F', '2C'],     // 75
  ['1C', '2F'],     // 76
  ['1I', 'TH_1I'],  // 77
  ['2E', '2I'],     // 78
  ['1A', 'TH_1A'],  // 79
  ['1L', 'TH_1L'],  // 80
  ['1D', 'TH_1D'],  // 81
  ['1G', 'TH_1G'],  // 82
  ['2K', '2L'],     // 83
  ['1H', '2J'],     // 84
  ['1B', 'TH_1B'],  // 85
  ['1J', '2H'],     // 86
  ['1K', 'TH_1K'],  // 87
  ['2D', '2G'],     // 88
]

// Index i R32_BRACKET (0 = match 73, 15 = match 88).
// 89=V74–V77 → [1,4], 90=V73–V75 → [0,2], 91=V76–V78 → [3,5], 92=V79–V80 → [6,7]
// 93=V83–V84 → [10,11], 94=V81–V82 → [8,9], 95=V86–V88 → [13,15], 96=V85–V87 → [12,14]
export const R16_BRACKET: [number, number][] = [
  [1, 4], [0, 2], [3, 5], [6, 7],
  [10, 11], [8, 9], [13, 15], [12, 14],
]

// Index i R16_BRACKET (0 = match 89, 7 = match 96).
// 97=V89–V90 → [0,1], 98=V93–V94 → [4,5], 99=V91–V92 → [2,3], 100=V95–V96 → [6,7]
export const QF_BRACKET: [number, number][] = [[0, 1], [4, 5], [2, 3], [6, 7]]

// 101=V97–V98, 102=V99–V100
export const SF_BRACKET: [number, number][] = [[0, 1], [2, 3]]
