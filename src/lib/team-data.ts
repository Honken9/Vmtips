// Hämtar landslagsdata från externa API:er (cache:ad) och från football-data.org.

import { getFallbackSquad, type FallbackPlayer } from './wc-fallback-squads'

export interface CountryInfo {
  capital: string | null
  population: number | null
  area: number | null
  region: string | null
  subregion: string | null
  languages: string[]
  currency: string | null
  flagSvgUrl: string | null
}

export interface SquadPlayer {
  id: number
  name: string
  position: string | null
  dateOfBirth: string | null
  nationality: string | null
  shirtNumber: number | null
  club?: string | null
  youthClub?: string | null
  marketValueM?: number | null
}

export interface TeamFootballInfo {
  id: number | null
  name: string | null
  founded: number | null
  crestUrl: string | null
  coachName: string | null
  coachNationality: string | null
  squad: SquadPlayer[]
  squadIsProvisional: boolean
}

// FIFA-kod → ISO 3166 alpha-3. För nationer som ingår i Storbritannien
// finns ingen distinkt ISO-kod – vi mappar dessa till GBR så vi får
// någorlunda relevant landsinfo, även om "befolkning" då är hela UK:s.
const FIFA_TO_ISO: Record<string, string> = {
  ENG: 'GBR',
  SCO: 'GBR',
  WAL: 'GBR',
  NIR: 'GBR',
  POR: 'PRT',
  GER: 'DEU',
  NED: 'NLD',
  CRO: 'HRV',
  SUI: 'CHE',
  DEN: 'DNK',
  RSA: 'ZAF',
  CHI: 'CHL',
  PAR: 'PRY',
  URU: 'URY',
  KOR: 'KOR',
  IRN: 'IRN',
  KSA: 'SAU',
  ALG: 'DZA',
  MAR: 'MAR',
  TUN: 'TUN',
  CIV: 'CIV',
  CMR: 'CMR',
  NGA: 'NGA',
  SEN: 'SEN',
  EGY: 'EGY',
  COD: 'COD',
  CRC: 'CRI',
  HON: 'HND',
  TUR: 'TUR',
  CPV: 'CPV',
  BIH: 'BIH',
  CZE: 'CZE',
  NZL: 'NZL',
}

function fifaToIso(fifaCode: string): string {
  return FIFA_TO_ISO[fifaCode.toUpperCase()] ?? fifaCode.toUpperCase()
}

interface RestCountry {
  name?: { common?: string; official?: string }
  capital?: string[]
  population?: number
  area?: number
  region?: string
  subregion?: string
  languages?: Record<string, string>
  currencies?: Record<string, { name?: string; symbol?: string }>
  flags?: { svg?: string; png?: string }
}

export async function fetchCountry(fifaCode: string): Promise<CountryInfo | null> {
  const iso = fifaToIso(fifaCode)
  try {
    const res = await fetch(`https://restcountries.com/v3.1/alpha/${iso}`, {
      next: { revalidate: 60 * 60 * 24 }, // 24h
    })
    if (!res.ok) return null
    const data = (await res.json()) as RestCountry[] | RestCountry
    const c = Array.isArray(data) ? data[0] : data
    if (!c) return null
    const langs = c.languages ? Object.values(c.languages) : []
    const curEntries = c.currencies ? Object.values(c.currencies) : []
    const cur = curEntries[0]
    return {
      capital: c.capital?.[0] ?? null,
      population: c.population ?? null,
      area: c.area ?? null,
      region: c.region ?? null,
      subregion: c.subregion ?? null,
      languages: langs,
      currency: cur ? `${cur.name ?? ''}${cur.symbol ? ` (${cur.symbol})` : ''}`.trim() : null,
      flagSvgUrl: c.flags?.svg ?? c.flags?.png ?? null,
    }
  } catch {
    return null
  }
}

interface FdTeam {
  id: number
  name: string
  tla: string | null
  shortName: string | null
  crest?: string
  founded?: number
  coach?: { name?: string; nationality?: string } | null
  squad?: Array<{
    id: number
    name?: string
    position?: string
    dateOfBirth?: string
    nationality?: string
    shirtNumber?: number
  }>
}

let _wcTeamsCache: { ts: number; teams: FdTeam[] } | null = null

async function fetchWcTeams(): Promise<FdTeam[]> {
  // Inbyggd cache (10 min) för att slippa rate-limit på 10 calls/min.
  // Next.js fetch-cachen gör samma sak när den kan, men under
  // utveckling slår denna till mer förutsägbart.
  const now = Date.now()
  if (_wcTeamsCache && now - _wcTeamsCache.ts < 10 * 60 * 1000) {
    return _wcTeamsCache.teams
  }
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) return []
  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/teams', {
      headers: { 'X-Auth-Token': apiKey },
      next: { revalidate: 60 * 60 }, // 1h
    })
    if (!res.ok) return []
    const data = await res.json()
    const teams: FdTeam[] = data.teams ?? []
    _wcTeamsCache = { ts: now, teams }
    return teams
  } catch {
    return []
  }
}

const TLA_ALIASES: Record<string, string[]> = {
  // Vår FIFA-kod → tla(er) som kan dyka upp i football-data.org-svaret
  USA: ['USA'],
  KOR: ['KOR'],
  IRN: ['IRN', 'IRA'],
  CIV: ['CIV', 'IVO'],
  COD: ['COD', 'DRC'],
  CPV: ['CPV', 'CAB'],
  TUR: ['TUR'],
}

interface FdMatch {
  id: number
  utcDate?: string
  goals?: Array<{
    scorer?: { id: number; name: string } | null
    assist?: { id: number; name: string } | null
  }>
  bookings?: Array<{ player?: { id: number; name: string } | null }>
  substitutions?: Array<{
    playerIn?: { id: number; name: string } | null
    playerOut?: { id: number; name: string } | null
  }>
}

async function fetchTeamDetail(teamId: number): Promise<FdTeam | null> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(`https://api.football-data.org/v4/teams/${teamId}`, {
      headers: { 'X-Auth-Token': apiKey },
      next: { revalidate: 60 * 60 * 6 }, // 6h
    })
    if (!res.ok) {
      console.error(`[team-data] /v4/teams/${teamId} returned ${res.status}`)
      return null
    }
    return (await res.json()) as FdTeam
  } catch (err) {
    console.error(`[team-data] /v4/teams/${teamId} failed`, err)
    return null
  }
}

async function fetchRecentMatchPlayers(teamId: number): Promise<SquadPlayer[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) return []
  try {
    const res = await fetch(
      `https://api.football-data.org/v4/teams/${teamId}/matches?status=FINISHED&limit=3`,
      {
        headers: { 'X-Auth-Token': apiKey },
        next: { revalidate: 60 * 60 * 6 }, // 6h
      }
    )
    if (!res.ok) {
      console.error(`[team-data] /v4/teams/${teamId}/matches returned ${res.status}`)
      return []
    }
    const data = (await res.json()) as { matches?: FdMatch[] }
    const matches = (data.matches ?? []).slice(-3)
    const seen = new Map<number, string>()
    const add = (p: { id: number; name: string } | null | undefined) => {
      if (p?.id && p.name && !seen.has(p.id)) seen.set(p.id, p.name)
    }
    for (const m of matches) {
      for (const g of m.goals ?? []) {
        add(g.scorer)
        add(g.assist)
      }
      for (const b of m.bookings ?? []) add(b.player)
      for (const s of m.substitutions ?? []) {
        add(s.playerIn)
        add(s.playerOut)
      }
    }
    if (seen.size === 0) {
      console.error(
        `[team-data] /v4/teams/${teamId}/matches returned ${matches.length} matches but no event players`
      )
    }
    return Array.from(seen, ([id, name]) => ({
      id,
      name,
      position: null,
      dateOfBirth: null,
      nationality: null,
      shirtNumber: null,
    })).sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    console.error(`[team-data] /v4/teams/${teamId}/matches failed`, err)
    return []
  }
}

// Normalisera namn för matchning mellan football-data.org-truppen och vår
// fallback-lista. Tar bort diakritiska tecken (Ø → O, é → e), trimmar och
// lowercasear. "Viktor Gyökeres" matchar då "Viktor Gyokeres" från API:n.
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[ø]/gi, 'o')
    .replace(/[æ]/gi, 'ae')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function fallbackToSquadPlayers(fb: FallbackPlayer[]): SquadPlayer[] {
  // Negativa ids så vi inte krockar med football-data:s riktiga ids.
  return fb.map((p, i) => ({
    id: -1 - i,
    name: p.name,
    position: p.position,
    dateOfBirth: null,
    nationality: null,
    shirtNumber: null,
    club: p.club ?? null,
    youthClub: p.youthClub ?? null,
    marketValueM: p.marketValueM ?? null,
  }))
}

const mapSquad = (raw: FdTeam['squad']): SquadPlayer[] =>
  (raw ?? []).map(p => ({
    id: p.id,
    name: p.name ?? '?',
    position: p.position ?? null,
    dateOfBirth: p.dateOfBirth ?? null,
    nationality: p.nationality ?? null,
    shirtNumber: p.shirtNumber ?? null,
  }))

export async function fetchTeamFootball(fifaCode: string): Promise<TeamFootballInfo | null> {
  const fallback = getFallbackSquad(fifaCode)
  const teams = await fetchWcTeams()
  const targetCodes = (TLA_ALIASES[fifaCode.toUpperCase()] ?? [fifaCode.toUpperCase()]).map(s =>
    s.toUpperCase()
  )
  const t = teams.find(team => team.tla && targetCodes.includes(team.tla.toUpperCase())) ?? null

  let squad = t ? mapSquad(t.squad) : []
  let provisional = false
  let coachName = t?.coach?.name ?? null
  let coachNationality = t?.coach?.nationality ?? null

  // Steg 2: WC-endpoint:en saknar ofta squad för landslag — testa /v4/teams/{id}.
  if (squad.length === 0 && t) {
    const detail = await fetchTeamDetail(t.id)
    if (detail) {
      squad = mapSquad(detail.squad)
      coachName = coachName ?? detail.coach?.name ?? null
      coachNationality = coachNationality ?? detail.coach?.nationality ?? null
    }
  }

  // Steg 3: matchhändelser från senaste avslutade matcherna.
  if (squad.length === 0 && t) {
    squad = await fetchRecentMatchPlayers(t.id)
    provisional = squad.length > 0
  }

  // Steg 4: hårdkodad fallback (stjärnspelare per nation).
  if (squad.length === 0 && fallback) {
    squad = fallbackToSquadPlayers(fallback)
    provisional = true
  }

  // Anrika riktiga trupper med klubb + moderklubb + marknadsvärde från
  // fallback-listan när namn matchar. Detta gör att marknadsvärdet visas
  // även när football-data.org levererar den riktiga truppen.
  if (squad.length > 0 && !provisional && fallback) {
    const byName = new Map(fallback.map(p => [normalizeName(p.name), p]))
    squad = squad.map(p => {
      const fb = byName.get(normalizeName(p.name))
      if (!fb) return p
      return {
        ...p,
        club: p.club ?? fb.club ?? null,
        youthClub: p.youthClub ?? fb.youthClub ?? null,
        marketValueM: p.marketValueM ?? fb.marketValueM ?? null,
      }
    })
  }

  // Inget alls hittat – returnera null bara om vi heller inte har en fallback.
  if (squad.length === 0 && !t) return null

  return {
    id: t?.id ?? null,
    name: t?.name ?? null,
    founded: t?.founded ?? null,
    crestUrl: t?.crest ?? null,
    coachName,
    coachNationality,
    squad,
    squadIsProvisional: provisional,
  }
}
