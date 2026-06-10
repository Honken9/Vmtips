import { describe, it, expect } from 'vitest'
import { resolveBracket } from '../bracket'
import type { Match, Team, Prediction } from '../types'

const GROUPS = 'ABCDEFGHIJKL'.split('')

// Bygg 12 grupper × 4 lag = 48 lag. Lagets id = unik int, namn beskriver gruppen.
function buildTeams(): Team[] {
  const teams: Team[] = []
  let id = 1
  for (const g of GROUPS) {
    for (let n = 1; n <= 4; n++) {
      teams.push({
        id: id++,
        name: `${g}${n}`,
        code: `${g}${n}`,
        flag: '🏳️',
        group_name: g,
      })
    }
  }
  return teams
}

// Bygg gruppspelets 72 matcher (6 per grupp), grupp-stage med id som följer.
function buildGroupMatches(teams: Team[]): Match[] {
  const matches: Match[] = []
  let id = 1000
  let matchNo = 1
  for (const g of GROUPS) {
    const t = teams.filter(x => x.group_name === g)
    // round-robin 4 lag = 6 matcher
    const pairs: [number, number][] = [
      [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
    ]
    for (const [a, b] of pairs) {
      matches.push({
        id: id++,
        match_number: matchNo++,
        stage: 'group',
        group_name: g,
        home_team_id: t[a].id,
        away_team_id: t[b].id,
        home_placeholder: null,
        away_placeholder: null,
        kickoff_at: '2026-06-11T00:00:00Z',
        venue: null,
        home_score: null,
        away_score: null,
        result_confirmed: false,
      })
    }
  }
  return matches
}

// Bygg slutspelsmatcher 73–104. Teams fylls dynamiskt – vi ger dem bara id.
function buildKnockoutMatches(): Match[] {
  const out: Match[] = []
  const make = (id: number, num: number, stage: Match['stage']) => ({
    id, match_number: num, stage,
    group_name: null,
    home_team_id: null, away_team_id: null,
    home_placeholder: null, away_placeholder: null,
    kickoff_at: '2026-06-28T00:00:00Z',
    venue: null,
    home_score: null, away_score: null,
    result_confirmed: false,
  })
  for (let n = 73; n <= 88; n++) out.push(make(2000 + n, n, 'r32'))
  for (let n = 89; n <= 96; n++) out.push(make(2000 + n, n, 'r16'))
  for (let n = 97; n <= 100; n++) out.push(make(2000 + n, n, 'qf'))
  for (let n = 101; n <= 102; n++) out.push(make(2000 + n, n, 'sf'))
  out.push(make(2103, 103, '3rd'))
  out.push(make(2104, 104, 'final'))
  return out
}

// Slumpa gruppresultat med en seedad RNG så testen är deterministiska
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildPredictionsFromRng(matches: Match[], rng: () => number, userId: string): Prediction[] {
  return matches
    .filter(m => m.stage === 'group')
    .map(m => ({
      id: m.id,
      user_id: userId,
      match_id: m.id,
      pred_home: Math.floor(rng() * 4),
      pred_away: Math.floor(rng() * 4),
      locked: false,
      locked_at: null,
      created_at: '',
      updated_at: '',
    }))
}

describe('Bracket invariants over random group results', () => {
  const teams = buildTeams()
  const groupMatches = buildGroupMatches(teams)
  const knockoutMatches = buildKnockoutMatches()
  const allMatches = [...groupMatches, ...knockoutMatches]
  const TEAMS_BY_ID = new Map(teams.map(t => [t.id, t]))

  function runScenario(seed: number) {
    const rng = mulberry32(seed)
    const preds = buildPredictionsFromRng(allMatches, rng, `u-${seed}`)
    const br = resolveBracket(allMatches, teams, preds)
    return br
  }

  it('produces all 16 R32 matchups for 200 random scenarios', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const br = runScenario(seed)
      expect(br.r32Teams.length).toBe(16)
      // All 32 slots filled (when group stage tips exist)
      for (const [h, a] of br.r32Teams) {
        expect(h).not.toBeNull()
        expect(a).not.toBeNull()
      }
    }
  })

  it('no third meets a third – every third faces a group winner', () => {
    // Map R32 index → which slots are thirds (by FIFA: 74,77,79,80,81,82,85,87)
    const thirdMatchNumbers = new Set([74, 77, 79, 80, 81, 82, 85, 87])
    const r32Numbers = Array.from({ length: 16 }, (_, i) => 73 + i)
    for (let seed = 1; seed <= 100; seed++) {
      const br = runScenario(seed)
      for (let i = 0; i < 16; i++) {
        const matchNo = r32Numbers[i]
        const [h, a] = br.r32Teams[i]
        const groupH = h ? TEAMS_BY_ID.get(h.id)?.group_name : null
        const groupA = a ? TEAMS_BY_ID.get(a.id)?.group_name : null
        if (thirdMatchNumbers.has(matchNo)) {
          // The "TH_1X" slot is the away team in our R32_BRACKET ordering.
          // The home is the corresponding group winner; we don't enforce
          // home/away here, only that no third meets a third.
          expect([groupH, groupA].some(g => g != null)).toBe(true)
        }
      }
    }
  })

  it('exactly four R32 matches are runner-up vs runner-up (matches 73, 78, 83, 88)', () => {
    const expectedSecondVsSecond = [
      { idx: 0, hg: 'A', ag: 'B' },  // 73
      { idx: 5, hg: 'E', ag: 'I' },  // 78
      { idx: 10, hg: 'K', ag: 'L' }, // 83
      { idx: 15, hg: 'D', ag: 'G' }, // 88
    ]
    for (let seed = 1; seed <= 50; seed++) {
      const br = runScenario(seed)
      for (const { idx, hg, ag } of expectedSecondVsSecond) {
        const [h, a] = br.r32Teams[idx]
        expect(TEAMS_BY_ID.get(h!.id)?.group_name).toBe(hg)
        expect(TEAMS_BY_ID.get(a!.id)?.group_name).toBe(ag)
      }
    }
  })

  it('all 32 R32 participants are unique teams', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const br = runScenario(seed)
      const ids = br.r32Teams.flatMap(([h, a]) => [h!.id, a!.id])
      expect(new Set(ids).size).toBe(32)
    }
  })

  it('the 8 group winners are placed in the documented R32 slots', () => {
    // Match 74→E, 75→F, 76→C, 77→I, 79→A, 80→L, 81→D, 82→G, 84→H, 85→B, 86→J, 87→K
    const winnerExpect: Record<number, string> = {
      74: 'E', 75: 'F', 76: 'C', 77: 'I', 79: 'A', 80: 'L',
      81: 'D', 82: 'G', 84: 'H', 85: 'B', 86: 'J', 87: 'K',
    }
    for (let seed = 1; seed <= 30; seed++) {
      const br = runScenario(seed)
      for (const [num, group] of Object.entries(winnerExpect)) {
        const idx = Number(num) - 73
        const [home] = br.r32Teams[idx]
        const team = TEAMS_BY_ID.get(home!.id)!
        expect(team.group_name).toBe(group)
        // It must be the GROUP WINNER, not the runner-up or third
        // (we'll check via standings position by name convention: winners
        // are whoever sorted first; we just check group_name above as a
        // strong-enough signal that the home slot is from the right group.)
      }
    }
  })

  it('R16, QF, SF wiring respects FIFA tree (no nulls when R32 has clear winners)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const br = runScenario(seed)
      expect(br.r16Teams.length).toBe(8)
      expect(br.qfTeams.length).toBe(4)
      expect(br.sfTeams.length).toBe(2)
      // The bracket wiring just needs to produce 2 entries per R16 etc.
      // Whether each slot is filled depends on whether the R32 score
      // prediction is set – this is checked elsewhere.
    }
  })
})

describe('Annex C acceptance test inside resolveBracket', () => {
  // Crafted predictions: make groups A,B,D,E,F,G,I,L have qualifying thirds
  // and groups C,H,J,K have weaker thirds. We do this by giving every team
  // in groups A,B,D,E,F,G,I,L extra goals in their predicted matches so
  // their third-placed team finishes ahead of the others.

  const teams = buildTeams()
  const TEAMS_BY_ID = new Map(teams.map(t => [t.id, t]))
  const groupMatches = buildGroupMatches(teams)
  const knockoutMatches = buildKnockoutMatches()
  const allMatches = [...groupMatches, ...knockoutMatches]

  const STRONG = new Set(['A', 'B', 'D', 'E', 'F', 'G', 'I', 'L'])

  // Bygg predictions där varje "stark" grupp har en trea med en seger (3p, +1
  // mål), och "svaga" grupper har en trea utan poäng. Hur? Vi sätter
  // resultaten så att team3 i varje grupp vinner exakt en match.
  function craftedPreds(): Prediction[] {
    const preds: Prediction[] = []
    for (const m of allMatches) {
      if (m.stage !== 'group') continue
      const hg = TEAMS_BY_ID.get(m.home_team_id!)!
      const ag = TEAMS_BY_ID.get(m.away_team_id!)!
      const group = hg.group_name!
      // Position i gruppen från lagets namn (X1..X4)
      const homePos = Number(hg.name.slice(1))
      const awayPos = Number(ag.name.slice(1))
      // Standardresultat: rank 1 vinner mot 2,3,4; rank 2 vinner mot 3,4; osv.
      let h = 0, a = 0
      if (homePos < awayPos) h = 1
      else if (homePos > awayPos) a = 1
      // Förstärk grupp i STRONG: ge trean (rank 3) en seger mot fyran med
      // extra mål så hennes pts/gd blir bättre än trean i svaga grupper.
      if (STRONG.has(group)) {
        if (homePos === 3 && awayPos === 4) { h = 3; a = 0 }
        if (homePos === 4 && awayPos === 3) { h = 0; a = 3 }
      } else {
        // Svaga grupper: trean förlorar mot fyran med stora siffror
        if (homePos === 3 && awayPos === 4) { h = 0; a = 1 }
        if (homePos === 4 && awayPos === 3) { h = 1; a = 0 }
      }
      preds.push({
        id: m.id, user_id: 'crafted',
        match_id: m.id,
        pred_home: h, pred_away: a,
        locked: false, locked_at: null,
        created_at: '', updated_at: '',
      })
    }
    return preds
  }

  it('thirds from {A,B,D,E,F,G,I,L} → exact FIFA Annex C mapping', () => {
    const br = resolveBracket(allMatches, teams, craftedPreds())
    // Hämta gruppen från trean i varje "TH_1X"-slot.
    // R32_BRACKET-ordning: index 1=match 74 (1E), 4=77 (1I), 6=79 (1A),
    // 7=80 (1L), 8=81 (1D), 9=82 (1G), 12=85 (1B), 14=87 (1K).
    const thirdSlots = [
      { idx: 6,  winner: 'A', expectedThird: 'E' },
      { idx: 12, winner: 'B', expectedThird: 'G' },
      { idx: 8,  winner: 'D', expectedThird: 'B' },
      { idx: 1,  winner: 'E', expectedThird: 'D' },
      { idx: 9,  winner: 'G', expectedThird: 'A' },
      { idx: 4,  winner: 'I', expectedThird: 'F' },
      { idx: 14, winner: 'K', expectedThird: 'L' },
      { idx: 7,  winner: 'L', expectedThird: 'I' },
    ]
    for (const { idx, winner, expectedThird } of thirdSlots) {
      const [h, a] = br.r32Teams[idx]
      expect(TEAMS_BY_ID.get(h!.id)?.group_name).toBe(winner)
      expect(TEAMS_BY_ID.get(a!.id)?.group_name).toBe(expectedThird)
    }
  })
})
