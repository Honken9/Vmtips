import { createClient } from '@/lib/supabase/server'
import { Images } from 'lucide-react'
import { AvatarCollage } from './AvatarCollage'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  display_name: string
  avatar_url: string | null
}

export default async function AdminAvatarsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .not('avatar_url', 'is', null)
    .order('display_name')

  const avatars = ((data ?? []) as Row[])
    .filter(r => !!r.avatar_url)
    .map(r => ({ id: r.id, name: r.display_name, url: r.avatar_url as string }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Images size={22} className="text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Bildcollage</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Alla AI-genererade profilbilder – {avatars.length} st. Klicka på en bild för fullskärm.
          </p>
        </div>
      </div>

      {avatars.length === 0 ? (
        <div className="rounded-xl p-10 text-center text-sm text-gray-500"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          Inga AI-bilder har skapats än.
        </div>
      ) : (
        <AvatarCollage avatars={avatars} />
      )}
    </div>
  )
}
