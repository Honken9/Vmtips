// Slutspelspoäng enligt tävlingsreglerna:
//   • 3p per RÄTT LAG per omgång, från 16-delsfinalerna och uppåt.
//     "Rätt lag" = laget finns i omgången både i deltagarens tippade träd
//     och i verkligheten – VILKEN match i omgången spelar ingen roll.
//   • 5p extra för rätt världsmästare.
//   • Siffertipsen på slutspelsmatcher ger INGA tecken-/exaktpoäng – de
//     styr bara vilka lag som går vidare i deltagarens eget träd.
//
// Deltagarens träd löses från deras EGNA tips (resultat strippade),
// verklighetens träd från bekräftade resultat (inga tips). Verklighetens
// omgångar fylls på allteftersom resultat matas in – poängen växer då
// automatiskt vid varje omräkning.

import type { Match, Team, Prediction } from './types'
import { resolveBracket, stripConfirmedResults, type BracketResolution } from './bracket'

export const TEAM_POINTS_PER_ROUND = 3
export const CHAMPION_POINTS = 5

export type KnockoutRound = 'r32' | 'r16' | 'qf' | 'sf' | 'final'
export const KNOCKOUT_ROUNDS: KnockoutRound[] = ['r32', 'r16', 'qf', 'sf', 'final']

export interface KnockoutBreakdown {
  /** Antal rätt lag per omgång */
  rounds: Record<KnockoutRound, number>
  /** Rätt världsmästare? */
  champion: boolean
  /** Deltagarens tippade mästare (team-id) – för visning */
  predictedChampionId: number | null
}

export interface KnockoutPointsResult {
  points: number
  breakdown: KnockoutBreakdown
}

export function teamIdsPerRound(b: BracketResolution): Record<KnockoutRound, Set<number>> {
  const ids = (pairs: [Team | null, Team | null][]): Set<number> =>
    new Set(
      pairs
        .flatMap(([h, a]) => [h?.id, a?.id])
        .filter((x): x is number => x != null)
    )
  return {
    r32: ids(b.r32Teams),
    r16: ids(b.r16Teams),
    qf: ids(b.qfTeams),
    sf: ids(b.sfTeams),
    final: ids([b.finalTeams]),
  }
}

function intersectCount(a: Set<number>, b: Set<number>): number {
  let n = 0
  for (const x of a) if (b.has(x)) n++
  return n
}

/**
 * Räknar en deltagares slutspelspoäng.
 * @param matches ALLA matcher (med verkliga resultat där de finns)
 * @param teams alla lag
 * @param userPreds deltagarens predictions (grupp + slutspel)
 */
export function calcKnockoutPoints(
  matches: Match[],
  teams: Team[],
  userPreds: Prediction[]
): KnockoutPointsResult {
  // Deltagarens träd: enbart egna tips
  const own = resolveBracket(stripConfirmedResults(matches), teams, userPreds)
  // Verklighetens träd: enbart bekräftade resultat
  const real = resolveBracket(matches, teams, [])

  const ownRounds = teamIdsPerRound(own)
  const realRounds = teamIdsPerRound(real)

  const rounds = {} as Record<KnockoutRound, number>
  let points = 0
  for (const r of KNOCKOUT_ROUNDS) {
    const correct = intersectCount(ownRounds[r], realRounds[r])
    rounds[r] = correct
    points += correct * TEAM_POINTS_PER_ROUND
  }

  const champion =
    own.champion != null &&
    real.champion != null &&
    own.champion.id === real.champion.id
  if (champion) points += CHAMPION_POINTS

  return {
    points,
    breakdown: {
      rounds,
      champion,
      predictedChampionId: own.champion?.id ?? null,
    },
  }
}
