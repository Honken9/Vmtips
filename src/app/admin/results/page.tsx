'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Match, Team, Stage, STAGE_LABELS } from '@/lib/types'
import { resolveBracket, type BracketResolution } from '@/lib/bracket'
import { Flag } from '@/components/Flag'
import { CheckCircle, Loader2, Save, RefreshCw, GitBranch } from 'lucide-react'
import { stockholmWeekdayDateTime } from '@/lib/dates'

const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final']

// Bygg en karta match-id → [hemmalag, bortalag] från bracket-upplösningen.
function buildResolvedMap(res: BracketResolution): Map<number, [Team | null, Team | null]> {
  const map = new Map<number, [Team | null, Team | null]>()
  res.r32Matches.forEach((m, i) => map.set(m.id, res.r32Teams[i]))
  res.r16Matches.forEach((m, i) => map.set(m.id, res.r16Teams[i]))
  res.qfMatches.forEach((m, i) => map.set(m.id, res.qfTeams[i]))
  res.sfMatches.forEach((m, i) => map.set(m.id, res.sfTeams[i]))
  if (res.finalMatch) map.set(res.finalMatch.id, res.finalTeams)
  if (res.thirdMatch) map.set(res.thirdMatch.id, res.thirdTeams)
  return map
}

export default function AdminResultsPage() {
  const supabase = createClient()
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [scores, setScores] = useState<Record<number, { home: string; away: string }>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending')
  const [activeStage, setActiveStage] = useState<Stage>('group')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [fillingTeams, setFillingTeams] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .order('kickoff_at'),
      supabase.from('teams').select('*'),
    ]).then(([{ data: matchData }, { data: teamData }]) => {
      const m = (matchData ?? []) as Match[]
      setMatches(m)
      setTeams((teamData ?? []) as Team[])
      const s: Record<number, { home: string; away: string }> = {}
      m.forEach(match => {
        s[match.id] = {
          home: match.home_score != null ? String(match.home_score) : '',
          away: match.away_score != null ? String(match.away_score) : '',
        }
      })
      setScores(s)
    })
  }, [])

  // Löser upp slutspelsträdet från BEKRÄFTADE resultat (tom preds-array).
  // Ger oss faktiska lag i 16-delar/kvarts/etc. så fort matcherna före
  // avgjorts – både för visning och för "Fyll i lag".
  const resolvedMap = useMemo(() => {
    if (matches.length === 0 || teams.length === 0) return new Map<number, [Team | null, Team | null]>()
    return buildResolvedMap(resolveBracket(matches, teams, []))
  }, [matches, teams])

  // Skriver de upplösta lagen till slutspelsmatcher (home_team_id/away_team_id)
  // så hela appen visar rätt lag och admin lätt kan mata in resultat.
  // Rör ALDRIG matcher med bekräftat resultat (skyddar orientering) eller
  // gruppspel. Nollar bara lag på icke-bekräftade matcher om de inte längre
  // är upplösta (t.ex. efter att ett tidigare resultat rättats).
  async function fillKnockoutTeams(base: Match[]): Promise<{ next: Match[]; changed: number }> {
    if (teams.length === 0) return { next: base, changed: 0 }
    const rmap = buildResolvedMap(resolveBracket(base, teams, []))
    const teamById = new Map(teams.map(t => [t.id, t]))
    const updates: { id: number; home_team_id: number | null; away_team_id: number | null }[] = []
    for (const m of base) {
      if (m.stage === 'group' || m.result_confirmed) continue
      const [rh, ra] = rmap.get(m.id) ?? [null, null]
      const hId = rh?.id ?? null
      const aId = ra?.id ?? null
      if (m.home_team_id === hId && m.away_team_id === aId) continue
      updates.push({ id: m.id, home_team_id: hId, away_team_id: aId })
    }
    if (updates.length === 0) return { next: base, changed: 0 }

    for (const u of updates) {
      await supabase
        .from('matches')
        .update({ home_team_id: u.home_team_id, away_team_id: u.away_team_id })
        .eq('id', u.id)
    }

    const updById = new Map(updates.map(u => [u.id, u]))
    const next = base.map(m => {
      const u = updById.get(m.id)
      if (!u) return m
      return {
        ...m,
        home_team_id: u.home_team_id,
        away_team_id: u.away_team_id,
        home_team: u.home_team_id != null ? teamById.get(u.home_team_id) : undefined,
        away_team: u.away_team_id != null ? teamById.get(u.away_team_id) : undefined,
      }
    })
    return { next, changed: updates.length }
  }

  async function fillTeamsManual() {
    setFillingTeams(true)
    setSyncMessage(null)
    try {
      const { next, changed } = await fillKnockoutTeams(matches)
      if (changed > 0) setMatches(next)
      // Räkna även om slutspelspoängen (3p/lag/omgång) i samma klick
      const rc = await fetch('/api/admin/recompute-knockout-points', { method: 'POST' })
        .then(r => r.json()).catch(() => null)
      const rcInfo = rc?.ok ? ` · poäng omräknade för ${rc.users} deltagare` : ''
      setSyncMessage({
        type: 'ok',
        text: (changed > 0
          ? `${changed} slutspelsmatch${changed === 1 ? '' : 'er'} uppdaterad med rätt lag`
          : 'Alla avgjorda slutspelslag är redan ifyllda') + rcInfo,
      })
    } catch (err) {
      setSyncMessage({ type: 'err', text: `Kunde inte fylla i lag: ${String(err)}` })
    } finally {
      setFillingTeams(false)
      setTimeout(() => setSyncMessage(null), 8000)
    }
  }


  async function saveResult(matchId: number) {
    const val = scores[matchId]
    if (!val || val.home === '' || val.away === '') return

    const homeScore = parseInt(val.home)
    const awayScore = parseInt(val.away)
    if (isNaN(homeScore) || isNaN(awayScore)) return

    setSaving(matchId)

    const { error } = await supabase
      .from('matches')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        result_confirmed: true,
        manually_edited: true,
      })
      .eq('id', matchId)

    if (!error) {
      const updatedMatches = matches.map(m =>
        m.id === matchId
          ? { ...m, home_score: homeScore, away_score: awayScore, result_confirmed: true, manually_edited: true }
          : m
      )
      setSaved(prev => new Set(prev).add(matchId))
      setTimeout(() => setSaved(prev => { const s = new Set(prev); s.delete(matchId); return s }), 3000)

      // Uppdatera slutspelslagen automatiskt framåt: matchen som just
      // avgjordes kan låsa fast lag i nästa runda (16-del → kvart osv.).
      try {
        const { next } = await fillKnockoutTeams(updatedMatches)
        setMatches(next)
      } catch {
        setMatches(updatedMatches)
      }

      // Lås automatiskt tips för matchen (läge B)
      await supabase.rpc('lock_predictions_at_kickoff')
      // Slutspelspoängen (3p/lag/omgång) beror på resultaten – räkna om
      fetch('/api/admin/recompute-knockout-points', { method: 'POST' }).catch(() => {})
      // Auto-backup (server gör rate limiting)
      fetch('/api/backup?reason=admin-result-save', { method: 'POST' }).catch(() => {})
    }

    setSaving(null)
  }

  async function clearResult(matchId: number) {
    setSaving(matchId)
    await supabase
      .from('matches')
      .update({
        home_score: null,
        away_score: null,
        result_confirmed: false,
        manually_edited: false,
      })
      .eq('id', matchId)
    const cleared = matches.map(m =>
      m.id === matchId
        ? { ...m, home_score: null, away_score: null, result_confirmed: false, manually_edited: false }
        : m
    )
    setScores(prev => ({ ...prev, [matchId]: { home: '', away: '' } }))
    // Att rensa ett resultat kan göra nedströms-lag oavgjorda igen –
    // uppdatera slutspelsträdet så det speglar det.
    try {
      const { next } = await fillKnockoutTeams(cleared)
      setMatches(next)
    } catch {
      setMatches(cleared)
    }
    // Slutspelspoängen påverkas också av rensningen
    fetch('/api/admin/recompute-knockout-points', { method: 'POST' }).catch(() => {})
    setSaving(null)
  }

  async function syncFromApi() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/sync-results', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncMessage({ type: 'err', text: data.error || 'Synk misslyckades' })
      } else {
        const parts = [
          `${data.updated} uppdaterade`,
          `${data.skipped_manual} hoppade (manuellt redigerade)`,
          `${data.skipped_unchanged} oförändrade`,
        ]
        if (data.unmatched?.length) parts.push(`${data.unmatched.length} omappade`)
        setSyncMessage({ type: 'ok', text: parts.join(' · ') })

        // Ladda om matcher
        const { data: refreshed } = await supabase
          .from('matches')
          .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
          .order('kickoff_at')
        const m = (refreshed ?? []) as Match[]
        const s: Record<number, { home: string; away: string }> = {}
        m.forEach(match => {
          s[match.id] = {
            home: match.home_score != null ? String(match.home_score) : '',
            away: match.away_score != null ? String(match.away_score) : '',
          }
        })
        setScores(s)
        // Fyll i slutspelslag automatiskt efter synk
        try {
          const { next } = await fillKnockoutTeams(m)
          setMatches(next)
        } catch {
          setMatches(m)
        }
        // Slutspelspoängen beror på resultaten – räkna om efter synk
        fetch('/api/admin/recompute-knockout-points', { method: 'POST' }).catch(() => {})
      }
    } catch (err) {
      setSyncMessage({ type: 'err', text: String(err) })
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMessage(null), 8000)
    }
  }

  const stageMatches = matches.filter(m => m.stage === activeStage)
  const filtered = stageMatches.filter(m => {
    if (filter === 'pending') return !m.result_confirmed
    if (filter === 'done') return m.result_confirmed
    return true
  })

  const confirmedTotal = matches.filter(m => m.result_confirmed).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Mata in resultat</h1>
          <p className="text-gray-400 text-sm mt-1">
            {confirmedTotal} av {matches.length} matcher med bekräftat resultat
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={fillTeamsManual}
              disabled={fillingTeams}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: 'rgba(16,185,129,0.15)',
                color: '#34d399',
                border: '1px solid rgba(16,185,129,0.3)',
              }}
              title="Fyll i faktiska lag i slutspelsmatcherna utifrån avgjorda resultat"
            >
              {fillingTeams ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
              {fillingTeams ? 'Uppdaterar…' : 'Fyll i slutspelslag'}
            </button>
            <button
              onClick={syncFromApi}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: 'rgba(59,130,246,0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.3)',
              }}
              title="Hämta avklarade resultat från football-data.org"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {syncing ? 'Synkar…' : 'Synka från football-data.org'}
            </button>
          </div>
          {syncMessage && (
            <div
              className="text-xs px-3 py-1.5 rounded-lg max-w-xs text-right"
              style={{
                background: syncMessage.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: syncMessage.type === 'ok' ? '#4ade80' : '#f87171',
                border: `1px solid ${syncMessage.type === 'ok' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}
            >
              {syncMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Stage-tabs */}
      <div className="flex gap-2 flex-wrap">
        {STAGE_ORDER.map(stage => {
          const count = matches.filter(m => m.stage === stage).length
          if (count === 0) return null
          const doneCount = matches.filter(m => m.stage === stage && m.result_confirmed).length
          return (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeStage === stage
                  ? 'text-black gold-gradient'
                  : 'text-gray-400 hover:text-white'
              }`}
              style={activeStage !== stage ? { background: '#1f2937' } : undefined}
            >
              {STAGE_LABELS[stage]}
              <span className="ml-1.5 text-xs opacity-70">{doneCount}/{count}</span>
            </button>
          )
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'pending', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f ? 'text-white bg-white/10' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {f === 'all' ? 'Alla' : f === 'pending' ? 'Väntar' : 'Klara'}
          </button>
        ))}
      </div>

      {/* Matchlista */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Inga matcher att visa</div>
        ) : (
          filtered.map((match, i) => {
            // Föredra lag som redan är satt i DB; annars det bracket-upplösta
            // laget (från avgjorda resultat) så admin ser vem som spelar.
            const [rHome, rAway] = resolvedMap.get(match.id) ?? [null, null]
            const homeTeam = match.home_team ?? rHome ?? null
            const awayTeam = match.away_team ?? rAway ?? null
            // "Föreslaget" = upplöst men ännu inte sparat i DB (visas kursivt)
            const homeSuggested = !match.home_team && !!rHome
            const awaySuggested = !match.away_team && !!rAway
            const homeName = homeTeam?.name ?? match.home_placeholder ?? '?'
            const awayName = awayTeam?.name ?? match.away_placeholder ?? '?'
            const homeFlag = homeTeam?.flag ?? '🏴'
            const awayFlag = awayTeam?.flag ?? '🏴'
            const kickoff = stockholmWeekdayDateTime(match.kickoff_at)
            const val = scores[match.id] ?? { home: '', away: '' }
            const isSaving = saving === match.id
            const isSaved = match.result_confirmed || saved.has(match.id)

            return (
              <div
                key={match.id}
                className={`px-3 sm:px-5 py-3 sm:py-4 ${i > 0 ? 'border-t' : ''} ${
                  match.result_confirmed ? 'opacity-60 hover:opacity-100' : ''
                } transition-opacity`}
                style={{ borderColor: '#1f2937', background: match.result_confirmed ? 'rgba(34,197,94,0.03)' : undefined }}
              >
                <div className="sm:hidden text-xs text-gray-500 mb-2">{kickoff}</div>

                <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
                  <div className="hidden sm:block text-xs text-gray-500 w-28 shrink-0">{kickoff}</div>

                  <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                    <span className={`text-sm font-medium truncate ${homeSuggested ? 'text-emerald-300 italic' : 'text-white'}`}
                      title={homeSuggested ? 'Upplöst från resultat – inte sparat än' : undefined}>
                      {homeName}
                    </span>
                    <Flag emoji={homeFlag} name={homeName} width={22} height={16} className="shrink-0" />
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="99"
                      value={val.home}
                      onChange={e => setScores(s => ({ ...s, [match.id]: { ...s[match.id], home: e.target.value } }))}
                      placeholder="–"
                      className="w-10 sm:w-12 h-10 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      style={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                    />
                    <span className="text-gray-600 font-bold">–</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="99"
                      value={val.away}
                      onChange={e => setScores(s => ({ ...s, [match.id]: { ...s[match.id], away: e.target.value } }))}
                      placeholder="–"
                      className="w-10 sm:w-12 h-10 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      style={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Flag emoji={awayFlag} name={awayName} width={22} height={16} className="shrink-0" />
                    <span className={`text-sm font-medium truncate ${awaySuggested ? 'text-emerald-300 italic' : 'text-white'}`}
                      title={awaySuggested ? 'Upplöst från resultat – inte sparat än' : undefined}>
                      {awayName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0 mt-2 sm:mt-0 w-full sm:w-auto justify-end">
                    {match.result_confirmed && (
                      <button
                        onClick={() => clearResult(match.id)}
                        className="text-xs text-gray-500 hover:text-red-400 px-2 py-1"
                      >
                        Rensa
                      </button>
                    )}
                    <button
                      onClick={() => saveResult(match.id)}
                      disabled={isSaving || val.home === '' || val.away === ''}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                      style={{
                        background: isSaved ? 'rgba(34,197,94,0.15)' : 'rgba(16,185,129,0.15)',
                        color: isSaved ? '#22c55e' : '#10b981',
                        border: `1px solid ${isSaved ? 'rgba(34,197,94,0.3)' : 'rgba(16,185,129,0.3)'}`,
                      }}
                    >
                      {isSaving ? <Loader2 size={14} className="animate-spin" /> : isSaved ? <CheckCircle size={14} /> : <Save size={14} />}
                      {isSaved ? 'Sparat!' : 'Spara'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
