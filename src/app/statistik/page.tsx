import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LeaderboardEntry, Match, Prediction, Profile, Settings, Team } from '@/lib/types'
import { fetchTopScorers } from '@/lib/wc-stats'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  Trophy, Goal, Target, Flame, Activity, Users, BarChart3,
  Star, Crown, Award, Medal,
} from 'lucide-react'

export const revalidate = 60

export default async function StatistikPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: meProfile } = await supabase
    .from('profiles')
    .select('pool_id')
    .eq('id', user.id)
    .single()
  if (!meProfile?.pool_id) redirect('/select-pool')
  const poolId = meProfile.pool_id

  const [
    { data: leaderboardRaw },
    { data: matchesRaw },
    { data: predictionsRaw },
    { data: profilesRaw },
    { data: pool },
    { data: settings },
    topScorers,
  ] = await Promise.all([
    supabase.from('leaderboard').select('*'),
    supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('kickoff_at'),
    supabase.from('predictions').select('*'),
    supabase.from('profiles').select('id, display_name, pool_id'),
    supabase.from('pools').select('*').eq('id', poolId).single(),
    supabase.from('settings').select('*').single(),
    fetchTopScorers(15),
  ])

  const allEntries = (leaderboardRaw ?? []) as LeaderboardEntry[]
  const entries = allEntries.filter(e => e.pool_id === poolId)
  const matches = (matchesRaw ?? []) as Match[]
  const allPredictions = (predictionsRaw ?? []) as Prediction[]
  const allProfiles = (profilesRaw ?? []) as Pick<Profile, 'id' | 'display_name' | 'pool_id'>[]
  const poolMemberIds = new Set(allProfiles.filter(p => p.pool_id === poolId).map(p => p.id))
  const predictions = allPredictions.filter(p => poolMemberIds.has(p.user_id))
  const s = settings as Settings | null

  const totalUsers = entries.length
  const totalPredictions = predictions.length
  const lockedPredictions = predictions.filter(p => p.locked).length
  const totalPointsAwarded = entries.reduce((sum, e) => sum + e.total_points, 0)
  const totalExacts = entries.reduce((sum, e) => sum + e.exact_scores, 0)
  const totalCorrect = entries.reduce((sum, e) => sum + e.correct_results, 0)
  const completedMatches = matches.filter(m => m.result_confirmed).length
  const totalMatches = matches.length

  // Mål (från resultat)
  const totalGoals = matches.reduce(
    (sum, m) => sum + (m.home_score ?? 0) + (m.away_score ?? 0),
    0
  )
  const matchesWithResult = matches.filter(
    m => m.result_confirmed && m.home_score != null && m.away_score != null
  )
  const avgGoalsPerMatch =
    matchesWithResult.length > 0 ? totalGoals / matchesWithResult.length : 0
  const biggestWin = [...matchesWithResult]
    .map(m => ({
      m,
      diff: Math.abs((m.home_score ?? 0) - (m.away_score ?? 0)),
    }))
    .sort((a, b) => b.diff - a.diff)[0]
  const highestScoring = [...matchesWithResult]
    .map(m => ({ m, total: (m.home_score ?? 0) + (m.away_score ?? 0) }))
    .sort((a, b) => b.total - a.total)[0]

  // Mest populära tipset (alla matcher med tips)
  const tallyAll = new Map<string, number>()
  for (const p of predictions) {
    if (!p.locked) continue
    const k = `${p.pred_home}-${p.pred_away}`
    tallyAll.set(k, (tallyAll.get(k) ?? 0) + 1)
  }
  const popularPicks = Array.from(tallyAll.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Per-match: vilken match var mest "lurig" (få rätt) vs lätt (många rätt)
  type MatchDifficulty = {
    match: Match
    correctCount: number
    exactCount: number
    voters: number
  }
  const matchDifficulty: MatchDifficulty[] = matches
    .filter(m => m.result_confirmed && m.home_score != null && m.away_score != null)
    .map(m => {
      const ps = predictions.filter(p => p.match_id === m.id && p.locked)
      const exact = ps.filter(
        p => p.pred_home === m.home_score && p.pred_away === m.away_score
      ).length
      const correct = ps.filter(p => {
        if (p.pred_home === m.home_score && p.pred_away === m.away_score) return true
        const ps_sign = Math.sign(p.pred_home - p.pred_away)
        const real_sign = Math.sign((m.home_score ?? 0) - (m.away_score ?? 0))
        return ps_sign === real_sign
      }).length
      return { match: m, correctCount: correct, exactCount: exact, voters: ps.length }
    })

  const easiestMatch = [...matchDifficulty]
    .filter(m => m.voters > 0)
    .sort((a, b) => b.correctCount / b.voters - a.correctCount / a.voters)[0]
  const hardestMatch = [...matchDifficulty]
    .filter(m => m.voters > 0)
    .sort((a, b) => a.correctCount / a.voters - b.correctCount / b.voters)[0]
  const mostExactMatch = [...matchDifficulty].sort(
    (a, b) => b.exactCount - a.exactCount
  )[0]

  // Snitt och spread
  const avgPoints = totalUsers > 0 ? totalPointsAwarded / totalUsers : 0
  const topPoints = entries[0]?.total_points ?? 0
  const lastPoints = entries[entries.length - 1]?.total_points ?? 0
  const gap = topPoints - lastPoints

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 size={22} className="text-emerald-400" />
            Statistik
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            <span className="text-emerald-400 font-medium">
              {(pool as { name?: string } | null)?.name ?? 'Liga'}
            </span>{' '}
            · all data uppdateras live från databasen
          </p>
        </div>
      </div>

      {/* Översikts-kort */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Pool i siffror
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Stat icon={<Users size={18} />} label="Deltagare" value={totalUsers.toString()} color="green" />
          <Stat icon={<Target size={18} />} label="Tips totalt" value={totalPredictions.toString()} color="blue" />
          <Stat icon={<Flame size={18} />} label="Inlämnade" value={lockedPredictions.toString()} color="purple" />
          <Stat icon={<Trophy size={18} />} label="Avgjorda matcher" value={`${completedMatches}/${totalMatches}`} color="gold" />

          <Stat icon={<Star size={18} />} label="Poäng totalt" value={totalPointsAwarded.toString()} color="green" />
          <Stat icon={<Award size={18} />} label="Snitt per spelare" value={avgPoints.toFixed(1)} color="blue" />
          <Stat icon={<Crown size={18} />} label="Toppoäng" value={topPoints.toString()} color="gold" />
          <Stat icon={<Activity size={18} />} label="Avstånd 1:a–sista" value={gap.toString()} color="purple" />
        </div>
      </section>

      {/* Skytteligan */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Goal size={14} className="text-emerald-400" />
          Skytteligan
          <span className="ml-1 text-[10px] text-gray-500 normal-case">
            (live från football-data.org)
          </span>
        </h2>
        {topScorers.length === 0 ? (
          <div className="rounded-xl p-5 text-sm text-gray-500"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            Inga målgörare än. Listan fylls på när VM startar.
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
            {topScorers.map((s, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              return (
                <div
                  key={`${s.player}-${i}`}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                  style={{ borderColor: '#1f2937', background: '#111827' }}
                >
                  <div className="w-8 text-center shrink-0">
                    {medal ? <span className="text-lg">{medal}</span> :
                      <span className="text-gray-500 text-sm font-medium">{i + 1}</span>}
                  </div>
                  {s.teamCrest && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.teamCrest} alt={s.team} className="w-6 h-6 object-contain shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{s.player}</div>
                    <div className="text-xs text-gray-500 truncate">{s.team}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-bold ${i === 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {s.goals}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">mål</div>
                  </div>
                  {s.assists != null && (
                    <div className="hidden sm:block text-right shrink-0 w-12 border-l pl-3"
                      style={{ borderColor: '#1f2937' }}>
                      <div className="text-sm text-gray-300">{s.assists}</div>
                      <div className="text-[10px] text-gray-500 uppercase">ass</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Pool-stats */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Tipsstatistik
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <InfoCard
            title="Mest exakta resultat"
            icon={<Target size={16} className="text-amber-400" />}
            value={totalExacts.toString()}
            sub={`${totalUsers > 0 ? (totalExacts / totalUsers).toFixed(1) : '0'} per spelare i snitt`}
          />
          <InfoCard
            title="Rätt tecken (1/X/2)"
            icon={<Trophy size={16} className="text-emerald-400" />}
            value={totalCorrect.toString()}
            sub={`${
              completedMatches > 0 && totalUsers > 0
                ? Math.round((totalCorrect / (completedMatches * totalUsers)) * 100)
                : 0
            }% träffsäkerhet`}
          />
          <InfoCard
            title="Match med flest exakta"
            icon={<Star size={16} className="text-amber-400" />}
            value={
              mostExactMatch && mostExactMatch.exactCount > 0
                ? `${mostExactMatch.exactCount} st`
                : '–'
            }
            sub={
              mostExactMatch && mostExactMatch.exactCount > 0
                ? matchLabel(mostExactMatch.match)
                : 'Inga avgjorda matcher än'
            }
          />
          <InfoCard
            title="Lättaste matchen"
            icon={<Award size={16} className="text-emerald-400" />}
            value={
              easiestMatch
                ? `${Math.round((easiestMatch.correctCount / easiestMatch.voters) * 100)}%`
                : '–'
            }
            sub={easiestMatch ? matchLabel(easiestMatch.match) : 'Inga avgjorda matcher än'}
          />
          <InfoCard
            title="Luriga matchen"
            icon={<Flame size={16} className="text-red-400" />}
            value={
              hardestMatch
                ? `${Math.round((hardestMatch.correctCount / hardestMatch.voters) * 100)}%`
                : '–'
            }
            sub={hardestMatch ? matchLabel(hardestMatch.match) : 'Inga avgjorda matcher än'}
          />
          <InfoCard
            title="Poäng per match (snitt)"
            icon={<Activity size={16} className="text-emerald-400" />}
            value={
              completedMatches > 0 && totalUsers > 0
                ? (totalPointsAwarded / (completedMatches * totalUsers)).toFixed(2)
                : '0'
            }
            sub={`${s?.points_correct_result ?? 3}p tecken / ${s?.points_exact_score ?? 5}p exakt`}
          />
        </div>
      </section>

      {/* Målfest */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Goal size={14} className="text-emerald-400" />
          Målstatistik (spelade matcher)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Stat
            icon={<Goal size={18} />}
            label="Totalt antal mål"
            value={totalGoals.toString()}
            color="green"
          />
          <Stat
            icon={<Activity size={18} />}
            label="Mål per match"
            value={avgGoalsPerMatch.toFixed(2)}
            color="blue"
          />
          <Stat
            icon={<Trophy size={18} />}
            label="Största seger"
            value={
              biggestWin
                ? `${biggestWin.m.home_score}–${biggestWin.m.away_score}`
                : '–'
            }
            color="gold"
            small
            secondary={biggestWin ? matchLabel(biggestWin.m) : undefined}
          />
          <Stat
            icon={<Flame size={18} />}
            label="Målrikaste matchen"
            value={
              highestScoring
                ? `${highestScoring.m.home_score}–${highestScoring.m.away_score}`
                : '–'
            }
            color="purple"
            small
            secondary={highestScoring ? matchLabel(highestScoring.m) : undefined}
          />
        </div>
      </section>

      {/* Folkets favorit-tips */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Folkets vanligaste tipps
        </h2>
        {popularPicks.length === 0 ? (
          <div className="rounded-xl p-5 text-sm text-gray-500"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            Inga tips än.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
            {popularPicks.map(([key, count]) => (
              <div
                key={key}
                className="rounded-xl px-3 py-3 text-center"
                style={{ background: '#111827', border: '1px solid #1f2937' }}
              >
                <div className="text-xl font-bold text-emerald-400 font-mono">{key}</div>
                <div className="text-xs text-gray-500 mt-1">{count} ggr</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Topp 5 från tabellen */}
      {entries.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Topp 5 i ligan
            </h2>
            <Link href="/tabell" className="text-xs text-gray-400 hover:text-emerald-400">
              Hela tabellen →
            </Link>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
            {entries.slice(0, 5).map((e, i) => {
              const icons = [
                <Crown key="1" size={16} className="text-amber-400" />,
                <Medal key="2" size={16} className="text-gray-300" />,
                <Award key="3" size={16} className="text-orange-400" />,
              ]
              return (
                <Link
                  key={e.user_id}
                  href={`/spelare/${e.user_id}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${
                    i > 0 ? 'border-t' : ''
                  }`}
                  style={{
                    borderColor: '#1f2937',
                    background: i === 0 ? 'rgba(245,158,11,0.05)' : '#111827',
                  }}
                >
                  <div className="w-8 shrink-0 text-center">
                    {icons[i] ?? (
                      <span className="text-gray-500 text-sm">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${
                      i === 0 ? 'text-amber-400' : 'text-white'
                    }`}>
                      {e.display_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {e.exact_scores} exakta · {e.correct_results} rätt
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      i === 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {e.total_points}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">poäng</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function matchLabel(m: Match): string {
  const home = m.home_team?.name ?? m.home_placeholder ?? '?'
  const away = m.away_team?.name ?? m.away_placeholder ?? '?'
  const date = format(new Date(m.kickoff_at), 'd MMM', { locale: sv })
  return `${home} – ${away} (${date})`
}

function Stat({
  icon, label, value, color, secondary, small,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: 'green' | 'gold' | 'blue' | 'purple'
  secondary?: string
  small?: boolean
}) {
  const colors = {
    green: 'text-emerald-400 bg-emerald-400/10',
    gold: 'text-amber-400 bg-amber-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
  }
  return (
    <div className="rounded-xl p-3 sm:p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
      <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-2`}>{icon}</div>
      <div className={`font-bold text-white ${small ? 'text-lg' : 'text-2xl'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {secondary && (
        <div className="text-[10px] text-gray-600 mt-0.5 truncate">{secondary}</div>
      )}
    </div>
  )
}

function InfoCard({
  title, icon, value, sub,
}: {
  title: string
  icon: React.ReactNode
  value: string
  sub: string
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
        {icon}
        {title}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1 truncate">{sub}</div>
    </div>
  )
}
