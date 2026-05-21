import { createClient } from '@/lib/supabase/server'
import { Settings } from '@/lib/types'
import { Users, CheckSquare, Trophy, Calendar } from 'lucide-react'
import Link from 'next/link'
import { AdminUsersTable } from './AdminUsersTable'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const { data: { user: me } } = await supabase.auth.getUser()

  const [
    { data: profiles },
    { data: matches },
    { data: predictions },
    { data: settings },
  ] = await Promise.all([
    supabase.from('profiles').select('id, display_name, tips_locked, is_admin, avatar_url, avatar_locked'),
    supabase.from('matches').select('id, result_confirmed, stage'),
    supabase.from('predictions').select('id, locked'),
    supabase.from('settings').select('*').single(),
  ])

  const s = settings as Settings | null
  const totalUsers = profiles?.filter(p => !p.is_admin).length ?? 0
  const lockedTips = profiles?.filter(p => p.tips_locked).length ?? 0
  const confirmedMatches = matches?.filter(m => m.result_confirmed).length ?? 0
  const totalMatches = matches?.length ?? 0
  const totalPredictions = predictions?.length ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Översikt</h1>
        <p className="text-gray-400 text-sm mt-1">
          Spelform väljs nu per liga – se{' '}
          <a href="/admin/pools" className="text-emerald-400 hover:underline">Ligor</a>.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Users size={20} />, label: 'Deltagare', value: totalUsers, sub: `${lockedTips} inlämnade`, color: 'blue' },
          { icon: <Calendar size={20} />, label: 'Matcher klara', value: `${confirmedMatches}/${totalMatches}`, sub: 'resultat inlagda', color: 'gold' },
          { icon: <CheckSquare size={20} />, label: 'Tips totalt', value: totalPredictions, sub: 'prediktioner', color: 'green' },
          { icon: <Trophy size={20} />, label: 'Poängsystem', value: `${s?.points_correct_result}/${s?.points_exact_score}`, sub: 'rätt/exakt', color: 'gold' },
        ].map(({ icon, label, value, sub, color }) => {
          const colors = { blue: 'text-blue-400 bg-blue-400/10', gold: 'text-amber-400 bg-amber-400/10', green: 'text-emerald-400 bg-emerald-400/10' }
          return (
            <div key={label} className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className={`inline-flex p-2 rounded-lg ${colors[color as keyof typeof colors]} mb-3`}>{icon}</div>
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
            </div>
          )
        })}
      </div>

      {/* Deltagarlista */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">Deltagare</h2>
          <p className="text-xs text-gray-500">Klicka på AI-bild-knappen för att låsa upp och tillåta ny generering.</p>
        </div>
        <AdminUsersTable
          meUserId={me?.id ?? ''}
          users={(profiles ?? [])
            .map(p => ({
              id: p.id,
              display_name: p.display_name,
              tips_locked: p.tips_locked === true,
              is_admin: p.is_admin === true,
              avatar_url: (p as { avatar_url?: string | null }).avatar_url ?? null,
              avatar_locked: (p as { avatar_locked?: boolean }).avatar_locked === true,
            }))
            .sort((a, b) => a.display_name.localeCompare(b.display_name))}
        />
      </div>

      {/* Snabblänkar */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/admin/results"
          className="rounded-xl p-5 hover:bg-white/5 transition-colors"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="font-semibold text-white mb-1">→ Mata in resultat</div>
          <div className="text-sm text-gray-400">Registrera matchresultat för avslutade matcher</div>
        </Link>
        <Link href="/admin/settings"
          className="rounded-xl p-5 hover:bg-white/5 transition-colors"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="font-semibold text-white mb-1">→ Turneringsinställningar</div>
          <div className="text-sm text-gray-400">Byt läge (A/B), justera poängsystem, lås tips</div>
        </Link>
        <Link href="/admin/bonus"
          className="rounded-xl p-5 hover:bg-white/5 transition-colors"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="font-semibold text-white mb-1">→ Bonustips</div>
          <div className="text-sm text-gray-400">Bekräfta bonusresultat (vinnare, skyttekung osv.)</div>
        </Link>
        <Link href="/admin/backups"
          className="rounded-xl p-5 hover:bg-white/5 transition-colors"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="font-semibold text-white mb-1">→ Backups</div>
          <div className="text-sm text-gray-400">Snapshots av all data – ladda ner, återställ, manuell backup</div>
        </Link>
        <Link href="/admin/pools"
          className="rounded-xl p-5 hover:bg-white/5 transition-colors"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="font-semibold text-white mb-1">→ Ligor</div>
          <div className="text-sm text-gray-400">Hantera tipsligor – skapa, byt namn, flytta medlemmar</div>
        </Link>
      </div>
    </div>
  )
}
