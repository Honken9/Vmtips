import { createClient } from '@/lib/supabase/server'
import { LeaderboardTable } from '@/components/LeaderboardTable'
import { TrophyLogo } from '@/components/TrophyLogo'
import { Settings } from '@/lib/types'
import { Trophy, Users, CheckCircle, Star } from 'lucide-react'

export const revalidate = 30

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: leaderboard }, { data: settings }, { data: matchStats }] = await Promise.all([
    supabase.from('leaderboard').select('*'),
    supabase.from('settings').select('*').single(),
    supabase
      .from('matches')
      .select('result_confirmed')
  ])

  const s: Settings = settings ?? {
    id: 1, tournament_mode: 'B', mode_a_global_lock: false,
    points_correct_result: 3, points_exact_score: 5,
    points_winner: 10, points_finalist: 5,
    updated_at: new Date().toISOString(),
  }
  const entries = leaderboard ?? []
  const totalMatches = matchStats?.length ?? 0
  const completedMatches = matchStats?.filter(m => m.result_confirmed).length ?? 0
  const participantsWithTips = entries.filter(e => e.predictions_graded > 0).length

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div
        className="rounded-2xl p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          border: '1px solid #1f2937',
        }}
      >
        <div className="relative z-10">
          <TrophyLogo size="lg" />
          <p className="mt-3 text-gray-400 max-w-lg">
            Välkommen till VM-tipset! Tippa alla matcher och följ din placering live i tabellen.
          </p>
          {s && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
              {s.tournament_mode === 'A'
                ? '📋 Läge A – Tips lämnas in innan turneringen'
                : '⚡ Läge B – Tips per match, låses vid avspark'}
            </div>
          )}
        </div>
        {/* Bakgrundsdekoration */}
        <div
          className="absolute right-0 top-0 w-64 h-64 opacity-5"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Statistikkort */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={20} />}
          label="Deltagare"
          value={entries.length}
          color="blue"
        />
        <StatCard
          icon={<Trophy size={20} />}
          label="Matcher spelade"
          value={`${completedMatches} / ${totalMatches}`}
          color="gold"
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          label="Tips inlämnade"
          value={entries.filter(e => e.tips_locked).length}
          color="green"
        />
        <StatCard
          icon={<Star size={20} />}
          label="Poäng – ledare"
          value={entries[0]?.total_points ?? 0}
          color="gold"
        />
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Tabell</h2>
        <LeaderboardTable entries={entries} participantsWithTips={participantsWithTips} />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: 'blue' | 'gold' | 'green'
}) {
  const colors = {
    blue: 'text-blue-400 bg-blue-400/10',
    gold: 'text-amber-400 bg-amber-400/10',
    green: 'text-green-400 bg-green-400/10',
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: '#111827', border: '1px solid #1f2937' }}
    >
      <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-3`}>{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
