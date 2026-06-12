'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Match, Team, STAGE_LABELS } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CheckCircle, Clock, MapPin, Filter, X, ChevronLeft, ChevronRight, Calendar, Copy, Check } from 'lucide-react'
import { MatchCommentInline } from '@/components/MatchCommentInline'
import { stockholmTime } from '@/lib/dates'

// Flagga + namn. Klickbar länk till landslagssidan om laget är känt
// (har en team-kod); annars vanlig text (för slutspels-placeholders).
function TeamLabel({
  team, fallbackName, flag, align,
}: {
  team: Team | undefined
  fallbackName: string
  flag: string
  align: 'left' | 'right'
}) {
  const name = team?.name ?? fallbackName
  const inner = (
    <>
      {align === 'right' && (
        <span className="text-sm font-medium truncate text-right group-hover/team:text-emerald-400 transition-colors">
          {name}
        </span>
      )}
      {flag && <Flag emoji={flag} name={name} width={22} height={16} className="shrink-0" />}
      {align === 'left' && (
        <span className="text-sm font-medium truncate group-hover/team:text-emerald-400 transition-colors">
          {name}
        </span>
      )}
    </>
  )

  if (team?.code) {
    return (
      <Link
        href={`/landslag/${team.code}`}
        title={`Visa ${name}`}
        className={`flex items-center gap-1.5 flex-1 min-w-0 group/team text-white ${
          align === 'right' ? 'justify-end' : ''
        }`}
      >
        {inner}
      </Link>
    )
  }
  return (
    <div
      className={`flex items-center gap-1.5 flex-1 min-w-0 text-white ${
        align === 'right' ? 'justify-end' : ''
      }`}
    >
      {inner}
    </div>
  )
}

interface Props {
  matches: Match[]
  teams: Team[]
  initialDay?: string
  meUserId?: string | null
  poolId?: number | null
  canModerate?: boolean
}

function ymd(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

function dayLabel(iso: string): string {
  return format(new Date(iso), 'EEEE d MMMM', { locale: sv })
}

export function MatchesClient({ matches, teams, initialDay = '', meUserId = null, poolId = null, canModerate = false }: Props) {
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

  // Stega dag framåt/bakåt genom listan av speldagar
  const dayKeys = days.map(d => d[0])
  const curDayIdx = day ? dayKeys.indexOf(day) : -1
  const canStepPrev = dayKeys.length > 0 && curDayIdx !== 0
  const canStepNext = dayKeys.length > 0 && curDayIdx !== dayKeys.length - 1
  function stepDay(delta: number) {
    if (dayKeys.length === 0) return
    if (curDayIdx === -1) {
      // "Alla dagar": framåt → första dagen, bakåt → sista
      setDay(delta > 0 ? dayKeys[0] : dayKeys[dayKeys.length - 1])
      return
    }
    const next = curDayIdx + delta
    if (next < 0 || next >= dayKeys.length) return
    setDay(dayKeys[next])
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
        <CalendarSubscribeButton />
      </div>

      {/* Filter */}
      <div className="rounded-xl p-4 flex flex-wrap items-center gap-3"
        style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <Filter size={16} className="text-gray-500 shrink-0" />

        <div className="flex items-stretch gap-1">
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
          <button
            onClick={() => stepDay(-1)}
            disabled={!canStepPrev}
            title="Föregående dag"
            aria-label="Föregående dag"
            className="px-2 rounded-lg text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
            style={selectStyle}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => stepDay(1)}
            disabled={!canStepNext}
            title="Nästa dag"
            aria-label="Nästa dag"
            className="px-2 rounded-lg text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
            style={selectStyle}
          >
            <ChevronRight size={16} />
          </button>
        </div>

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
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-base sm:text-lg font-bold text-white capitalize">
                  {d.label}
                </h2>
                <span className="text-xs font-medium text-emerald-400 px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.12)' }}>
                  {d.matches.length} matcher
                </span>
                <div className="flex-1 h-px" style={{ background: '#1f2937' }} />
              </div>
              <div className="rounded-xl overflow-hidden divide-y"
                style={{ background: '#111827', border: '1px solid #1f2937', borderColor: '#1f2937' }}>
                {d.matches.map(m => (
                  <MatchRow key={m.id} match={m} meUserId={meUserId} poolId={poolId} canModerate={canModerate} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function MatchRow({
  match,
  meUserId,
  poolId,
  canModerate,
}: {
  match: Match
  meUserId: string | null
  poolId: number | null
  canModerate: boolean
}) {
  const homeName = match.home_team?.name ?? match.home_placeholder ?? '?'
  const awayName = match.away_team?.name ?? match.away_placeholder ?? '?'
  const homeFlag = match.home_team?.flag ?? ''
  const awayFlag = match.away_team?.flag ?? ''
  const time = stockholmTime(match.kickoff_at)
  const stageLabel = match.stage === 'group'
    ? (match.group_name ? `Grupp ${match.group_name}` : 'Gruppspel')
    : STAGE_LABELS[match.stage]
  const matchLabel = `${homeName} – ${awayName}`

  return (
    <div className="px-3 sm:px-5 py-3">
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="shrink-0 w-16 sm:w-20 leading-tight">
          <div className="text-emerald-400 font-bold text-base tabular-nums">{time}</div>
          <div className="text-gray-300 text-[11px] font-medium truncate">{stageLabel}</div>
        </div>
        <TeamLabel team={match.home_team} fallbackName={homeName} flag={homeFlag} align="right" />
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
        <TeamLabel team={match.away_team} fallbackName={awayName} flag={awayFlag} align="left" />
        {match.venue && match.venue !== 'TBD' && (
          <div className="text-xs text-gray-500 shrink-0 hidden lg:flex items-center gap-1 w-32 truncate">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{match.venue}</span>
          </div>
        )}
      </div>
      {meUserId && poolId && (
        <div className="mt-2 pl-[5.25rem] sm:pl-24">
          <MatchCommentInline
            matchId={match.id}
            poolId={poolId}
            meUserId={meUserId}
            matchLabel={matchLabel}
            canModerate={canModerate}
          />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Knapp som öppnar en liten popover med webcal://-länk + ladda-ner.
// Apple Calendar / Outlook / Google Kalender klarar webcal:// och
// prenumererar då med automatisk uppdatering (resultat + slutspelslag).
function CalendarSubscribeButton() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Konstruera URL:erna när popovern öppnas (origin finns bara klient-side)
  const httpsUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/calendar/matches.ics`
    : ''
  const webcalUrl = typeof window !== 'undefined'
    ? `webcal://${window.location.host}/api/calendar/matches.ics`
    : ''

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(httpsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-black transition-all"
        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
      >
        <Calendar size={14} />
        Lägg till i kalender
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-30 w-80 rounded-xl p-4 space-y-3 text-sm"
          style={{ background: '#0f172a', border: '1px solid #374151', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
        >
          <div className="font-semibold text-white">Prenumerera på spelschemat</div>
          <p className="text-xs text-gray-400">
            Lägg till alla matcher i din kalender. Uppdateras automatiskt
            med resultat och vilka lag som tar sig till slutspelet.
          </p>

          <a
            href={webcalUrl}
            className="block w-full px-3 py-2 rounded-lg text-center text-xs font-semibold text-black"
            style={{ background: '#10b981' }}
          >
            📱 Öppna i Apple Calendar / iPhone
          </a>

          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">
              Outlook / Google: kopiera länken
            </div>
            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={httpsUrl}
                className="flex-1 min-w-0 px-2 py-1.5 rounded text-xs text-gray-300 font-mono"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
                onFocus={e => e.currentTarget.select()}
              />
              <button
                onClick={copyLink}
                className="px-2 py-1.5 rounded text-xs flex items-center gap-1 text-gray-300 hover:text-white"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Kopierat' : 'Kopiera'}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">
              I Outlook/Google: lägg till kalender via prenumerations-URL.
              Skriv inte in den manuellt – klistra in den exakt så
              uppdateras den automatiskt.
            </p>
          </div>

          <a
            href={httpsUrl}
            download="vm-2026-matches.ics"
            className="block text-center text-[11px] text-gray-500 hover:text-emerald-400 pt-1"
          >
            …eller ladda ner som engångs-ICS-fil
          </a>
        </div>
      )}
    </div>
  )
}
