import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LeaderboardTable } from '@/components/LeaderboardTable'
import { LeaderboardEntry, Match, Prediction, Settings, Profile, Pool } from '@/lib/types'
import { calcDailyWinner, popularPicks, topExactScorer, stockholmToday } from '@/lib/stats'
import { calcPot, calcPayouts, formatKr } from '@/lib/payments'
import { Flag } from '@/components/Flag'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Trophy, Users, CheckCircle, Star, Crown, Target, TrendingUp, Calendar } from 'lucide-react'

export const revalidate = 30

export default async function LeaderboardPage() {
  const supabase = await createClient()

  // Aktuell användare → vilken pool ska visas?
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: meProfile } = await supabase
    .from('profiles')
    .select('pool_id, is_admin')
    .eq('id', user.id)
    .single()
  if (!meProfile?.pool_id) redirect('/select-pool')

  const poolId = meProfile.pool_id
  const isAdmin = meProfile.is_admin === true

  const [
    { data: leaderboardRaw },
    { data: settings },
    { data: matchesRaw },
    { data: predictionsRaw },
    { data: profilesRaw },
    { data: pool },
    { data: paymentsRaw },
  ] = await Promise.all([
    supabase.from('leaderboard').select('*'),
    supabase.from('settings').select('*').single(),
    supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('kickoff_at'),
    supabase.from('predictions').select('*'),
    supabase.from('profiles').select('id, display_name, pool_id'),
    supabase.from('pools').select('*').eq('id', poolId).single(),
    supabase.from('pool_payments').select('paid').eq('pool_id', poolId),
  ])

  // Filtrera till bara medlemmar i samma pool
  const leaderboard = (leaderboardRaw ?? []).filter(
    (e: LeaderboardEntry) => e.pool_id === poolId
  )
  const memberIds = new Set(
    (profilesRaw ?? [])
      .filter((p: Pick<Profile, 'id' | 'pool_id'>) => p.pool_id === poolId)
      .map((p: Pick<Profile, 'id'>) => p.id)
  )
  const predictionsInPool = (predictionsRaw ?? []).filter((p: Prediction) =>
    memberIds.has(p.user_id)
  )

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

  const entries = leaderboard as LeaderboardEntry[]
  const matches = (matchesRaw ?? []) as Match[]
  const predictions = predictionsInPool
  const profiles = ((profilesRaw ?? []).filter(
    (p: Pick<Profile, 'pool_id'>) => p.pool_id === poolId
  )) as Pick<Profile, 'id' | 'display_name'>[]
  const currentPool = pool as Pool | null

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

  // Pottberäkning (visas bara om ligan har avgift)
  const fee = currentPool?.entry_fee ?? 0
  const payments = (paymentsRaw ?? []) as { paid: boolean }[]
  const paidCount = payments.filter(p => p.paid).length
  const { paidTotal } = calcPot({
    entryFee: fee,
    paidCount,
    totalMembers: entries.length,
  })
  const distribution = currentPool?.prize_distribution ?? { '1': 1.0 }
  const payouts = calcPayouts({
    totalPot: paidTotal,
    distribution,
    ranking: entries,
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Tabell & statistik</h1>
          <p className="text-gray-400 text-sm mt-1">
            <span className="text-emerald-400 font-medium">{currentPool?.name ?? 'Liga'}</span>
            {' · '}
            {entries.length} deltagare · {completedMatches} av {totalMatches} matcher avgjorda
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/pools"
            className="text-xs text-gray-400 hover:text-emerald-400 transition-colors"
          >
            Hantera ligor →
          </Link>
        )}
      </div>

      {/* Pott-banner – bara om ligan har avgift */}
      {fee > 0 && (
        <Link
          href="/liga"
          className="block rounded-2xl p-4 sm:p-5 hover:brightness-110 transition-all"
          style={{
            background: 'linear-gradient(135deg, #0c2823 0%, #14202e 50%, #0a3d2a 100%)',
            border: '1px solid #1f2937',
          }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                Prispott
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tabular-nums leading-tight">
                {formatKr(paidTotal)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {paidCount} av {entries.length} har betalt · {formatKr(fee)} per spelare
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {payouts.slice(0, 3).map(p => {
                const medals = ['🥇', '🥈', '🥉']
                return (
                  <div
                    key={p.place}
                    className="rounded-lg px-3 py-1.5"
                    style={{
                      background: p.place === 1 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${p.place === 1 ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{medals[p.place - 1] ?? `#${p.place}`}</span>
                      <span className={`text-sm font-bold ${p.place === 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {formatKr(p.amount)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Link>
      )}

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
                  className={`px-3 sm:px-5 py-3 ${i > 0 ? 'border-t' : ''}`}
                  style={{ borderColor: '#1f2937', background: '#111827' }}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-[11px] sm:text-xs text-gray-500 w-16 sm:w-28 shrink-0 leading-tight">
                      {kickoff}
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                      <span className="text-sm text-white truncate">{home?.name ?? '?'}</span>
                      <Flag emoji={home?.flag ?? null} name={home?.name} width={20} height={14} className="shrink-0" />
                    </div>
                    <div className="shrink-0 w-14 sm:w-20 text-center">
                      <span className="text-emerald-400 font-bold">
                        {p.pred_home}–{p.pred_away}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Flag emoji={away?.flag ?? null} name={away?.name} width={20} height={14} className="shrink-0" />
                      <span className="text-sm text-white truncate">{away?.name ?? '?'}</span>
                    </div>
                    <div className="hidden sm:flex flex-col items-end shrink-0 w-32">
                      <div className="text-xs text-gray-500">
                        {p.votes} av {p.total} ({sharePct}%)
                      </div>
                      <div className="w-full h-1.5 bg-gray-800 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${sharePct}%` }} />
                      </div>
                    </div>
                  </div>
                  {/* Vote-bar på egen rad på mobil */}
                  <div className="sm:hidden mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${sharePct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 shrink-0">
                      {p.votes}/{p.total}
                    </span>
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
    green: 'text-emerald-400 bg-emerald-400/10',
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
