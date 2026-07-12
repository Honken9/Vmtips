import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BonusPrediction, BonusResults, LeaderboardEntry, Match, Prediction, Profile, Settings, Team, STAGE_LABELS, Stage, sortLeaderboard } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { stockholmDateTime } from '@/lib/dates'
import { resolveBracket, stripConfirmedResults } from '@/lib/bracket'
import { calcKnockoutPoints, teamIdsPerRound, TEAM_POINTS_PER_ROUND, CHAMPION_POINTS, KNOCKOUT_ROUNDS } from '@/lib/knockout-points'
import {
  ArrowLeft, Crown, Trophy, Target, CheckCircle, XCircle, Clock,
  Star, Award, User as UserIcon, ShieldCheck,
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
    .select('pool_id, is_admin')
    .eq('id', user.id)
    .single()
  if (!meProfile?.pool_id) redirect('/select-pool')
  const myPoolId = meProfile.pool_id
  const meIsAdmin = meProfile.is_admin === true

  // Hämta målprofilen
  const { data: target } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!target) notFound()

  // Vanliga spelare ser bara samma pool. Master admin ser alla.
  if (!meIsAdmin && (target as Profile).pool_id !== myPoolId) notFound()

  const [
    { data: leaderboardRaw },
    { data: matchesRaw },
    { data: predictionsRaw },
    { data: settings },
    { data: bonusRaw },
    { data: bonusResultsRaw },
    { data: teamsRaw },
  ] = await Promise.all([
    supabase.from('leaderboard').select('*'),
    supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('kickoff_at'),
    supabase.from('predictions').select('*').eq('user_id', id).order('match_id'),
    supabase.from('settings').select('*').single(),
    meIsAdmin
      ? supabase.from('bonus_predictions').select('*').eq('user_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
    meIsAdmin
      ? supabase.from('bonus_results').select('*').eq('id', 1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('teams').select('*'),
  ])

  const leaderboard = (leaderboardRaw ?? []) as LeaderboardEntry[]
  const poolEntries = sortLeaderboard(leaderboard.filter(e => e.pool_id === myPoolId))
  const myEntry = poolEntries.find(e => e.user_id === id) ?? null
  const myRank = myEntry
    ? poolEntries.findIndex(e => e.user_id === id) + 1
    : null

  const matches = (matchesRaw ?? []) as Match[]
  const predictions = (predictionsRaw ?? []) as Prediction[]
  const s = settings as Settings | null

  const matchById = new Map(matches.map(m => [m.id, m]))
  const teamsEarly = (teamsRaw ?? []) as Team[]

  // Spelarens eget slutspelsträd behövs redan här: slutspelsradernas
  // poäng är lagpoäng (3p per rätt lag i matchens omgång), inte tecken.
  const ownBracketEarly = resolveBracket(stripConfirmedResults(matches), teamsEarly, predictions)
  const ownRoundSets = teamIdsPerRound(ownBracketEarly)

  // Räkna ut poäng per tipps
  type Row = {
    p: Prediction
    m: Match
    pts: number
    isExact: boolean
    isCorrect: boolean
    /** Slutspel: lagpoäng för matchen (0/3/6), null = lag ej kända än */
    knockoutPts: number | null
  }
  const rows: Row[] = predictions
    .map(p => {
      const m = matchById.get(p.match_id)
      if (!m) return null
      let pts = 0
      let isExact = false
      let isCorrect = false
      let knockoutPts: number | null = null
      if (m.stage === 'group' && m.result_confirmed && m.home_score != null && m.away_score != null) {
        // Gruppspel: tecken-/exaktpoäng på siffrorna
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
      } else if (m.stage !== 'group' && m.stage !== '3rd') {
        // Slutspel: 3p per lag i den verkliga matchen som spelaren har
        // med i samma omgång i sitt träd. Poängen finns så fort de
        // verkliga lagen är kända – matchen behöver inte vara spelad.
        const set = ownRoundSets[m.stage as keyof typeof ownRoundSets]
        if (m.home_team_id != null && m.away_team_id != null && set) {
          knockoutPts =
            ([m.home_team_id, m.away_team_id].filter(id => set.has(id)).length) *
            TEAM_POINTS_PER_ROUND
          pts = knockoutPts
          isCorrect = knockoutPts > 0
          isExact = knockoutPts >= TEAM_POINTS_PER_ROUND * 2
        }
      }
      return { p, m, pts, isExact, isCorrect, knockoutPts }
    })
    .filter((x): x is Row => x !== null)

  // Vanliga spelare ser bara begränsat urval; admin ser allt.
  const recentResults = rows
    .filter(r => r.m.result_confirmed)
    .sort((a, b) => b.m.kickoff_at.localeCompare(a.m.kickoff_at))
    .slice(0, meIsAdmin ? rows.length : 10)

  const upcoming = rows
    .filter(r => !r.m.result_confirmed)
    .sort((a, b) => a.m.kickoff_at.localeCompare(b.m.kickoff_at))
    .slice(0, meIsAdmin ? rows.length : 5)

  // Admin-only: gruppera alla tips per stage för komplett vy
  const allTipsByStage = meIsAdmin
    ? rows.reduce((acc, r) => {
        const stage = r.m.stage as Stage
        if (!acc[stage]) acc[stage] = []
        acc[stage].push(r)
        return acc
      }, {} as Record<Stage, Row[]>)
    : null
  if (allTipsByStage) {
    for (const s of Object.keys(allTipsByStage) as Stage[]) {
      allTipsByStage[s].sort((a, b) => a.m.match_number - b.m.match_number)
    }
  }

  const bonus = bonusRaw as BonusPrediction | null
  const bonusResults = bonusResultsRaw as BonusResults | null
  const teams = teamsEarly
  const teamById = new Map(teams.map(t => [t.id, t]))

  // Spelarens eget slutspelsträd (från deras tips) + slutspelspoäng
  const ownBracket = ownBracketEarly
  const tippedByMatch = new Map<number, [Team | null, Team | null]>()
  ownBracket.r32Matches.forEach((m, i) => tippedByMatch.set(m.id, ownBracket.r32Teams[i]))
  ownBracket.r16Matches.forEach((m, i) => tippedByMatch.set(m.id, ownBracket.r16Teams[i]))
  ownBracket.qfMatches.forEach((m, i) => tippedByMatch.set(m.id, ownBracket.qfTeams[i]))
  ownBracket.sfMatches.forEach((m, i) => tippedByMatch.set(m.id, ownBracket.sfTeams[i]))
  if (ownBracket.finalMatch) tippedByMatch.set(ownBracket.finalMatch.id, ownBracket.finalTeams)
  if (ownBracket.thirdMatch) tippedByMatch.set(ownBracket.thirdMatch.id, ownBracket.thirdTeams)

  const knockout = calcKnockoutPoints(matches, teams, predictions)
  const predictedChampion = knockout.breakdown.predictedChampionId != null
    ? teamById.get(knockout.breakdown.predictedChampionId) ?? null
    : null

  // Gruppspelspoäng räknas direkt från de rättade gruppmatcherna på
  // sidan (samma pts som visas per rad) – inte härlett ur totalen,
  // som kan släpa efter tills vyn/omräkningen uppdaterats.
  const groupPoints = rows
    .filter(r => r.m.stage === 'group')
    .reduce((sum, r) => sum + r.pts, 0)

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
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
        <Stat icon={<Trophy size={18} />} label="Poäng totalt" value={myEntry?.total_points ?? 0} color="gold" />
        <Stat icon={<Target size={18} />} label="Gruppspel" value={groupPoints} color="green" />
        <Stat icon={<Award size={18} />} label="Slutspel" value={knockout.points} color="purple" />
        <Stat icon={<Target size={18} />} label="Exakta" value={myEntry?.exact_scores ?? 0} color="green" />
        <Stat icon={<CheckCircle size={18} />} label="Rätt tecken" value={myEntry?.correct_results ?? 0} color="blue" />
        <Stat icon={<Star size={18} />} label="Bonuspoäng" value={myEntry?.bonus_points ?? 0} color="purple" />
      </div>

      {/* Slutspelspoäng: 3p per rätt lag per omgång + 5p för mästaren */}
      <section className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Slutspelspoäng
          </h2>
          <span className="text-lg font-bold text-amber-400 tabular-nums">
            {knockout.points} p
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
          {KNOCKOUT_ROUNDS.map(r => (
            <div key={r} className="rounded-lg px-2 py-1.5"
              style={{ background: '#0b1120', border: '1px solid #1f2937' }}>
              <div className="text-base font-bold text-emerald-400 tabular-nums">
                {knockout.breakdown.rounds[r]}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                {STAGE_LABELS[r]}
              </div>
            </div>
          ))}
          <div className="rounded-lg px-2 py-1.5"
            style={{ background: '#0b1120', border: `1px solid ${knockout.breakdown.champion ? 'rgba(245,158,11,0.4)' : '#1f2937'}` }}>
            <div className={`text-base font-bold tabular-nums ${knockout.breakdown.champion ? 'text-amber-400' : 'text-gray-600'}`}>
              {knockout.breakdown.champion ? `+${CHAMPION_POINTS}` : '–'}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Mästare</div>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Rätt lag per omgång × {TEAM_POINTS_PER_ROUND}p
          {predictedChampion ? ` · Tippad mästare: ${predictedChampion.flag} ${predictedChampion.name}` : ''}
          {' '}· Se <Link href="/regler" className="underline hover:text-emerald-400">reglerna</Link>
        </p>
      </section>

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
              <PredictionRow key={r.p.id} row={r} isLast={i === recentResults.length - 1}
                tippedHome={r.m.stage !== 'group' ? tippedByMatch.get(r.m.id)?.[0] : undefined}
                tippedAway={r.m.stage !== 'group' ? tippedByMatch.get(r.m.id)?.[1] : undefined} />
            ))}
          </div>
        )}
      </section>

      {/* Kommande tipps */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Kommande tips
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
            {upcoming.map((r, i) => (
              <PredictionRow key={r.p.id} row={r} isLast={i === upcoming.length - 1} hideOutcome={r.m.stage === 'group'}
                tippedHome={r.m.stage !== 'group' ? tippedByMatch.get(r.m.id)?.[0] : undefined}
                tippedAway={r.m.stage !== 'group' ? tippedByMatch.get(r.m.id)?.[1] : undefined} />
            ))}
          </div>
        </section>
      )}

      {/* Admin-only: alla tips grupperade per stage + bonustips */}
      {meIsAdmin && allTipsByStage && (
        <>
          <section className="rounded-xl p-4"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-indigo-300 uppercase tracking-wider mb-1">
              <ShieldCheck size={14} />
              Admin-vy: alla tips ({rows.length} st)
            </h2>
            <p className="text-xs text-indigo-200/70">
              Detta visas bara för master admin. Vanliga spelare ser bara senaste 10 + kommande 5.
            </p>
          </section>

          {(['group','r32','r16','qf','sf','3rd','final'] as Stage[]).map(stage => {
            const stageRows = allTipsByStage[stage]
            if (!stageRows || stageRows.length === 0) return null
            return (
              <section key={stage}>
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                  {STAGE_LABELS[stage]} ({stageRows.length})
                </h2>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
                  {stageRows.map((r, i) => (
                    <PredictionRow
                      key={r.p.id}
                      row={r}
                      isLast={i === stageRows.length - 1}
                      hideOutcome={r.m.stage === 'group' && !r.m.result_confirmed}
                      tippedHome={r.m.stage !== 'group' ? tippedByMatch.get(r.m.id)?.[0] : undefined}
                      tippedAway={r.m.stage !== 'group' ? tippedByMatch.get(r.m.id)?.[1] : undefined}
                    />
                  ))}
                </div>
              </section>
            )
          })}

          {/* Bonustips */}
          {bonus && (
            <section>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Bonustips
              </h2>
              <div className="rounded-xl p-4 space-y-2 text-sm"
                style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <BonusLine
                  label="Skytteligavinnare"
                  pick={bonus.top_scorer}
                  facit={bonusResults?.top_scorer ?? null}
                />
                <BonusLine
                  label="Flest gula kort (lag)"
                  pick={
                    bonus.most_yellow_team_id != null
                      ? teamById.get(bonus.most_yellow_team_id)?.name ?? `Team #${bonus.most_yellow_team_id}`
                      : null
                  }
                  facit={
                    bonusResults?.most_yellow_team_id != null
                      ? teamById.get(bonusResults.most_yellow_team_id)?.name ?? null
                      : null
                  }
                />
                <BonusLine
                  label="Totalt antal mål"
                  pick={bonus.total_goals != null ? String(bonus.total_goals) : null}
                  facit={bonusResults?.total_goals != null ? String(bonusResults.total_goals) : null}
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function BonusLine({ label, pick, facit }: { label: string; pick: string | null; facit: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-white font-medium">{pick ?? <span className="text-gray-600 italic">– inte tippat –</span>}</span>
        {facit && (
          <span className="text-[11px] text-gray-500">
            facit: <span className="text-amber-400">{facit}</span>
          </span>
        )}
      </div>
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
  row, isLast, hideOutcome, tippedHome, tippedAway,
}: {
  row: {
    p: import('@/lib/types').Prediction
    m: import('@/lib/types').Match
    pts: number
    isExact: boolean
    isCorrect: boolean
    knockoutPts?: number | null
  }
  isLast: boolean
  hideOutcome?: boolean
  /** Slutspel: laget spelaren själv tippade fram till den här matchen */
  tippedHome?: import('@/lib/types').Team | null
  tippedAway?: import('@/lib/types').Team | null
}) {
  const m = row.m
  // Slutspelsrader visar spelarens TIPPADE lag (deras eget träd), inte de
  // verkliga – poängen räknas per rätt lag per omgång, se /regler.
  const home = tippedHome?.name ?? m.home_team?.name ?? m.home_placeholder ?? '?'
  const away = tippedAway?.name ?? m.away_team?.name ?? m.away_placeholder ?? '?'
  const homeFlag = tippedHome?.flag ?? m.home_team?.flag ?? ''
  const awayFlag = tippedAway?.flag ?? m.away_team?.flag ?? ''
  const date = stockholmDateTime(m.kickoff_at)

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
            tips: <span className="text-emerald-400 font-medium">{row.p.pred_home}–{row.p.pred_away}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {awayFlag && <Flag emoji={awayFlag} name={away} width={20} height={14} className="shrink-0" />}
          <span className="text-sm text-white truncate">{away}</span>
        </div>
        {!hideOutcome && (
          <div className="shrink-0 w-12 text-right">
            {/* Grupp: poäng när matchen är rättad. Slutspel: lagpoäng så
                fort de verkliga lagen i matchen är kända (0/+3/+6). */}
            {(m.stage === 'group' ? m.result_confirmed : row.knockoutPts != null) ? (
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
