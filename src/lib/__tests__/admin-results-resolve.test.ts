import { describe, it, expect } from 'vitest'
import { resolveBracket } from '../bracket'
import type { Match, Team } from '../types'

// Speglar admin-flödet: slutspelslag löses upp från BEKRÄFTADE resultat
// (result_confirmed=true + scores) och tom preds-array. Detta är precis vad
// "Fyll i slutspelslag" i /admin/results gör.

const GROUPS = 'ABCDEFGHIJKL'.split('')

function buildTeams(): Team[] {
  const teams: Team[] = []
  let id = 1
  for (const g of GROUPS) {
    for (let n = 1; n <= 4; n++) {
      teams.push({ id: id++, name: `${g}${n}`, code: `${g}${n}`, flag: '🏳️', group_name: g })
    }
  }
  return teams
}

function buildGroupMatches(teams: Team[]): Match[] {
  const matches: Match[] = []
  let id = 1000
  let matchNo = 1
  for (const g of GROUPS) {
    const t = teams.filter(x => x.group_name === g)
    const pairs: [number, number][] = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]
    for (const [a, b] of pairs) {
      matches.push({
        id: id++, match_number: matchNo++, stage: 'group', group_name: g,
        home_team_id: t[a].id, away_team_id: t[b].id,
        home_placeholder: null, away_placeholder: null,
        kickoff_at: '2026-06-11T00:00:00Z', venue: null,
        home_score: null, away_score: null, result_confirmed: false,
      })
    }
  }
  return matches
}

function buildKnockoutMatches(): Match[] {
  const out: Match[] = []
  const make = (id: number, num: number, stage: Match['stage']): Match => ({
    id, match_number: num, stage, group_name: null,
    home_team_id: null, away_team_id: null,
    home_placeholder: null, away_placeholder: null,
    kickoff_at: '2026-06-28T00:00:00Z', venue: null,
    home_score: null, away_score: null, result_confirmed: false,
  })
  for (let n = 73; n <= 88; n++) out.push(make(2000 + n, n, 'r32'))
  for (let n = 89; n <= 96; n++) out.push(make(2000 + n, n, 'r16'))
  for (let n = 97; n <= 100; n++) out.push(make(2000 + n, n, 'qf'))
  for (let n = 101; n <= 102; n++) out.push(make(2000 + n, n, 'sf'))
  out.push(make(2103, 103, '3rd'))
  out.push(make(2104, 104, 'final'))
  return out
}

// Sätt bekräftade gruppresultat: lägre position i gruppnamnet vinner
// (X1 > X2 > X3 > X4). Ger deterministiska 1:or/2:or/3:or.
function confirmGroupResults(matches: Match[], teamById: Map<number, Team>): Match[] {
  return matches.map(m => {
    if (m.stage !== 'group') return m
    const h = teamById.get(m.home_team_id!)!
    const a = teamById.get(m.away_team_id!)!
    const hp = Number(h.name.slice(1))
    const ap = Number(a.name.slice(1))
    const [hs, as_] = hp < ap ? [2, 0] : [0, 2]
    return { ...m, home_score: hs, away_score: as_, result_confirmed: true }
  })
}

describe('Admin-flöde: slutspelslag från bekräftade resultat', () => {
  const teams = buildTeams()
  const teamById = new Map(teams.map(t => [t.id, t]))
  const groupMatches = confirmGroupResults(buildGroupMatches(teams), teamById)
  const allMatches = [...groupMatches, ...buildKnockoutMatches()]

  it('löser upp alla 32 R32-lag när gruppspelet är bekräftat (inga tips)', () => {
    const br = resolveBracket(allMatches, teams, [])
    expect(br.r32Teams.length).toBe(16)
    for (const [h, a] of br.r32Teams) {
      expect(h).not.toBeNull()
      expect(a).not.toBeNull()
    }
    const ids = br.r32Teams.flatMap(([h, a]) => [h!.id, a!.id])
    expect(new Set(ids).size).toBe(32)
  })

  it('gruppvinnarna hamnar i rätt R32-slot (hemmalag)', () => {
    const br = resolveBracket(allMatches, teams, [])
    // match-nr → förväntad gruppvinnare (X1 vinner varje grupp)
    const winnerSlot: Record<number, string> = {
      74: 'E', 75: 'F', 76: 'C', 77: 'I', 79: 'A', 80: 'L',
      81: 'D', 82: 'G', 84: 'H', 85: 'B', 86: 'J', 87: 'K',
    }
    for (const [num, group] of Object.entries(winnerSlot)) {
      const idx = Number(num) - 73
      const [home] = br.r32Teams[idx]
      expect(home!.name).toBe(`${group}1`) // gruppvinnaren
    }
  })

  it('R16 fylls i när R32-resultat bekräftas', () => {
    // Bekräfta match 73 (2A vs 2B) och 75 (1F vs 2C) → match 90 = V73 vs V75
    const br0 = resolveBracket(allMatches, teams, [])
    const [h73, a73] = br0.r32Teams[0] // match 73
    const [h75] = br0.r32Teams[2]      // match 75 (hemma = 1F)

    const withR32 = allMatches.map(m => {
      if (m.match_number === 73) return { ...m, home_team_id: h73!.id, away_team_id: a73!.id, home_score: 1, away_score: 0, result_confirmed: true }
      if (m.match_number === 75) return { ...m, home_score: 2, away_score: 0, result_confirmed: true }
      return m
    })
    const br = resolveBracket(withR32, teams, [])
    const m90idx = br.r16Matches.findIndex(m => m.match_number === 90)
    expect(m90idx).toBeGreaterThanOrEqual(0)
    const [h90, a90] = br.r16Teams[m90idx]
    expect(h90!.id).toBe(h73!.id) // vinnare match 73
    expect(a90!.id).toBe(h75!.id) // vinnare match 75 (1F)
  })
})
