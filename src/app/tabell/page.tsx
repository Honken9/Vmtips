import { createClient } from '@/lib/supabase/server'
import { LeaderboardTable } from '@/components/LeaderboardTable'
import { LeaderboardEntry, Match, Prediction, Settings, Profile } from '@/lib/types'
import { calcDailyWinner, popularPicks, topExactScorer, stockholmToday } from '@/lib/stats'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Trophy, Users, CheckCircle, Star, Crown, Target, TrendingUp, Calendar } from 'lucide-react'

export const revalidate = 30

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const [
    { data: leaderboard },
    { data: settings },
    { data: matchesRaw },
    { data: predictionsRaw },
    { data: profilesRaw },
  ] = await Promise.all([
    supabase.from('leaderboard').select('*'),
    supabase.from('settings').select('*').single(),
    supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('kickoff_at'),
    supabase.from('predictions').select('*'),
    supabase.from('profiles').select('id, display_name'),
  ])

  const s: Settings = settings ?? {
    id: 1,
    tournament_mode: 'B',
    mode_a_global_lock: false,
    points_correct_result: 3,
    points_exact_score: 5,
    points_winner: 10,
    points_finalist: 5,
    updated_at: new Date().toISOString(),
  }

  const entries = (leaderboard ?? []) as LeaderboardEntry[]
  const matches = (matchesRaw ?? []) as Match[]
  const predictions = (predictionsRaw ?? []) as Prediction[]
  const profiles = (profilesRaw ?? []) as Pick<Profile, 'id' | 'display_name'>[]

  const totalMatches = matches.length
  const completedMatches = matches.filter(m => m.result_confirmed).length
  const participantsWithTips = entries.filter(e => e.predictions_graded > 0).length

  const profilesById = new Map(profiles.map(p => [p.id, p.display_name]))
  const ymd = stockholmToday()
  const dailyWinner = calcDailyWinner({
    matches,
    predictions,
    profilesById,
    settings: s,
    ymd,
  })
  const exactKing = topExactScorer(entries)
  const leader = entries[0] ?? null
  const popular = popularPicks({ matches, predictions, limit: 5 })

  const todayLabel = format(new Date(), 'EEE d MMM', { locale: sv })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Tabell & statistik</h1>
        <p className="text-gray-400 text-sm mt-1">
          {entries.length} deltagare · {completedMatches} av {totalMatches} matcher avgjorda
        </p>
      </div>

      {/* Statistik-kort */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox
          icon={<Crown size={20} />}
          color="gold"
          label="Ledare hittills"
          primary={leader?.display_name ?? '–'}
          secondary={leader ? `${leader.total_points} poäng` : 'Inga deltagare'}
        />
        <StatBox
          icon={<Calendar size={20} />}
          color="blue"
          label={`Dagens vinnare (${todayLabel})`}
          primary={dailyWinner?.display_name ?? '–'}
          secondary={
            dailyWinner
              ? `${dailyWinner.points} p · ${dailyWinner.matches} matcher`
              : 'Inga matcher avgjorda idag'
          }
        />
        <StatBox
          icon={<Target size={20} />}
          color="green"
          label="Mest exakta resultat"
          primary={exactKing?.display_name ?? '–'}
          secondary={exactKing ? `${exactKing.exact_scores} st` : '–'}
        />
        <StatBox
          icon={<TrendingUp size={20} />}
          color="purple"
          label="Tips inlämnade"
          primary={`${entries.filter(e => e.tips_locked).length} / ${entries.length}`}
          secondary={`${participantsWithTips} har poäng`}
        />
      </div>

      {/* Smaller stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SmallStat icon={<Users size={16} />} label="Deltagare" value={entries.length} />
        <SmallStat icon={<Trophy size={16} />} label="Matcher klara" value={`${completedMatches} / ${totalMatches}`} />
        <SmallStat icon={<CheckCircle size={16} />} label="Tips inlämnade" value={entries.filter(e => e.tips_locked).length} />
        <SmallStat icon={<Star size={16} />} label="Topp-poäng" value={leader?.total_points ?? 0} />
      </div>

      {/* Leaderboard */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Tabell</h2>
        <LeaderboardTable entries={entries} participantsWithTips={participantsWithTips} />
      </section>

      {/* Mest populära tips */}
      {popular.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-white mb-4">Folkets favorit – kommande matcher</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
            {popular.map((p, i) => {
              const home = p.home_team
              const away = p.away_team
              const kickoff = format(new Date(p.kickoff_at), 'EEE d MMM HH:mm', { locale: sv })
              const sharePct = p.total > 0 ? Math.round((p.votes / p.total) * 100) : 0
              return (
                <div
                  key={p.match_id}
                  className={`flex items-center gap-4 px-5 py-3 ${i > 0 ? 'border-t' : ''}`}
                  style={{ borderColor: '#1f2937', background: '#111827' }}
                >
                  <div className="text-xs text-gray-500 w-28 shrink-0">{kickoff}</div>
                  <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                    <span className="text-sm text-white truncate">{home?.name ?? '?'}</span>
                    <span className="text-base">{home?.flag ?? '🏴'}</span>
                  </div>
                  <div className="shrink-0 w-20 text-center">
                    <span className="text-amber-400 font-bold">
                      {p.pred_home} – {p.pred_away}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base">{away?.flag ?? '🏴'}</span>
                    <span className="text-sm text-white truncate">{away?.name ?? '?'}</span>
                  </div>
                  <div className="hidden sm:flex flex-col items-end shrink-0 w-32">
                    <div className="text-xs text-gray-500">
                      {p.votes} av {p.total} ({sharePct}%)
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${sharePct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function StatBox({
  icon,
  color,
  label,
  primary,
  secondary,
}: {
  icon: React.ReactNode
  color: 'blue' | 'gold' | 'green' | 'purple'
  label: string
  primary: string
  secondary: string
}) {
  const colors = {
    blue: 'text-blue-400 bg-blue-400/10',
    gold: 'text-amber-400 bg-amber-400/10',
    green: 'text-green-400 bg-green-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
  }
  return (
    <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
      <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-3`}>{icon}</div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-lg font-bold text-white truncate">{primary}</div>
      <div className="text-xs text-gray-400 mt-0.5 truncate">{secondary}</div>
    </div>
  )
}

function SmallStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: '#111827', border: '1px solid #1f2937' }}
    >
      <div className="text-gray-500">{icon}</div>
      <div>
        <div className="text-base font-bold text-white">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  )
}
