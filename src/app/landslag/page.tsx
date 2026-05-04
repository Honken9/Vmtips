import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Team } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { Globe } from 'lucide-react'

export const revalidate = 3600

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export default async function LandslagPage() {
  const supabase = await createClient()
  const { data: teamsData } = await supabase
    .from('teams')
    .select('*')
    .order('group_name')
    .order('name')
  const teams = (teamsData ?? []) as Team[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Globe size={22} className="text-emerald-400" />
          Landslag
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {teams.length} lag i VM 2026 – klicka på ett land för fakta, trupp och statistik.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GROUPS.map(group => {
          const groupTeams = teams.filter(t => t.group_name === group)
          if (groupTeams.length === 0) return null
          return (
            <div
              key={group}
              className="rounded-xl overflow-hidden"
              style={{ background: '#111827', border: '1px solid #1f2937' }}
            >
              <div
                className="px-4 py-2.5"
                style={{ background: 'linear-gradient(135deg, #1f2937, #1a1a2e)' }}
              >
                <span className="font-bold text-emerald-400">Grupp {group}</span>
              </div>
              <div className="divide-y" style={{ borderColor: '#1f2937' }}>
                {groupTeams.map(t => (
                  <Link
                    key={t.id}
                    href={`/landslag/${t.code}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
                  >
                    <Flag emoji={t.flag} name={t.name} width={28} height={20} />
                    <span className="text-sm font-medium text-white flex-1 truncate">
                      {t.name}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{t.code}</span>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {teams.length === 0 && (
        <div className="rounded-xl p-8 text-center text-gray-500"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          Inga lag inlagda än.
        </div>
      )}
    </div>
  )
}
