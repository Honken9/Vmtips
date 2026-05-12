// Hämtar spelarbilder OCH klubb-info via Wikipedias API i batch.
// Vi cachar i Next.js fetch-cache i 24h för att slippa hamra på Wikipedia.

interface WikiPage {
  title: string
  pageid?: number
  thumbnail?: { source: string; width: number; height: number }
  pageimage?: string
  revisions?: Array<{ slots?: { main?: { '*'?: string; content?: string } }; '*'?: string }>
}

interface WikiNormalized {
  from: string
  to: string
}

interface WikiRedirect {
  from: string
  to: string
}

interface WikiResponse {
  query?: {
    pages?: Record<string, WikiPage>
    normalized?: WikiNormalized[]
    redirects?: WikiRedirect[]
  }
}

export interface WikiInfo {
  photoUrl?: string
  currentClub?: string
}

const WIKI_BATCH_SIZE = 30

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Parsar "currentclub" från en Wikipedia-infobox.
// Wikipedia använder mall {{Infobox football biography ... | currentclub = X}}
// där X kan vara ett klartextnamn eller en wiki-länk [[Club Name]].
function extractCurrentClub(wikitext: string | undefined): string | undefined {
  if (!wikitext) return undefined

  // Försök flera infobox-fält i fallande ordning
  const fields = ['currentclub', 'current_club', 'club', 'clubnumber']
  for (const field of fields) {
    const re = new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n|}]+)`, 'i')
    const m = wikitext.match(re)
    if (!m) continue
    let val = m[1].trim()
    if (!val || val === 'Free agent' || val.startsWith('{{')) continue
    // Strip wiki link syntax: [[Club Name]] eller [[Real|Real Madrid]]
    val = val.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, p1, p2) => p2 || p1)
    // Strip mall-anrop som {{flag|...}}
    val = val.replace(/\{\{[^}]+\}\}/g, '')
    val = val.replace(/<!--[\s\S]*?-->/g, '').trim()
    if (val) return val.slice(0, 60)
  }
  return undefined
}

async function fetchBatch(names: string[]): Promise<Map<string, WikiInfo>> {
  const result = new Map<string, WikiInfo>()
  if (names.length === 0) return result

  const titles = names.join('|')
  // Hämta både thumbnail OCH första sektionens wikitext (innehåller infoboxen)
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=query&prop=pageimages|revisions` +
    `&piprop=thumbnail&pithumbsize=200` +
    `&rvprop=content&rvsection=0&rvslots=main` +
    `&titles=${encodeURIComponent(titles)}` +
    `&redirects=1&format=json&origin=*`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VMTips/1.0 (https://tippavm2026.se)' },
      next: { revalidate: 60 * 60 * 24 }, // 24h
    })
    if (!res.ok) return result
    const data = (await res.json()) as WikiResponse

    // Mappa ursprungliga namn → slutgiltig wiki-title (efter normalize + redirect)
    const finalTitle = new Map<string, string>()
    for (const n of names) finalTitle.set(n, n)
    for (const norm of data.query?.normalized ?? []) {
      for (const [orig, cur] of finalTitle) {
        if (cur === norm.from) finalTitle.set(orig, norm.to)
      }
    }
    for (const red of data.query?.redirects ?? []) {
      for (const [orig, cur] of finalTitle) {
        if (cur === red.from) finalTitle.set(orig, red.to)
      }
    }

    const pages = data.query?.pages ?? {}
    const titleToInfo = new Map<string, WikiInfo>()
    for (const p of Object.values(pages)) {
      const info: WikiInfo = {}
      if (p.thumbnail?.source) info.photoUrl = p.thumbnail.source
      // Wikitext kan ligga på olika ställen beroende på rvslots-stöd
      const rev = p.revisions?.[0]
      const wikitext = rev?.slots?.main?.['*'] ?? rev?.slots?.main?.content ?? rev?.['*']
      const club = extractCurrentClub(wikitext)
      if (club) info.currentClub = club
      if (info.photoUrl || info.currentClub) titleToInfo.set(p.title, info)
    }

    for (const [orig, cur] of finalTitle) {
      const info = titleToInfo.get(cur)
      if (info) result.set(orig, info)
    }
  } catch {
    // Tyst fel
  }
  return result
}

/**
 * Hämtar spelarporträtt + aktuell klubb från Wikipedia.
 * Returnerar Map: spelarnamn → { photoUrl?, currentClub? }.
 * Saknade träffar finns inte i mapen.
 */
export async function fetchPlayerInfo(names: string[]): Promise<Map<string, WikiInfo>> {
  const unique = Array.from(new Set(names.filter(n => n && n.trim().length > 0)))
  const batches = chunk(unique, WIKI_BATCH_SIZE)
  const results = await Promise.all(batches.map(fetchBatch))
  const merged = new Map<string, WikiInfo>()
  for (const m of results) for (const [k, v] of m) merged.set(k, v)
  return merged
}

/**
 * Bakåt-kompatibel: returnerar bara photoUrl-mappen.
 */
export async function fetchPlayerPhotos(names: string[]): Promise<Map<string, string>> {
  const info = await fetchPlayerInfo(names)
  const out = new Map<string, string>()
  for (const [k, v] of info) {
    if (v.photoUrl) out.set(k, v.photoUrl)
  }
  return out
}
