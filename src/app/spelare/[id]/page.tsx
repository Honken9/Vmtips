import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeaderboardEntry, Match, Prediction, Profile, Settings } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  ArrowLeft, Crown, Trophy, Target, CheckCircle, XCircle, Clock,
  Star, Award, User as UserIcon,
} from 'lucide-react'

export const revalidate = 30

export default async function SpelarePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: meProfile } = await supabase
    .from('profiles')
    .select('pool_id')
    .eq('id', user.id)
    .single()
  if (!meProfile?.pool_id) redirect('/select-pool')
  const myPoolId = meProfile.pool_id

  // Hämta målprofilen
  const { data: target } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!target) notFound()

  // Bara samma pool – annars 404
  if ((target as Profile).pool_id !== myPoolId) notFound()

  const [
    { data: leaderboardRaw },
    { data: matchesRaw },
    { data: predictionsRaw },
    { data: settings },
  ] = await Promise.all([
    supabase.from('leaderboard').select('*'),
    supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('kickoff_at'),
    supabase.from('predictions').select('*').eq('user_id', id).order('match_id'),
    supabase.from('settings').select('*').single(),
  ])

  const leaderboard = (leaderboardRaw ?? []) as LeaderboardEntry[]
  const poolEntries = leaderboard.filter(e => e.pool_id === myPoolId)
  const myEntry = poolEntries.find(e => e.user_id === id) ?? null
  const myRank = myEntry
    ? poolEntries.findIndex(e => e.user_id === id) + 1
    : null

  const matches = (matchesRaw ?? []) as Match[]
  const predictions = (predictionsRaw ?? []) as Prediction[]
  const s = settings as Settings | null

  const matchById = new Map(matches.map(m => [m.id, m]))

  // Räkna ut poäng per tipps
  type Row = {
    p: Prediction
    m: Match
    pts: number
    isExact: boolean
    isCorrect: boolean
  }
  const rows: Row[] = predictions
    .map(p => {
      const m = matchById.get(p.match_id)
      if (!m) return null
      let pts = 0
      let isExact = false
      let isCorrect = false
      if (m.result_confirmed && m.home_score != null && m.away_score != null) {
        if (p.pred_home === m.home_score && p.pred_away === m.away_score) {
          pts = s?.points_exact_score ?? 5
          isExact = true
          isCorrect = true
        } else {
          const ps = Math.sign(p.pred_home - p.pred_away)
          const rs = Math.sign(m.home_score - m.away_score)
          if (ps === rs) {
            pts = s?.points_correct_result ?? 3
            isCorrect = true
          }
        }
      }
      return { p, m, pts, isExact, isCorrect }
    })
    .filter((x): x is Row => x !== null)

  const recentResults = rows
    .filter(r => r.m.result_confirmed)
    .sort((a, b) => b.m.kickoff_at.localeCompare(a.m.kickoff_at))
    .slice(0, 10)

  const upcoming = rows
    .filter(r => !r.m.result_confirmed)
    .sort((a, b) => a.m.kickoff_at.localeCompare(b.m.kickoff_at))
    .slice(0, 5)

  const targetProfile = target as Profile

  return (
    <div className="space-y-6">
      <Link
        href="/tabell"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-emerald-400 transition-colors"
      >
        <ArrowLeft size={14} />
        Tillbaka till tabellen
      </Link>

      {/* Hero */}
      <div
        className="rounded-2xl p-5 sm:p-6 flex items-center gap-4"
        style={{
          background: 'linear-gradient(135deg, #0c2823 0%, #14202e 50%, #0a3d2a 100%)',
          border: '1px solid #1f2937',
        }}
      >
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0"
          style={{ border: '2px solid #334155' }}>
          {targetProfile.avatar_url ? (
            <Image src={targetProfile.avatar_url} alt={targetProfile.display_name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {targetProfile.display_name?.slice(0, 2).toUpperCase() ?? '?'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
            {targetProfile.display_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {myRank != null && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-400/15 text-amber-400">
                {myRank === 1 && <Crown size={12} />}
                Plats #{myRank}
              </span>
            )}
            {targetProfile.is_admin && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300">
                <UserIcon size={12} />
                Admin
              </span>
            )}
            {targetProfile.tips_locked && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400">
                <CheckCircle size={12} />
                Tips inlämnade
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Stat icon={<Trophy size={18} />} label="Poäng" value={myEntry?.total_points ?? 0} color="gold" />
        <Stat icon={<Target size={18} />} label="Exakta" value={myEntry?.exact_scores ?? 0} color="green" />
        <Stat icon={<CheckCircle size={18} />} label="Rätt tecken" value={myEntry?.correct_results ?? 0} color="blue" />
        <Stat icon={<Star size={18} />} label="Bonuspoäng" value={myEntry?.bonus_points ?? 0} color="purple" />
      </div>

      {/* Senaste resultat */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Senaste resultat
        </h2>
        {recentResults.length === 0 ? (
          <div className="rounded-xl p-5 text-sm text-gray-500"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            Inga avgjorda matcher än.
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
            {recentResults.map((r, i) => (
              <PredictionRow key={r.p.id} row={r} isLast={i === recentResults.length - 1} />
            ))}
          </div>
        )}
      </section>

      {/* Kommande tipps */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Kommande tipps
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
            {upcoming.map((r, i) => (
              <PredictionRow key={r.p.id} row={r} isLast={i === upcoming.length - 1} hideOutcome />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({
  icon, label, value, color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: 'gold' | 'green' | 'blue' | 'purple'
}) {
  const colors = {
    gold: 'text-amber-400 bg-amber-400/10',
    green: 'text-emerald-400 bg-emerald-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
  }
  return (
    <div className="rounded-xl p-3 sm:p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
      <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-2`}>{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function PredictionRow({
  row, isLast, hideOutcome,
}: {
  row: { p: import('@/lib/types').Prediction; m: import('@/lib/types').Match; pts: number; isExact: boolean; isCorrect: boolean }
  isLast: boolean
  hideOutcome?: boolean
}) {
  const m = row.m
  const home = m.home_team?.name ?? m.home_placeholder ?? '?'
  const away = m.away_team?.name ?? m.away_placeholder ?? '?'
  const homeFlag = m.home_team?.flag ?? ''
  const awayFlag = m.away_team?.flag ?? ''
  const date = format(new Date(m.kickoff_at), 'd MMM HH:mm', { locale: sv })

  return (
    <div
      className={`px-3 sm:px-4 py-3 ${!isLast ? 'border-b' : ''}`}
      style={{
        borderColor: '#1f2937',
        background: row.isExact
          ? 'rgba(245,158,11,0.05)'
          : row.isCorrect
            ? 'rgba(16,185,129,0.04)'
            : '#111827',
      }}
    >
      <div className="text-[11px] text-gray-500 mb-1.5">{date}</div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
          <span className="text-sm text-white truncate">{home}</span>
          {homeFlag && <Flag emoji={homeFlag} name={home} width={20} height={14} className="shrink-0" />}
        </div>
        <div className="shrink-0 w-20 text-center">
          {m.result_confirmed ? (
            <div className="text-white font-bold text-sm">
              {m.home_score}–{m.away_score}
            </div>
          ) : (
            <div className="text-gray-600 text-xs flex items-center justify-center gap-1">
              <Clock size={10} />
              vs
            </div>
          )}
          <div className="text-[10px] text-gray-500 mt-0.5">
            tipps: <span className="text-emerald-400 font-medium">{row.p.pred_home}–{row.p.pred_away}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {awayFlag && <Flag emoji={awayFlag} name={away} width={20} height={14} className="shrink-0" />}
          <span className="text-sm text-white truncate">{away}</span>
        </div>
        {!hideOutcome && (
          <div className="shrink-0 w-12 text-right">
            {m.result_confirmed ? (
              row.isExact ? (
                <div className="flex flex-col items-center text-amber-400">
                  <Award size={16} />
                  <span className="text-xs font-bold">+{row.pts}</span>
                </div>
              ) : row.isCorrect ? (
                <div className="flex flex-col items-center text-emerald-400">
                  <CheckCircle size={16} />
                  <span className="text-xs font-bold">+{row.pts}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-red-400 opacity-60">
                  <XCircle size={16} />
                  <span className="text-xs">0</span>
                </div>
              )
            ) : (
              <span className="text-gray-600 text-xs">–</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
