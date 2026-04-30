import { createClient } from '@/lib/supabase/server'
import { Settings } from '@/lib/types'
import { Users, CheckSquare, Trophy, Calendar } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { data: profiles },
    { data: matches },
    { data: predictions },
    { data: settings },
  ] = await Promise.all([
    supabase.from('profiles').select('id, display_name, tips_locked, is_admin'),
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
          Turneringsläge: <span className="text-white font-medium">
            {s?.tournament_mode === 'A' ? 'A – Allt på en gång' : 'B – Löpande per match'}
          </span>
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
          const colors = { blue: 'text-blue-400 bg-blue-400/10', gold: 'text-amber-400 bg-amber-400/10', green: 'text-green-400 bg-green-400/10' }
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
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#1f2937' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Namn</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Tips inlämnade</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Roll</th>
              </tr>
            </thead>
            <tbody>
              {profiles?.sort((a, b) => a.display_name.localeCompare(b.display_name)).map((p, i) => (
                <tr key={p.id}
                  className="border-t hover:bg-white/5 transition-colors"
                  style={{ borderColor: '#1f2937' }}>
                  <td className="px-4 py-3 text-sm text-white">{p.display_name}</td>
                  <td className="px-4 py-3 text-right">
                    {p.tips_locked
                      ? <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">✓ Inlämnade</span>
                      : <span className="text-xs text-gray-500">Ej inlämnade</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.is_admin
                      ? <span className="text-xs text-indigo-400">Admin</span>
                      : <span className="text-xs text-gray-500">Deltagare</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      </div>
    </div>
  )
}
