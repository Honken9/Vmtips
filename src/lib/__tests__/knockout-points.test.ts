import { describe, it, expect } from 'vitest'
import { calcKnockoutPoints, TEAM_POINTS_PER_ROUND, CHAMPION_POINTS } from '../knockout-points'
import type { Match, Team, Prediction } from '../types'

// Samma syntetiska VM som övriga bracket-tester: 12 grupper × 4 lag,
// X1 vinner alltid över X2 osv. i verkligheten.

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

function confirmGroupResults(matches: Match[], teamById: Map<number, Team>): Match[] {
  return matches.map(m => {
    if (m.stage !== 'group') return m
    const h = teamById.get(m.home_team_id!)!
    const a = teamById.get(m.away_team_id!)!
    const [hs, as_] = Number(h.name.slice(1)) < Number(a.name.slice(1)) ? [2, 0] : [0, 2]
    return { ...m, home_score: hs, away_score: as_, result_confirmed: true }
  })
}

// Grupptips som matchar verkligheten exakt (X1 vinner)
function conformistGroupPreds(groupMatches: Match[], teamById: Map<number, Team>, userId: string): Prediction[] {
  return groupMatches.map(m => {
    const h = teamById.get(m.home_team_id!)!
    const a = teamById.get(m.away_team_id!)!
    const win = Number(h.name.slice(1)) < Number(a.name.slice(1)) ? 'h' : 'a'
    return {
      id: m.id, user_id: userId, match_id: m.id,
      pred_home: win === 'h' ? 2 : 0, pred_away: win === 'h' ? 0 : 2,
      locked: true, locked_at: null, created_at: '', updated_at: '',
    }
  })
}

describe('Slutspelspoäng: 3p per rätt lag per omgång + 5p för mästaren', () => {
  const teams = buildTeams()
  const teamById = new Map(teams.map(t => [t.id, t]))
  const groupMatchesConfirmed = confirmGroupResults(buildGroupMatches(teams), teamById)
  const knockout = buildKnockoutMatches()

  it('grupptips = verkligheten → 32 rätt lag i R32 = 96p (inga R32-resultat än)', () => {
    const allMatches = [...groupMatchesConfirmed, ...knockout]
    const preds = conformistGroupPreds(groupMatchesConfirmed, teamById, 'u1')
    const { points, breakdown } = calcKnockoutPoints(allMatches, teams, preds)
    expect(breakdown.rounds.r32).toBe(32)
    expect(breakdown.rounds.r16).toBe(0) // verkliga R16 okänd innan R32 spelats
    expect(points).toBe(32 * TEAM_POINTS_PER_ROUND)
  })

  it('fel grupptips ger färre R32-lag', () => {
    const allMatches = [...groupMatchesConfirmed, ...knockout]
    // Contrarian i grupp A: tippar omvänd ordning → A-lagens placeringar blir
    // fel (A4 etta, A3 tvåa, A2 trea) medan verkligheten har A1/A2/A3.
    const preds = conformistGroupPreds(groupMatchesConfirmed, teamById, 'u2').map(p => {
      const m = groupMatchesConfirmed.find(x => x.id === p.match_id)!
      if (m.group_name !== 'A') return p
      return { ...p, pred_home: p.pred_away, pred_away: p.pred_home } // flippa
    })
    const { breakdown } = calcKnockoutPoints(allMatches, teams, preds)
    // Verklig R32 innehåller A1 (vinnare), A2 (tvåa), ev. A3 (trea).
    // Contrarians träd har A4/A3/A2 → endast överlappande lag räknas.
    expect(breakdown.rounds.r32).toBeLessThan(32)
    expect(breakdown.rounds.r32).toBeGreaterThanOrEqual(29) // bara grupp A påverkad
  })

  it('R16-poäng när verkliga R32-resultat bekräftas + mästarpoäng vid full träff', () => {
    // Bekräfta ALLA R32/R16/QF/SF/final i verkligheten: hemmalaget vinner alltid 1–0.
    const allConfirmed = [...groupMatchesConfirmed, ...knockout].map(m =>
      m.stage === 'group' ? m : { ...m, home_score: 1, away_score: 0, result_confirmed: true }
    )
    // Deltagaren tippar exakt samma: grupp enligt verkligheten + hemmavinst 1–0 överallt
    const preds: Prediction[] = [
      ...conformistGroupPreds(groupMatchesConfirmed, teamById, 'u3'),
      ...knockout.map(m => ({
        id: m.id, user_id: 'u3', match_id: m.id,
        pred_home: 1, pred_away: 0,
        locked: true, locked_at: null, created_at: '', updated_at: '',
      })),
    ]
    const { points, breakdown } = calcKnockoutPoints(allConfirmed, teams, preds)
    expect(breakdown.rounds.r32).toBe(32)
    expect(breakdown.rounds.r16).toBe(16)
    expect(breakdown.rounds.qf).toBe(8)
    expect(breakdown.rounds.sf).toBe(4)
    expect(breakdown.rounds.final).toBe(2)
    expect(breakdown.champion).toBe(true)
    expect(points).toBe((32 + 16 + 8 + 4 + 2) * TEAM_POINTS_PER_ROUND + CHAMPION_POINTS)
  })

  it('rätt lag i omgången räknas även om deltagaren har det i fel match', () => {
    // Verkligheten: allt bekräftat, hemmavinster.
    const allConfirmed = [...groupMatchesConfirmed, ...knockout].map(m =>
      m.stage === 'group' ? m : { ...m, home_score: 1, away_score: 0, result_confirmed: true }
    )
    // Deltagaren: rätt grupptips MEN tippar bortavinst i R32-match 73 och 78.
    // Då går "fel" lag vidare i deras träd i just de matcherna – men lag som
    // ändå är rätt i senare omgångar (via andra vägar) ska ge poäng.
    const preds: Prediction[] = [
      ...conformistGroupPreds(groupMatchesConfirmed, teamById, 'u4'),
      ...knockout.map(m => ({
        id: m.id, user_id: 'u4', match_id: m.id,
        pred_home: m.match_number === 73 || m.match_number === 78 ? 0 : 1,
        pred_away: m.match_number === 73 || m.match_number === 78 ? 1 : 0,
        locked: true, locked_at: null, created_at: '', updated_at: '',
      })),
    ]
    const { breakdown } = calcKnockoutPoints(allConfirmed, teams, preds)
    expect(breakdown.rounds.r32).toBe(32)     // R32 opåverkad av knockout-tips
    expect(breakdown.rounds.r16).toBe(14)     // 2 fel vinnare → 14 rätt av 16
  })
})
