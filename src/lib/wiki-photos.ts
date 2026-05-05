// Hämtar spelarbilder via Wikipedias API i batch (en request per upp till 50 namn).
// Vi cachar i Next.js fetch-cache i 24h för att slippa hamra på Wikipedia.

interface WikiPage {
  title: string
  pageid?: number
  thumbnail?: { source: string; width: number; height: number }
  pageimage?: string
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

const WIKI_BATCH_SIZE = 40

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchBatch(names: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (names.length === 0) return result

  const titles = names.join('|')
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=200` +
    `&titles=${encodeURIComponent(titles)}` +
    `&redirects=1&format=json&origin=*`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VMTips/1.0 (https://tippavm2026.se)' },
      next: { revalidate: 60 * 60 * 24 }, // 24h
    })
    if (!res.ok) return result
    const data = (await res.json()) as WikiResponse

    // Bygg upp en map: ursprungligt namn → slutgiltig title (efter normalize+redirect)
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
    const titleToThumb = new Map<string, string>()
    for (const p of Object.values(pages)) {
      if (p.thumbnail?.source) titleToThumb.set(p.title, p.thumbnail.source)
    }

    for (const [orig, cur] of finalTitle) {
      const thumb = titleToThumb.get(cur)
      if (thumb) result.set(orig, thumb)
    }
  } catch {
    // Tyst fel — vi visar bara initialer istället
  }
  return result
}

/**
 * Hämtar spelarporträtt från Wikipedia. Returnerar en Map: spelarnamn → URL till bild.
 * Saknade träffar finns helt enkelt inte i mapen.
 */
export async function fetchPlayerPhotos(names: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(names.filter(n => n && n.trim().length > 0)))
  const batches = chunk(unique, WIKI_BATCH_SIZE)
  const results = await Promise.all(batches.map(fetchBatch))
  const merged = new Map<string, string>()
  for (const m of results) for (const [k, v] of m) merged.set(k, v)
  return merged
}
