// Lättviktig RSS 2.0 / Atom-parser utan externa dependencies.

export interface NewsItem {
  title: string
  link: string
  pubDate: string | null  // ISO-string
  description: string | null
  imageUrl: string | null
  source: string
}

const DEFAULT_FEED = 'https://www.fotbollskanalen.se/rss/'

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '').trim())
}

function pickTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = block.match(re)
  return m ? decodeEntities(m[1]).trim() : null
}

function pickAttr(block: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["']`, 'i')
  const m = block.match(re)
  return m ? m[1] : null
}

function findImage(block: string, descriptionHtml: string | null): string | null {
  // 1. <enclosure url="..." type="image/...">
  const enc = block.match(/<enclosure\b[^>]*url=["']([^"']+)["'][^>]*type=["']image\/[^"']+["']/i)
  if (enc) return enc[1]

  // 2. <media:content url="..." medium="image">
  const mc = block.match(/<media:content\b[^>]*url=["']([^"']+)["']/i)
  if (mc) return mc[1]

  // 3. <media:thumbnail url="...">
  const mt = block.match(/<media:thumbnail\b[^>]*url=["']([^"']+)["']/i)
  if (mt) return mt[1]

  // 4. <itunes:image href="...">
  const it = block.match(/<itunes:image\b[^>]*href=["']([^"']+)["']/i)
  if (it) return it[1]

  // 5. första <img src="..."> i description
  if (descriptionHtml) {
    const img = descriptionHtml.match(/<img[^>]*src=["']([^"']+)["']/i)
    if (img) return img[1]
  }

  return null
}

function parseRss(xml: string, sourceUrl: string): NewsItem[] {
  const sourceName = (() => {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, '')
    } catch {
      return 'rss'
    }
  })()

  const items: NewsItem[] = []

  // RSS 2.0: <item>...</item>
  const rssItemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = rssItemRe.exec(xml)) !== null) {
    const block = m[1]
    const title = pickTag(block, 'title') ?? ''
    const linkTag = pickTag(block, 'link')
    const link = linkTag || pickAttr(block, 'link', 'href') || ''
    const pubDateRaw = pickTag(block, 'pubDate') || pickTag(block, 'dc:date')
    const description = pickTag(block, 'description') || pickTag(block, 'content:encoded')
    const imageUrl = findImage(block, description)
    if (!title || !link) continue
    const pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString() : null
    items.push({
      title: stripHtml(title),
      link: link.trim(),
      pubDate,
      description: description ? stripHtml(description).slice(0, 240) : null,
      imageUrl,
      source: sourceName,
    })
  }

  if (items.length > 0) return items

  // Atom: <entry>...</entry>
  const atomEntryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
  while ((m = atomEntryRe.exec(xml)) !== null) {
    const block = m[1]
    const title = pickTag(block, 'title') ?? ''
    const link = pickAttr(block, 'link', 'href') || pickTag(block, 'link') || ''
    const pubDateRaw = pickTag(block, 'published') || pickTag(block, 'updated')
    const description = pickTag(block, 'summary') || pickTag(block, 'content')
    const imageUrl = findImage(block, description)
    if (!title || !link) continue
    const pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString() : null
    items.push({
      title: stripHtml(title),
      link: link.trim(),
      pubDate,
      description: description ? stripHtml(description).slice(0, 240) : null,
      imageUrl,
      source: sourceName,
    })
  }

  return items
}

export async function fetchNews(limit = 5): Promise<NewsItem[]> {
  const url = process.env.NEWS_RSS_URL || DEFAULT_FEED
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VMTipsBot/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      next: { revalidate: 1800 }, // cache 30 min
    })
    if (!res.ok) return []
    const xml = await res.text()
    const items = parseRss(xml, url)
    items.sort((a, b) => {
      if (!a.pubDate) return 1
      if (!b.pubDate) return -1
      return b.pubDate.localeCompare(a.pubDate)
    })
    return items.slice(0, limit)
  } catch {
    return []
  }
}
