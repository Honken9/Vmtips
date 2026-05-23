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

export default async function AdminAvatarsPage() {
  const supabase = await createClient()
  const [{ data: profilesRaw }, { data: poolsRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, pool_id')
      .not('avatar_url', 'is', null)
      .order('display_name'),
    supabase.from('pools').select('id, name').is('deleted_at', null).order('name'),
  ])

  const profiles = (profilesRaw ?? []) as ProfileRow[]
  const pools = (poolsRaw ?? []) as PoolRow[]
  const poolName = new Map(pools.map(p => [p.id, p.name]))

  type Item = { id: string; name: string; url: string }
  const byPool = new Map<number | null, Item[]>()
  for (const p of profiles) {
    if (!p.avatar_url) continue
    const key = p.pool_id ?? null
    if (!byPool.has(key)) byPool.set(key, [])
    byPool.get(key)!.push({ id: p.id, name: p.display_name, url: p.avatar_url })
  }

  // Sortera: först alla ligor i bokstavsordning, sen "utan liga" sist
  const poolSections = pools
    .filter(p => byPool.has(p.id))
    .map(p => ({ id: p.id, name: p.name, items: byPool.get(p.id) ?? [] }))
  const orphanItems = byPool.get(null) ?? []

  const totalAvatars = profiles.length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Images size={22} className="text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Bildcollage</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Alla AI-genererade profilbilder grupperade per liga – {totalAvatars} st totalt.
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

          {poolName.size > 0 && poolSections.length === 0 && orphanItems.length === 0 && (
            <p className="text-sm text-gray-500 italic">Inga avatarer per liga än.</p>
          )}
        </div>
      )}
    </div>
  )
}
