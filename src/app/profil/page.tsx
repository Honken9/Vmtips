import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FootballAvatarUpload } from '@/components/FootballAvatarUpload'
import { User, Mail, Lock, Pencil, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

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

  const memberSince = profile.created_at
    ? format(new Date(profile.created_at), 'd MMM yyyy', { locale: sv })
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
          <User size={26} className="text-indigo-400" />
          Min profil
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Ladda upp ett foto och AI förvandlar dig till ett fotbollsproffs.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Vänster: AI-avataren – tar mest plats */}
        <div className="lg:col-span-2">
          <FootballAvatarUpload
            currentAvatar={profile.avatar_url ?? null}
            displayName={profile.display_name}
            userId={user.id}
            initialGenerating={profile.avatar_generating === true}
            locked={profile.avatar_locked === true}
          />
        </div>

        {/* Höger: kontoinfo */}
        <aside className="space-y-6">
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid #1f2937' }}
          >
            <div
              className="px-5 py-3 flex items-center gap-2"
              style={{ background: '#1f2937' }}
            >
              <User size={16} className="text-indigo-400" />
              <span className="text-sm font-semibold text-white">Konto</span>
            </div>
            <div
              className="px-5 py-4 space-y-4"
              style={{ background: '#0f172a' }}
            >
              <Field
                icon={<User size={14} />}
                label="Namn"
                value={profile.display_name}
              />
              <Field
                icon={<Mail size={14} />}
                label="E-post"
                value={user.email ?? '–'}
                mono
              />
              {memberSince && (
                <Field
                  icon={<Calendar size={14} />}
                  label="Medlem sedan"
                  value={memberSince}
                />
              )}
              <Field
                icon={profile.tips_locked ? <Lock size={14} /> : <Pencil size={14} />}
                label="Tipsstatus"
                value={profile.tips_locked ? 'Inlämnade' : 'Kan ändras'}
                color={profile.tips_locked ? 'text-green-400' : 'text-emerald-400'}
              />
              {profile.is_admin && (
                <Field
                  icon={<User size={14} />}
                  label="Roll"
                  value="Admin"
                  color="text-amber-400"
                />
              )}
            </div>
          </div>

          <div
            className="rounded-xl p-4 text-xs text-gray-500"
            style={{ background: '#0f172a', border: '1px solid #1f2937' }}
          >
            Liga-medlemskap hanteras via dropdown:en längst upp i högra hörnet
            (klicka liga-namnet i navbaren).
          </div>
        </aside>
      </div>
    </div>
  )
}

function Field({
  icon,
  label,
  value,
  mono,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
  color?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
        {icon}
        {label}
      </div>
      <div
        className={`text-sm break-words ${color ?? 'text-white'} ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </div>
    </div>
  )
}
