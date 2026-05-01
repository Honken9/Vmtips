import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TrophyLogo } from '@/components/TrophyLogo'
import { LeaderboardEntry, Match, Prediction, Settings, Profile } from '@/lib/types'
import { stockholmToday, isMatchOnStockholmDate } from '@/lib/stats'
import { fetchNews } from '@/lib/rss'
import { format, formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  Calendar, Trophy, Target, CheckCircle, Newspaper, ExternalLink,
  Crown, Medal, Award, MapPin, Clock,
} from 'lucide-react'

export const revalidate = 30

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Hämta allt parallellt
  const [
    { data: settings },
    { data: matchesRaw },
    { data: leaderboard },
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

  const s: Settings = settings ?? {
    id: 1, tournament_mode: 'B', mode_a_global_lock: false,
    points_correct_result: 3, points_exact_score: 5,
    points_winner: 10, points_finalist: 5,
    updated_at: new Date().toISOString(),
  }
  const matches = (matchesRaw ?? []) as Match[]
  const entries = (leaderboard ?? []) as LeaderboardEntry[]
  const myPreds = (myPredsRaw ?? []) as Prediction[]
  const profile = profileRaw as Profile | null

  const ymd = stockholmToday()
  const todaysMatches = matches.filter(m => isMatchOnStockholmDate(m.kickoff_at, ymd))
  const myPredByMatch = new Map(myPreds.map(p => [p.match_id, p]))
  const myEntry = user ? entries.find(e => e.user_id === user.id) ?? null : null
  const myRank = myEntry ? entries.findIndex(e => e.user_id === user!.id) + 1 : null
  const top3 = entries.slice(0, 3)

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
            {profile
              ? `Välkommen tillbaka, ${profile.display_name}.`
              : 'Välkommen till VM-tipset! Tippa alla matcher och följ din placering live.'}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
            {s.tournament_mode === 'A'
              ? '📋 Läge A – Tips lämnas in innan turneringen'
              : '⚡ Läge B – Tips per match, låses vid avspark'}
          </div>
        </div>
        <div
          className="absolute right-0 top-0 w-64 h-64 opacity-5"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Vänster kolumn: Dagens matcher + nyheter */}
        <div className="lg:col-span-2 space-y-8">
          {/* Dagens matcher */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar size={20} className="text-amber-400" />
                Dagens matcher
              </h2>
              <Link href="/matches" className="text-xs text-gray-400 hover:text-amber-400 transition-colors">
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
              <Newspaper size={20} className="text-amber-400" />
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
                    className="block rounded-xl p-4 hover:border-amber-400/40 transition-colors group"
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
                          <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors line-clamp-2">
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

        {/* Höger kolumn: Min stats + topp 3 */}
        <div className="space-y-8">
          {/* Min statistik */}
          <section>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Target size={18} className="text-amber-400" />
              Din statistik
            </h2>
            {!user ? (
              <div className="rounded-xl p-6 text-center"
                style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <p className="text-sm text-gray-400 mb-3">
                  Logga in för att se dina poäng och placering.
                </p>
                <Link href="/auth/login"
                  className="inline-block text-sm font-medium px-4 py-2 rounded-lg gold-gradient text-black">
                  Logga in
                </Link>
              </div>
            ) : (
              <div className="rounded-xl p-5 space-y-4"
                style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div>
                  <div className="text-xs text-gray-500">Placering</div>
                  <div className="text-3xl font-bold text-amber-400">
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
            )}
          </section>

          {/* Topp 3 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy size={18} className="text-amber-400" />
                Topp 3
              </h2>
              <Link href="/tabell" className="text-xs text-gray-400 hover:text-amber-400 transition-colors">
                Hela tabellen →
              </Link>
            </div>
            {top3.length === 0 ? (
              <div className="rounded-xl p-6 text-center text-sm text-gray-500"
                style={{ background: '#111827', border: '1px solid #1f2937' }}>
                Inga deltagare ännu
              </div>
            ) : (
              <div className="space-y-2">
                {top3.map((entry, i) => (
                  <Top3Row key={entry.user_id} entry={entry} rank={i} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className={`text-xl font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function Top3Row({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const icons = [
    <Crown key="1" size={20} className="text-amber-400" />,
    <Medal key="2" size={20} className="text-gray-300" />,
    <Award key="3" size={20} className="text-orange-400" />,
  ]
  const bg = rank === 0
    ? 'rgba(245,158,11,0.08)'
    : rank === 1
      ? 'rgba(156,163,175,0.06)'
      : 'rgba(251,146,60,0.05)'
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: bg, border: '1px solid #1f2937' }}
    >
      <div className="shrink-0">{icons[rank]}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{entry.display_name}</div>
        <div className="text-xs text-gray-500">
          {entry.exact_scores} exakta · {entry.correct_results} rätt
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-bold text-amber-400">{entry.total_points}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">poäng</div>
      </div>
    </div>
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
      Nästa match: {format(new Date(next.kickoff_at), 'EEE d MMM HH:mm', { locale: sv })}
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
  const time = format(new Date(match.kickoff_at), 'HH:mm', { locale: sv })
  const kickoffDate = new Date(match.kickoff_at)
  const isLive = !match.result_confirmed && kickoffDate.getTime() <= Date.now()

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${!isLast ? 'border-b' : ''}`}
      style={{ borderColor: '#1f2937', background: '#111827' }}
    >
      <div className="text-xs text-gray-500 shrink-0 w-12 text-center">
        <div className="text-amber-400 font-medium">{time}</div>
        {isLive && (
          <div className="text-[10px] text-red-400 font-bold mt-0.5 animate-pulse">LIVE</div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
        <span className="text-sm text-white truncate">{homeName}</span>
        {homeFlag && <span className="text-base">{homeFlag}</span>}
      </div>
      <div className="shrink-0 w-16 text-center">
        {match.result_confirmed ? (
          <span className="text-white font-bold text-sm">
            {match.home_score} – {match.away_score}
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
        {awayFlag && <span className="text-base">{awayFlag}</span>}
        <span className="text-sm text-white truncate">{awayName}</span>
      </div>
      {/* Mitt tips + arena */}
      <div className="hidden md:flex flex-col items-end shrink-0 w-32 text-xs">
        {myPred ? (
          <div className="flex items-center gap-1 text-gray-400">
            <span>Tips:</span>
            <span className="text-amber-400 font-bold">
              {myPred.pred_home}–{myPred.pred_away}
            </span>
            {myPred.locked && <CheckCircle size={10} className="text-green-500" />}
          </div>
        ) : (
          <Link href="/tips" className="text-gray-500 hover:text-amber-400 transition-colors">
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
  )
}
