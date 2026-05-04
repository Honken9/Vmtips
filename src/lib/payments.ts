// Hjälpare för pris-pott-beräkningar.

import type { LeaderboardEntry } from './types'

export interface PrizeDistribution {
  // Map från placering ("1", "2", "3") → andel av potten (0..1)
  [place: string]: number
}

export const DEFAULT_DISTRIBUTION: PrizeDistribution = { '1': 1.0 }

export const PRESETS: { id: string; label: string; dist: PrizeDistribution }[] = [
  { id: 'winner-takes-all', label: 'Vinnaren tar allt', dist: { '1': 1.0 } },
  { id: 'top2-60-40',       label: 'Topp 2 (60/40)',     dist: { '1': 0.6, '2': 0.4 } },
  { id: 'top3-50-30-20',    label: 'Topp 3 (50/30/20)',  dist: { '1': 0.5, '2': 0.3, '3': 0.2 } },
  { id: 'top3-60-25-15',    label: 'Topp 3 (60/25/15)',  dist: { '1': 0.6, '2': 0.25, '3': 0.15 } },
  { id: 'top4-40-30-20-10', label: 'Topp 4 (40/30/20/10)', dist: { '1': 0.4, '2': 0.3, '3': 0.2, '4': 0.1 } },
]

export function findPresetId(dist: PrizeDistribution): string | null {
  for (const p of PRESETS) {
    const a = JSON.stringify(p.dist)
    const b = JSON.stringify(dist)
    if (a === b) return p.id
  }
  return null
}

export function calcPot(args: {
  entryFee: number
  paidCount: number
  totalMembers: number
}): { paidTotal: number; potentialTotal: number } {
  return {
    paidTotal: args.entryFee * args.paidCount,
    potentialTotal: args.entryFee * args.totalMembers,
  }
}

export interface PrizePayout {
  place: number
  share: number
  amount: number
  user?: { user_id: string; display_name: string; total_points: number }
}

export function calcPayouts(args: {
  totalPot: number
  distribution: PrizeDistribution
  ranking: LeaderboardEntry[]
}): PrizePayout[] {
  const places = Object.keys(args.distribution)
    .map(k => ({ k, n: parseInt(k, 10) }))
    .filter(x => Number.isFinite(x.n))
    .sort((a, b) => a.n - b.n)

  return places.map(({ k, n }) => {
    const share = args.distribution[k] ?? 0
    const amount = Math.round(args.totalPot * share)
    const user = args.ranking[n - 1]
    return {
      place: n,
      share,
      amount,
      user: user
        ? { user_id: user.user_id, display_name: user.display_name, total_points: user.total_points }
        : undefined,
    }
  })
}

export function formatKr(n: number): string {
  return `${n.toLocaleString('sv-SE')} kr`
}
