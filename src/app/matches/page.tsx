import { createClient } from '@/lib/supabase/server'
import { Match, Team, Stage, STAGE_LABELS } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CheckCircle, Clock, MapPin, Calendar } from 'lucide-react'

export const revalidate = 60

const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final']
const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

export default async function MatchesPage() {
  const supabase = await createClient()

  const [{ data: matchesData }, { data: teamsData }] = await Promise.all([
    supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('kickoff_at'),
    supabase.from('teams').select('*').order('group_name').order('name'),
  ])

  const matches = (matchesData ?? []) as Match[]
  const teams = (teamsData ?? []) as Team[]
  const groupMatches = matches.filter(m => m.stage === 'group')
  const knockoutMatches = matches.filter(m => m.stage !== 'group')

  const completedMatches = matches.filter(m => m.result_confirmed).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Matcher & Grupper</h1>
          <p className="text-gray-400 text-sm mt-1">
            {matches.length} matcher totalt · {completedMatches} avklarade
          </p>
        </div>
      </div>

      {/* Grupper */}
      {groupMatches.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-4">Gruppspel</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {GROUPS.map(group => {
              const groupTeams = teams.filter(t => t.group_name === group)
              const gMatches = groupMatches.filter(m => m.group_name === group)
              if (groupTeams.length === 0 && gMatches.length === 0) return null

              return (
                <div key={group} className="rounded-xl overflow-hidden"
                  style={{ background: '#111827', border: '1px solid #1f2937' }}>
                  {/* Grupprubrik */}
                  <div className="px-4 py-3 flex items-center justify-between"
                    style={{ background: 'linear-gradient(135deg, #1f2937, #1a1a2e)' }}>
                    <span className="font-bold text-emerald-400 text-lg">Grupp {group}</span>
                    <span className="text-xs text-gray-500">
                      {gMatches.filter(m => m.result_confirmed).length}/{gMatches.length} klara
                    </span>
                  </div>

                  {/* Laglistning */}
                  {groupTeams.length > 0 && (
                    <div className="px-4 py-2 border-b" style={{ borderColor: '#1f2937' }}>
                      <div className="grid grid-cols-2 gap-1">
                        {groupTeams.map(team => (
                          <div key={team.id} className="flex items-center gap-2 py-1">
                            <Flag emoji={team.flag} name={team.name} width={20} height={14} />
                            <span className="text-sm text-gray-300 truncate">{team.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matcher */}
                  <div className="divide-y" style={{ borderColor: '#1f2937' }}>
                    {gMatches.map(match => (
                      <GroupMatchRow key={match.id} match={match} />
                    ))}
                    {gMatches.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-600 italic">Inga matcher inlagda</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Slutspel */}
      {STAGE_ORDER.filter(s => s !== 'group').map(stage => {
        const stageMatches = knockoutMatches.filter(m => m.stage === stage)
        if (stageMatches.length === 0) return null

        return (
          <section key={stage}>
            <h2 className="text-lg font-bold text-white mb-3">{STAGE_LABELS[stage]}</h2>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
              {stageMatches.map((m, i) => (
                <KnockoutMatchRow key={m.id} match={m} isLast={i === stageMatches.length - 1} />
              ))}
            </div>
          </section>
        )
      })}

      {matches.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-5xl mb-3">⚽</div>
          <div className="text-white font-medium mb-1">Inga matcher inlagda ännu</div>
          <div className="text-gray-500 text-sm">Kör seed_complete.sql i Supabase för att fylla på med alla matcher</div>
        </div>
      )}
    </div>
  )
}

function GroupMatchRow({ match }: { match: Match }) {
  const homeName = match.home_team?.name ?? '?'
  const awayName = match.away_team?.name ?? '?'
  const homeFlag = match.home_team?.flag ?? '🏴'
  const awayFlag = match.away_team?.flag ?? '🏴'
  const date = format(new Date(match.kickoff_at), 'EEE d MMM', { locale: sv })
  const time = format(new Date(match.kickoff_at), 'HH:mm', { locale: sv })

  return (
    <div className="px-4 py-2.5">
      {/* Datum + plats */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs text-gray-600 flex items-center gap-1">
          <Calendar size={10} />
          {date} {time}
        </span>
        {match.venue && (
          <span className="text-xs text-gray-600 flex items-center gap-1 truncate">
            <MapPin size={10} />
            {match.venue}
          </span>
        )}
      </div>
      {/* Match */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
          <span className="text-sm font-medium text-white truncate">{homeName}</span>
          <Flag emoji={homeFlag} name={homeName} width={20} height={14} className="shrink-0" />
        </div>
        <div className="shrink-0 w-16 text-center">
          {match.result_confirmed ? (
            <span className="text-white font-bold text-sm">
              {match.home_score} – {match.away_score}
            </span>
          ) : (
            <span className="text-gray-600 text-xs font-medium px-2 py-0.5 rounded"
              style={{ background: '#1f2937' }}>
              vs
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Flag emoji={awayFlag} name={awayName} width={20} height={14} className="shrink-0" />
          <span className="text-sm font-medium text-white truncate">{awayName}</span>
        </div>
      </div>
    </div>
  )
}

function KnockoutMatchRow({ match, isLast }: { match: Match; isLast: boolean }) {
  const homeName = match.home_team?.name ?? match.home_placeholder ?? '?'
  const awayName = match.away_team?.name ?? match.away_placeholder ?? '?'
  const homeFlag = match.home_team?.flag ?? ''
  const awayFlag = match.away_team?.flag ?? ''
  const date = format(new Date(match.kickoff_at), 'EEE d MMM', { locale: sv })
  const time = format(new Date(match.kickoff_at), 'HH:mm', { locale: sv })

  return (
    <div className={`flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 ${!isLast ? 'border-b' : ''}`}
      style={{ borderColor: '#1f2937', background: '#111827' }}>
      <div className="text-[11px] sm:text-xs text-gray-500 shrink-0 w-16 sm:w-24 leading-tight">
        <div className="truncate">{date}</div>
        <div className="text-emerald-400 font-medium">{time}</div>
      </div>
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
        <span className="text-sm font-medium text-white truncate">{homeName}</span>
        {homeFlag && <Flag emoji={homeFlag} name={homeName} width={22} height={16} className="shrink-0" />}
      </div>
      <div className="shrink-0 w-14 sm:w-20 text-center">
        {match.result_confirmed ? (
          <div className="flex items-center justify-center gap-1">
            <span className="text-white font-bold">{match.home_score}</span>
            <span className="text-gray-500">–</span>
            <span className="text-white font-bold">{match.away_score}</span>
            <CheckCircle size={12} className="text-green-500 ml-1 hidden sm:inline" />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1 text-gray-500">
            <Clock size={12} />
            <span className="text-xs">vs</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {awayFlag && <Flag emoji={awayFlag} name={awayName} width={22} height={16} className="shrink-0" />}
        <span className="text-sm font-medium text-white truncate">{awayName}</span>
      </div>
      {/* Plats */}
      {match.venue && match.venue !== 'TBD' && (
        <div className="text-xs text-gray-500 shrink-0 hidden lg:flex items-center gap-1">
          <MapPin size={10} />
          {match.venue}
        </div>
      )}
    </div>
  )
}
