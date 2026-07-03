import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TrophyLogo } from '@/components/TrophyLogo'
import { MatchCountdown } from '@/components/MatchCountdown'
import { Flag } from '@/components/Flag'
import { UserAvatar } from '@/components/UserAvatar'
import { HeroAvatar } from '@/components/HeroAvatar'
import { LeaderboardEntry, Match, Prediction, Settings, Profile, Pool, sortLeaderboard } from '@/lib/types'
import { stockholmToday, isMatchOnStockholmDate } from '@/lib/stats'
import { stockholmTime, stockholmWeekdayDateTime } from '@/lib/dates'
import { fetchNews } from '@/lib/rss'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  Calendar, Trophy, Target, CheckCircle, Newspaper, ExternalLink,
  Crown, Medal, Award, MapPin, Clock,
} from 'lucide-react'

export const revalidate = 30

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Om inloggad men saknar pool → tvinga val
  if (user) {
    const { data: meProfile } = await supabase
      .from('profiles')
      .select('pool_id')
      .eq('id', user.id)
      .single()
    if (!meProfile?.pool_id) redirect('/select-pool')
  }

  // Hämta allt parallellt
  const [
    { data: settings },
    { data: matchesRaw },
    { data: leaderboardRaw },
    { data: myPredsRaw },
    { data: profileRaw },
    news,
  ] = await Promise.all([
    supabase.from('settings').select('*').single(),
    supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('kickoff_at'),
    supabase.from('leaderboard').select('*'),
    user
      ? supabase.from('predictions').select('*').eq('user_id', user.id)
      : Promise.resolve({ data: [] as Prediction[] }),
    user
      ? supabase.from('profiles').select('*').eq('id', user.id).single()
      : Promise.resolve({ data: null as Profile | null }),
    fetchNews(5),
  ])

  const profile = profileRaw as Profile | null
  const poolId = profile?.pool_id ?? null

  // Hämta liganamn (om användaren har en pool)
  const { data: pool } = poolId
    ? await supabase.from('pools').select('*').eq('id', poolId).single()
    : { data: null }
  const currentPool = pool as Pool | null

  // Filtrera leaderboard till medlemmar i samma pool (eller all data om utloggad)
  const allEntries = (leaderboardRaw ?? []) as LeaderboardEntry[]
  const entries = sortLeaderboard(poolId ? allEntries.filter(e => e.pool_id === poolId) : allEntries)

  const s: Settings = settings ?? {
    id: 1, tournament_mode: 'B', mode_a_global_lock: false,
    points_correct_result: 3, points_exact_score: 5,
    points_winner: 10, points_finalist: 5,
    updated_at: new Date().toISOString(),
  }
  const matches = (matchesRaw ?? []) as Match[]
  const myPreds = (myPredsRaw ?? []) as Prediction[]

  const ymd = stockholmToday()
  const todaysMatches = matches.filter(m => isMatchOnStockholmDate(m.kickoff_at, ymd))

  // Nästa kommande match (inte avgjord, kickoff i framtiden)
  const nowMs = Date.now()
  const upcomingMatch = matches
    .filter(m => !m.result_confirmed && new Date(m.kickoff_at).getTime() > nowMs)
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))[0]
  const myPredByMatch = new Map(myPreds.map(p => [p.match_id, p]))
  const myEntry = user ? entries.find(e => e.user_id === user.id) ?? null : null
  const myRank = myEntry ? entries.findIndex(e => e.user_id === user!.id) + 1 : null
  const top5 = entries.slice(0, 5)

  // Hämta avatarer för topp 3 (separat query för att slippa joinen på leaderboard-vyn)
  const top5UserIds = top5.map(e => e.user_id)
  const { data: top5ProfilesRaw } =
    top5UserIds.length > 0
      ? await supabase.from('profiles').select('id, avatar_url').in('id', top5UserIds)
      : { data: [] as { id: string; avatar_url: string | null }[] }
  const top5Avatars: Record<string, string | null> = {}
  for (const p of (top5ProfilesRaw ?? []) as { id: string; avatar_url: string | null }[]) {
    top5Avatars[p.id] = p.avatar_url
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div
        className="rounded-2xl p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0c2823 0%, #14202e 50%, #0a3d2a 100%)',
          border: '1px solid #1f2937',
        }}
      >
        <div className="relative z-10 flex items-start gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <TrophyLogo size="lg" />
            <p className="mt-3 text-gray-400 max-w-lg">
              {profile
                ? `Välkommen tillbaka, ${profile.display_name}.`
                : 'Välkommen till VM-tipset! Tippa alla matcher och följ din placering live.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                {(() => {
                  const m = currentPool?.tournament_mode ?? s.tournament_mode
                  if (m === 'A') return '📋 Läge A – Tips lämnas in innan turneringen'
                  if (m === 'C') return '🎯 Läge C – Gruppspel som A, slutspel som B'
                  return '⚡ Läge B – Tips per match, låses vid avspark'
                })()}
              </div>
              {currentPool && (
                <Link
                  href="/profil"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-white/10 transition-colors"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
                >
                  Liga: <span className="text-white">{currentPool.name}</span>
                </Link>
              )}
            </div>
          </div>
          {profile?.avatar_url && (
            <HeroAvatar src={profile.avatar_url} alt={profile.display_name} />
          )}
        </div>
        <div
          className="absolute right-0 top-0 w-64 h-64 opacity-5"
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }}
        />
      </div>

      {/* Nedräkning till nästa match – klickbar → matchsidan filtrerad på dagen */}
      {upcomingMatch && (
        <Link
          href="/matches"
          className="block transition-transform hover:scale-[1.01]"
          title="Visa alla matcher"
        >
          <MatchCountdown
            targetIso={upcomingMatch.kickoff_at}
            homeName={upcomingMatch.home_team?.name ?? upcomingMatch.home_placeholder ?? '?'}
            awayName={upcomingMatch.away_team?.name ?? upcomingMatch.away_placeholder ?? '?'}
            homeFlag={upcomingMatch.home_team?.flag}
            awayFlag={upcomingMatch.away_team?.flag}
            venue={upcomingMatch.venue}
          />
        </Link>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Vänster kolumn: Dagens matcher + nyheter */}
        <div className="lg:col-span-2 space-y-8">
          {/* Dagens matcher */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar size={20} className="text-emerald-400" />
                Dagens matcher
              </h2>
              <Link href="/matches" className="text-xs text-gray-400 hover:text-emerald-400 transition-colors">
                Alla matcher →
              </Link>
            </div>

            {todaysMatches.length === 0 ? (
              <div className="rounded-xl p-8 text-center"
                style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="text-3xl mb-2">📅</div>
                <div className="text-gray-400 text-sm">Inga matcher idag</div>
                <NextMatchHint matches={matches} />
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
                {todaysMatches.map((m, i) => (
                  <TodaysMatchRow
                    key={m.id}
                    match={m}
                    isLast={i === todaysMatches.length - 1}
                    myPred={myPredByMatch.get(m.id) ?? null}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Nyhetsfeed */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Newspaper size={20} className="text-emerald-400" />
              Nyheter
            </h2>
            {news.length === 0 ? (
              <div className="rounded-xl p-6 text-center text-sm text-gray-500"
                style={{ background: '#111827', border: '1px solid #1f2937' }}>
                Inga nyheter just nu (RSS-feeden kunde inte läsas).
              </div>
            ) : (
              <div className="space-y-3">
                {news.map((n, i) => (
                  <a
                    key={i}
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl p-4 hover:border-emerald-400/40 transition-colors group"
                    style={{ background: '#111827', border: '1px solid #1f2937' }}
                  >
                    <div className="flex gap-4">
                      {n.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={n.imageUrl}
                          alt=""
                          className="w-24 h-24 rounded-lg object-cover shrink-0 hidden sm:block"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors line-clamp-2">
                            {n.title}
                          </h3>
                          <ExternalLink size={14} className="text-gray-600 shrink-0 mt-1" />
                        </div>
                        {n.description && (
                          <p className="text-xs text-gray-400 mt-2 line-clamp-2">{n.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>{n.source}</span>
                          {n.pubDate && (
                            <>
                              <span>·</span>
                              <span>
                                {formatDistanceToNow(new Date(n.pubDate), { addSuffix: true, locale: sv })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Höger kolumn: Min stats + topp 3 (endast inloggade) */}
        <div className="space-y-8">
          {/* Min statistik – endast för inloggade */}
          {user && (
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Target size={18} className="text-emerald-400" />
                Din statistik
              </h2>
              <div className="rounded-xl p-5 space-y-4"
                style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div>
                  <div className="text-xs text-gray-500">Placering</div>
                  <div className="text-3xl font-bold text-emerald-400">
                    {myRank ? `#${myRank}` : '–'}
                    <span className="text-sm text-gray-500 font-normal"> av {entries.length}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: '#1f2937' }}>
                  <MiniStat label="Poäng" value={myEntry?.total_points ?? 0} highlight />
                  <MiniStat label="Rätt" value={myEntry?.correct_results ?? 0} />
                  <MiniStat label="Exakt" value={myEntry?.exact_scores ?? 0} />
                </div>
                <Link href="/tips"
                  className="block w-full text-center text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  style={{ background: '#1f2937', color: '#f9fafb' }}>
                  Mina tips →
                </Link>
              </div>
            </section>
          )}

          {/* Topp 5 – endast för inloggade */}
          {user && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy size={18} className="text-emerald-400" />
                  Topp 5
                </h2>
                <Link href="/tabell" className="text-xs text-gray-400 hover:text-emerald-400 transition-colors">
                  Hela tabellen →
                </Link>
              </div>
              {top5.length === 0 ? (
                <div className="rounded-xl p-6 text-center text-sm text-gray-500"
                  style={{ background: '#111827', border: '1px solid #1f2937' }}>
                  Inga deltagare ännu
                </div>
              ) : (
                <div className="space-y-2">
                  {top5.map((entry, i) => (
                    <Top3Row key={entry.user_id} entry={entry} rank={i} avatarUrl={top5Avatars[entry.user_id]} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className={`text-xl font-bold ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function Top3Row({ entry, rank, avatarUrl }: { entry: LeaderboardEntry; rank: number; avatarUrl?: string | null }) {
  const icons = [
    <Crown key="1" size={20} className="text-amber-400" />,
    <Medal key="2" size={20} className="text-gray-300" />,
    <Award key="3" size={20} className="text-orange-400" />,
  ]
  const bg = rank === 0
    ? 'rgba(245,158,11,0.08)'
    : rank === 1
      ? 'rgba(156,163,175,0.06)'
      : rank === 2
        ? 'rgba(251,146,60,0.05)'
        : '#111827'
  return (
    <Link
      href={`/spelare/${entry.user_id}`}
      className="flex items-center gap-3 rounded-xl px-4 py-3 hover:brightness-125 transition-all"
      style={{ background: bg, border: '1px solid #1f2937' }}
    >
      <div className="shrink-0 w-5 text-center">
        {icons[rank] ?? <span className="text-sm font-bold text-gray-500">{rank + 1}</span>}
      </div>
      <UserAvatar src={avatarUrl} name={entry.display_name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{entry.display_name}</div>
        <div className="text-xs text-gray-500">
          {entry.exact_scores} exakta · {entry.correct_results} rätt
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-lg font-bold ${rank === 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
          {entry.total_points}
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">poäng</div>
      </div>
    </Link>
  )
}

function NextMatchHint({ matches }: { matches: Match[] }) {
  const now = Date.now()
  const next = matches
    .filter(m => new Date(m.kickoff_at).getTime() > now)
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at))[0]
  if (!next) return null
  return (
    <div className="text-xs text-gray-500 mt-3">
      Nästa match: {stockholmWeekdayDateTime(next.kickoff_at)}
    </div>
  )
}

function TodaysMatchRow({
  match, isLast, myPred,
}: {
  match: Match
  isLast: boolean
  myPred: Prediction | null
}) {
  const home = match.home_team
  const away = match.away_team
  const homeName = home?.name ?? match.home_placeholder ?? '?'
  const awayName = away?.name ?? match.away_placeholder ?? '?'
  const homeFlag = home?.flag ?? ''
  const awayFlag = away?.flag ?? ''
  const time = stockholmTime(match.kickoff_at)
  const kickoffDate = new Date(match.kickoff_at)
  const isLive = !match.result_confirmed && kickoffDate.getTime() <= Date.now()

  return (
    <div
      className={`px-3 sm:px-4 py-3 ${!isLast ? 'border-b' : ''}`}
      style={{ borderColor: '#1f2937', background: '#111827' }}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="text-xs text-gray-500 shrink-0 w-11 sm:w-12 text-center">
          <div className="text-emerald-400 font-medium">{time}</div>
          {isLive && (
            <div className="text-[10px] text-red-400 font-bold mt-0.5 animate-pulse">LIVE</div>
          )}
        </div>
        <Link
          href="/matches"
          className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 group/match"
          title="Visa alla matcher"
        >
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            <span className="text-sm text-white truncate group-hover/match:text-emerald-400 transition-colors">{homeName}</span>
            {homeFlag && <Flag emoji={homeFlag} name={homeName} width={20} height={14} className="shrink-0" />}
          </div>
          <div className="shrink-0 w-14 sm:w-16 text-center">
            {match.result_confirmed ? (
              <span className="text-white font-bold text-sm">
                {match.home_score}–{match.away_score}
              </span>
            ) : (
              <span className="text-gray-600 text-xs font-medium px-2 py-0.5 rounded"
                style={{ background: '#1f2937' }}>
                <Clock size={10} className="inline mr-1" />
                vs
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {awayFlag && <Flag emoji={awayFlag} name={awayName} width={20} height={14} className="shrink-0" />}
            <span className="text-sm text-white truncate group-hover/match:text-emerald-400 transition-colors">{awayName}</span>
          </div>
        </Link>
        <div className="hidden md:flex flex-col items-end shrink-0 w-32 text-xs">
          {myPred ? (
            <div className="flex items-center gap-1 text-gray-400">
              <span>Tips:</span>
              <span className="text-emerald-400 font-bold">
                {myPred.pred_home}–{myPred.pred_away}
              </span>
              {myPred.locked && <CheckCircle size={10} className="text-green-500" />}
            </div>
          ) : (
            <Link href="/tips" className="text-gray-500 hover:text-emerald-400 transition-colors">
              Inget tips än
            </Link>
          )}
          {match.venue && (
            <div className="text-gray-600 flex items-center gap-1 mt-0.5 truncate max-w-full">
              <MapPin size={9} />
              <span className="truncate">{match.venue}</span>
            </div>
          )}
        </div>
      </div>
      {/* Tips/venue – egen rad på mobilen */}
      <div className="md:hidden flex items-center justify-between gap-2 mt-2 pl-13 text-xs">
        {myPred ? (
          <span className="text-gray-400">
            Tips: <span className="text-emerald-400 font-bold">{myPred.pred_home}–{myPred.pred_away}</span>
            {myPred.locked && <CheckCircle size={10} className="text-green-500 inline ml-1" />}
          </span>
        ) : (
          <Link href="/tips" className="text-gray-500 hover:text-emerald-400">
            Inget tips än →
          </Link>
        )}
        {match.venue && (
          <span className="text-gray-600 flex items-center gap-1 truncate min-w-0">
            <MapPin size={9} className="shrink-0" />
            <span className="truncate">{match.venue}</span>
          </span>
        )}
      </div>
    </div>
  )
}
