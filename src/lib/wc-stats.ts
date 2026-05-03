// Hämtar VM-statistik (skytteligaledare m.m.) från football-data.org.
// Cachas i 1 timme via Next.js fetch-cache.

export interface TopScorer {
  player: string
  team: string
  teamCrest: string | null
  goals: number
  assists: number | null
  penalties: number | null
}

interface FdScorer {
  player: { id: number; name: string }
  team: { id: number; name: string; crest?: string }
  goals: number
  assists: number | null
  penalties: number | null
}

export async function fetchTopScorers(limit = 10): Promise<TopScorer[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) return []
  try {
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/WC/scorers?limit=${limit}`,
      {
        headers: { 'X-Auth-Token': apiKey },
        next: { revalidate: 60 * 60 },
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    const scorers: FdScorer[] = data.scorers ?? []
    return scorers.map(s => ({
      player: s.player?.name ?? '?',
      team: s.team?.name ?? '?',
      teamCrest: s.team?.crest ?? null,
      goals: s.goals ?? 0,
      assists: s.assists,
      penalties: s.penalties,
    }))
  } catch {
    return []
  }
}
