// Brackets-resolver: tar grupp-tippningar + slutspels-tips och räknar ut
// vilka lag som hamnar var i hela slutspels-trädet (per användarens tips).
//
// Pure function – kan användas både i TipsClient och BracketView utan
// duplicering av useMemo-kedjorna.

import type { Match, Team, Prediction } from './types'
import {
  calcAllGroupStandings,
  getBest8Third,
  R32_BRACKET,
  R16_BRACKET,
  QF_BRACKET,
  SF_BRACKET,
} from './standings'

export interface BracketResolution {
  groupMatches: Match[]
  r32Matches: Match[]
  r16Matches: Match[]
  qfMatches: Match[]
  sfMatches: Match[]
  finalMatch: Match | undefined
  thirdMatch: Match | undefined
  r32Teams: [Team | null, Team | null][]
  r16Teams: [Team | null, Team | null][]
  qfTeams: [Team | null, Team | null][]
  sfTeams: [Team | null, Team | null][]
  finalTeams: [Team | null, Team | null]
  thirdTeams: [Team | null, Team | null]
  /** Champion enligt finalens tipp (eller null) */
  champion: Team | null
}

export function resolveBracket(
  matches: Match[],
  teams: Team[],
  predictions: Prediction[]
): BracketResolution {
  const groupMatches = matches.filter(m => m.stage === 'group')
  const r32Matches = matches.filter(m => m.stage === 'r32').sort((a, b) => a.match_number - b.match_number)
  const r16Matches = matches.filter(m => m.stage === 'r16').sort((a, b) => a.match_number - b.match_number)
  const qfMatches  = matches.filter(m => m.stage === 'qf' ).sort((a, b) => a.match_number - b.match_number)
  const sfMatches  = matches.filter(m => m.stage === 'sf' ).sort((a, b) => a.match_number - b.match_number)
  const finalMatch = matches.find(m => m.stage === 'final')
  const thirdMatch = matches.find(m => m.stage === '3rd')

  const preds: Record<number, { home: string; away: string }> = {}
  predictions.forEach(p => {
    preds[p.match_id] = { home: String(p.pred_home), away: String(p.pred_away) }
  })

  const standings = calcAllGroupStandings(teams, groupMatches, preds)
  const best8Third = getBest8Third(standings)

  const rSlot = (slot: string): Team | null => {
    if (slot.startsWith('T3_')) return best8Third[parseInt(slot.substring(3)) - 1]?.team ?? null
    const pos = parseInt(slot[0]) - 1
    return standings[slot[1]]?.[pos]?.team ?? null
  }

  const r32Teams: [Team | null, Team | null][] = r32Matches.map((_, i) => {
    const [hs, as_] = R32_BRACKET[i] ?? ['', '']
    return [rSlot(hs), rSlot(as_)]
  })

  const winner = (matchId: number, homeT: Team | null, awayT: Team | null): Team | null => {
    const m = matches.find(x => x.id === matchId)
    let hg: number, ag: number
    if (m?.result_confirmed && m.home_score != null && m.away_score != null) {
      hg = m.home_score
      ag = m.away_score
    } else {
      const p = preds[matchId]
      if (!p || p.home === '' || p.away === '') return null
      hg = parseInt(p.home)
      ag = parseInt(p.away)
      if (isNaN(hg) || isNaN(ag)) return null
    }
    return hg >= ag ? homeT : awayT
  }

  const loser = (matchId: number, homeT: Team | null, awayT: Team | null): Team | null => {
    const w = winner(matchId, homeT, awayT)
    if (!w) return null
    return w === homeT ? awayT : homeT
  }

  const r16Teams: [Team | null, Team | null][] = r16Matches.map((_, i) => {
    const [hi, ai] = R16_BRACKET[i] ?? [0, 0]
    return [
      r32Matches[hi] ? winner(r32Matches[hi].id, r32Teams[hi]?.[0], r32Teams[hi]?.[1]) : null,
      r32Matches[ai] ? winner(r32Matches[ai].id, r32Teams[ai]?.[0], r32Teams[ai]?.[1]) : null,
    ]
  })

  const qfTeams: [Team | null, Team | null][] = qfMatches.map((_, i) => {
    const [hi, ai] = QF_BRACKET[i] ?? [0, 0]
    return [
      r16Matches[hi] ? winner(r16Matches[hi].id, r16Teams[hi]?.[0], r16Teams[hi]?.[1]) : null,
      r16Matches[ai] ? winner(r16Matches[ai].id, r16Teams[ai]?.[0], r16Teams[ai]?.[1]) : null,
    ]
  })

  const sfTeams: [Team | null, Team | null][] = sfMatches.map((_, i) => {
    const [hi, ai] = SF_BRACKET[i] ?? [0, 0]
    return [
      qfMatches[hi] ? winner(qfMatches[hi].id, qfTeams[hi]?.[0], qfTeams[hi]?.[1]) : null,
      qfMatches[ai] ? winner(qfMatches[ai].id, qfTeams[ai]?.[0], qfTeams[ai]?.[1]) : null,
    ]
  })

  const finalTeams: [Team | null, Team | null] = [
    sfMatches[0] ? winner(sfMatches[0].id, sfTeams[0]?.[0], sfTeams[0]?.[1]) : null,
    sfMatches[1] ? winner(sfMatches[1].id, sfTeams[1]?.[0], sfTeams[1]?.[1]) : null,
  ]

  const thirdTeams: [Team | null, Team | null] = [
    sfMatches[0] ? loser(sfMatches[0].id, sfTeams[0]?.[0], sfTeams[0]?.[1]) : null,
    sfMatches[1] ? loser(sfMatches[1].id, sfTeams[1]?.[0], sfTeams[1]?.[1]) : null,
  ]

  const champion = finalMatch ? winner(finalMatch.id, finalTeams[0], finalTeams[1]) : null

  return {
    groupMatches,
    r32Matches, r16Matches, qfMatches, sfMatches,
    finalMatch, thirdMatch,
    r32Teams, r16Teams, qfTeams, sfTeams, finalTeams, thirdTeams,
    champion,
  }
}
