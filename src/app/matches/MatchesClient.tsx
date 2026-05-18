'use client'

import { useMemo, useState } from 'react'
import { Match, Team, STAGE_LABELS } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CheckCircle, Clock, MapPin, Filter, X } from 'lucide-react'

interface Props {
  matches: Match[]
  teams: Team[]
  initialDay?: string
}

function ymd(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

function dayLabel(iso: string): string {
  return format(new Date(iso), 'EEEE d MMMM', { locale: sv })
}

export function MatchesClient({ matches, teams, initialDay = '' }: Props) {
  const [day, setDay] = useState<string>(initialDay)
  const [teamId, setTeamId] = useState<string>('')
  const [group, setGroup] = useState<string>('')

  // Unika dagar i kronologisk ordning
  const days = useMemo(() => {
    const seen = new Map<string, string>() // ymd -> label
    for (const m of matches) {
      const key = ymd(m.kickoff_at)
      if (!seen.has(key)) seen.set(key, dayLabel(m.kickoff_at))
    }
    return Array.from(seen.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [matches])

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name, 'sv')),
    [teams]
  )

  const groups = useMemo(() => {
    const set = new Set<string>()
    for (const t of teams) if (t.group_name) set.add(t.group_name)
    return Array.from(set).sort()
  }, [teams])

  const filtered = useMemo(() => {
    return matches.filter(m => {
      if (day && ymd(m.kickoff_at) !== day) return false
      if (group && m.group_name !== group) return false
      if (teamId) {
        const tid = Number(teamId)
        if (m.home_team_id !== tid && m.away_team_id !== tid) return false
      }
      return true
    })
  }, [matches, day, group, teamId])

  // Gruppera filtrerade matcher per dag
  const byDay = useMemo(() => {
    const map = new Map<string, { label: string; matches: Match[] }>()
    for (const m of filtered) {
      const key = ymd(m.kickoff_at)
      if (!map.has(key)) map.set(key, { label: dayLabel(m.kickoff_at), matches: [] })
      map.get(key)!.matches.push(m)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({
        key,
        label: v.label,
        matches: v.matches.sort((x, y) => x.kickoff_at.localeCompare(y.kickoff_at)),
      }))
  }, [filtered])

  const hasFilter = day || teamId || group
  const completed = filtered.filter(m => m.result_confirmed).length

  function clearAll() {
    setDay('')
    setTeamId('')
    setGroup('')
  }

  const selectStyle = {
    background: '#1f2937',
    border: '1px solid #374151',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Matcher</h1>
          <p className="text-gray-400 text-sm mt-1">
            {filtered.length} matcher{hasFilter ? ' (filtrerat)' : ''} · {completed} avklarade
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="rounded-xl p-4 flex flex-wrap items-center gap-3"
        style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <Filter size={16} className="text-gray-500 shrink-0" />

        <select
          value={day}
          onChange={e => setDay(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          style={selectStyle}
        >
          <option value="">Alla dagar</option>
          {days.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          value={teamId}
          onChange={e => setTeamId(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          style={selectStyle}
        >
          <option value="">Alla landslag</option>
          {sortedTeams.map(t => (
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          ))}
        </select>

        <select
          value={group}
          onChange={e => setGroup(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          style={selectStyle}
        >
          <option value="">Alla grupper</option>
          {groups.map(g => (
            <option key={g} value={g}>Grupp {g}</option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
          >
            <X size={14} />
            Rensa
          </button>
        )}
      </div>

      {/* Dag-grupperad lista */}
      {byDay.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-5xl mb-3">⚽</div>
          <div className="text-white font-medium mb-1">Inga matcher matchar filtret</div>
          <div className="text-gray-500 text-sm">Prova att rensa filtren.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {byDay.map(d => (
            <section key={d.key}>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                  {d.label}
                </h2>
                <span className="text-xs text-gray-600">{d.matches.length} matcher</span>
                <div className="flex-1 h-px" style={{ background: '#1f2937' }} />
              </div>
              <div className="rounded-xl overflow-hidden divide-y"
                style={{ background: '#111827', border: '1px solid #1f2937', borderColor: '#1f2937' }}>
                {d.matches.map(m => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchRow({ match }: { match: Match }) {
  const homeName = match.home_team?.name ?? match.home_placeholder ?? '?'
  const awayName = match.away_team?.name ?? match.away_placeholder ?? '?'
  const homeFlag = match.home_team?.flag ?? ''
  const awayFlag = match.away_team?.flag ?? ''
  const time = format(new Date(match.kickoff_at), 'HH:mm', { locale: sv })
  const stageLabel = match.stage === 'group'
    ? (match.group_name ? `Grupp ${match.group_name}` : 'Gruppspel')
    : STAGE_LABELS[match.stage]

  return (
    <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3">
      <div className="text-xs shrink-0 w-12 sm:w-16 leading-tight">
        <div className="text-emerald-400 font-bold">{time}</div>
        <div className="text-gray-600 text-[10px] truncate">{stageLabel}</div>
      </div>
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
        <span className="text-sm font-medium text-white truncate text-right">{homeName}</span>
        {homeFlag && <Flag emoji={homeFlag} name={homeName} width={22} height={16} className="shrink-0" />}
      </div>
      <div className="shrink-0 w-14 sm:w-20 text-center">
        {match.result_confirmed ? (
          <div className="flex items-center justify-center gap-1">
            <span className="text-white font-bold">{match.home_score}</span>
            <span className="text-gray-500">–</span>
            <span className="text-white font-bold">{match.away_score}</span>
            <CheckCircle size={12} className="text-green-500 ml-0.5 hidden sm:inline" />
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
      {match.venue && match.venue !== 'TBD' && (
        <div className="text-xs text-gray-500 shrink-0 hidden lg:flex items-center gap-1 w-32 truncate">
          <MapPin size={10} className="shrink-0" />
          <span className="truncate">{match.venue}</span>
        </div>
      )}
    </div>
  )
}
