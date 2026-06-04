import { createClient } from '@/lib/supabase/server'
import { Images, Users } from 'lucide-react'
import { AvatarCollage } from './AvatarCollage'

export const dynamic = 'force-dynamic'

interface ProfileRow {
  id: string
  display_name: string
  avatar_url: string | null
  pool_id: number | null
}

interface PoolRow {
  id: number
  name: string
}

interface HistoryRow {
  id: number
  user_id: string
  url: string
  created_at: string
}

export default async function AdminAvatarsPage() {
  const supabase = await createClient()
  const [{ data: profilesRaw }, { data: poolsRaw }, { data: historyRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, pool_id')
      .order('display_name'),
    supabase.from('pools').select('id, name').is('deleted_at', null).order('name'),
    // Hämta alla historiska bilder. Tabellen kan saknas i någon miljö –
    // då faller vi tillbaka på nuvarande avatar_url.
    supabase
      .from('avatar_history')
      .select('id, user_id, url, created_at')
      .order('created_at', { ascending: false }),
  ])

  const profiles = (profilesRaw ?? []) as ProfileRow[]
  const pools = (poolsRaw ?? []) as PoolRow[]
  const history = (historyRaw ?? []) as HistoryRow[]
  const profileById = new Map(profiles.map(p => [p.id, p]))

  type Item = { id: string; name: string; url: string }

  // Vilka URL:er vi redan har visat – så vi inte dubbelvisar nuvarande
  // avatar_url om den också ligger i historiken.
  const seen = new Set<string>()
  const itemsByPool = new Map<number | null, Item[]>()

  function add(key: number | null, item: Item) {
    if (!itemsByPool.has(key)) itemsByPool.set(key, [])
    itemsByPool.get(key)!.push(item)
  }

  // Normalisera URL för dedupe (utan ?t=... query)
  function baseUrl(u: string): string {
    const q = u.indexOf('?')
    return q >= 0 ? u.slice(0, q) : u
  }

  // 1) Lägg in alla historik-rader (nyast först)
  for (const h of history) {
    const prof = profileById.get(h.user_id)
    if (!prof) continue
    const base = baseUrl(h.url)
    if (seen.has(base)) continue
    seen.add(base)
    add(prof.pool_id ?? null, {
      id: `h${h.id}`,
      name: prof.display_name,
      url: h.url,
    })
  }

  // 2) Backfill – nuvarande avatar_url om den inte redan finns i historiken
  for (const p of profiles) {
    if (!p.avatar_url) continue
    const base = baseUrl(p.avatar_url)
    if (seen.has(base)) continue
    seen.add(base)
    add(p.pool_id ?? null, {
      id: `p${p.id}`,
      name: p.display_name,
      url: p.avatar_url,
    })
  }

  const poolSections = pools
    .filter(p => itemsByPool.has(p.id))
    .map(p => ({ id: p.id, name: p.name, items: itemsByPool.get(p.id) ?? [] }))
  const orphanItems = itemsByPool.get(null) ?? []

  const totalAvatars =
    poolSections.reduce((sum, s) => sum + s.items.length, 0) + orphanItems.length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Images size={22} className="text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Bildcollage</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Alla AI-genererade profilbilder (inklusive tidigare versioner) grupperade per liga – {totalAvatars} st totalt.
            Klicka en bild för fullskärm.
          </p>
        </div>
      </div>

      {totalAvatars === 0 ? (
        <div className="rounded-xl p-10 text-center text-sm text-gray-500"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          Inga AI-bilder har skapats än.
        </div>
      ) : (
        <div className="space-y-8">
          {poolSections.map(section => (
            <section key={section.id}>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                <Users size={14} className="text-emerald-400" />
                {section.name}
                <span className="text-xs font-normal text-gray-500">
                  ({section.items.length} {section.items.length === 1 ? 'bild' : 'bilder'})
                </span>
              </h2>
              <AvatarCollage avatars={section.items} />
            </section>
          ))}

          {orphanItems.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                <Users size={14} />
                Utan liga
                <span className="text-xs font-normal text-gray-600">
                  ({orphanItems.length} {orphanItems.length === 1 ? 'bild' : 'bilder'})
                </span>
              </h2>
              <AvatarCollage avatars={orphanItems} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
