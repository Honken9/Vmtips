// Hämtar landslagsdata från externa API:er (cache:ad) och från football-data.org.

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
}

export interface TeamFootballInfo {
  id: number | null
  name: string | null
  founded: number | null
  crestUrl: string | null
  coachName: string | null
  coachNationality: string | null
  squad: SquadPlayer[]
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

export async function fetchTeamFootball(fifaCode: string): Promise<TeamFootballInfo | null> {
  const teams = await fetchWcTeams()
  if (teams.length === 0) return null
  const targetCodes = (TLA_ALIASES[fifaCode.toUpperCase()] ?? [fifaCode.toUpperCase()]).map(s =>
    s.toUpperCase()
  )
  const t = teams.find(team => team.tla && targetCodes.includes(team.tla.toUpperCase()))
  if (!t) return null
  return {
    id: t.id,
    name: t.name ?? null,
    founded: t.founded ?? null,
    crestUrl: t.crest ?? null,
    coachName: t.coach?.name ?? null,
    coachNationality: t.coach?.nationality ?? null,
    squad: (t.squad ?? []).map(p => ({
      id: p.id,
      name: p.name ?? '?',
      position: p.position ?? null,
      dateOfBirth: p.dateOfBirth ?? null,
      nationality: p.nationality ?? null,
      shirtNumber: p.shirtNumber ?? null,
    })),
  }
}
