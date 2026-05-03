import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FootballAvatarUpload } from '@/components/FootballAvatarUpload'
import { ChangePool } from './ChangePool'
import type { Pool } from '@/lib/types'
import { User, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/select-pool')

  const { data: pool } = profile.pool_id
    ? await supabase.from('pools').select('*').eq('id', profile.pool_id).single()
    : { data: null }
  const currentPool = pool as Pool | null

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <User size={24} className="text-indigo-400" />
          Min profil
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Ladda upp ett foto och AI förvandlar dig till ett fotbollsproffs!
        </p>
      </div>

      <FootballAvatarUpload
        currentAvatar={profile.avatar_url ?? null}
        displayName={profile.display_name}
      />

      {/* Pool */}
      <div className="rounded-xl p-5 space-y-3" style={{ border: '1px solid #1f2937', background: '#0f172a' }}>
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Users size={14} className="text-emerald-400" />
          Tipsliga
        </h2>
        {currentPool ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-white">{currentPool.name}</span>
              <span className="text-xs text-gray-500 font-mono tracking-wider">
                {currentPool.invite_code}
              </span>
            </div>
            {currentPool.description && (
              <p className="text-xs text-gray-500">{currentPool.description}</p>
            )}
            <p className="text-xs text-gray-500">
              Bjud in andra med koden ovan. Du tävlar bara mot andra i samma pool.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400">Du tillhör ingen liga än.</p>
        )}
        <ChangePool currentPoolId={profile.pool_id ?? null} />
      </div>

      <div className="rounded-xl p-5 space-y-3" style={{ border: '1px solid #1f2937', background: '#0f172a' }}>
        <h2 className="text-sm font-semibold text-gray-300">Kontoinformation</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Namn</span>
            <span className="text-white">{profile.display_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">E-post</span>
            <span className="text-white">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className={profile.tips_locked ? 'text-green-400' : 'text-emerald-400'}>
              {profile.tips_locked ? '🔒 Tips inlämnade' : '✏️ Kan fortfarande tippa'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
