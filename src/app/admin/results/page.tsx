'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Match, Stage, STAGE_LABELS } from '@/lib/types'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CheckCircle, Loader2, Save, RefreshCw } from 'lucide-react'

const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final']

export default function AdminResultsPage() {
  const supabase = createClient()
  const [matches, setMatches] = useState<Match[]>([])
  const [scores, setScores] = useState<Record<number, { home: string; away: string }>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending')
  const [activeStage, setActiveStage] = useState<Stage>('group')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('kickoff_at')
      .then(({ data }) => {
        const m = (data ?? []) as Match[]
        setMatches(m)
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
      setMatches(prev => prev.map(m =>
        m.id === matchId
          ? { ...m, home_score: homeScore, away_score: awayScore, result_confirmed: true, manually_edited: true }
          : m
      ))
      setSaved(prev => new Set(prev).add(matchId))
      setTimeout(() => setSaved(prev => { const s = new Set(prev); s.delete(matchId); return s }), 3000)

      // Lås automatiskt tips för matchen (läge B)
      await supabase.rpc('lock_predictions_at_kickoff')
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
    setMatches(prev => prev.map(m =>
      m.id === matchId
        ? { ...m, home_score: null, away_score: null, result_confirmed: false, manually_edited: false }
        : m
    ))
    setScores(prev => ({ ...prev, [matchId]: { home: '', away: '' } }))
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
        setMatches(m)
        const s: Record<number, { home: string; away: string }> = {}
        m.forEach(match => {
          s[match.id] = {
            home: match.home_score != null ? String(match.home_score) : '',
            away: match.away_score != null ? String(match.away_score) : '',
          }
        })
        setScores(s)
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
            const homeName = match.home_team?.name ?? match.home_placeholder ?? '?'
            const awayName = match.away_team?.name ?? match.away_placeholder ?? '?'
            const homeFlag = match.home_team?.flag ?? '🏴'
            const awayFlag = match.away_team?.flag ?? '🏴'
            const kickoff = format(new Date(match.kickoff_at), 'EEE d MMM HH:mm', { locale: sv })
            const val = scores[match.id] ?? { home: '', away: '' }
            const isSaving = saving === match.id
            const isSaved = saved.has(match.id)

            return (
              <div
                key={match.id}
                className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t' : ''} ${
                  match.result_confirmed ? 'opacity-60 hover:opacity-100' : ''
                } transition-opacity`}
                style={{ borderColor: '#1f2937', background: match.result_confirmed ? 'rgba(34,197,94,0.03)' : undefined }}
              >
                {/* Datum */}
                <div className="text-xs text-gray-500 w-28 shrink-0">{kickoff}</div>

                {/* Hemmalag */}
                <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                  <span className="text-sm font-medium text-white truncate">{homeName}</span>
                  <span className="text-lg">{homeFlag}</span>
                </div>

                {/* Inmatning */}
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={val.home}
                    onChange={e => setScores(s => ({ ...s, [match.id]: { ...s[match.id], home: e.target.value } }))}
                    placeholder="–"
                    className="w-12 h-10 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                    style={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                  />
                  <span className="text-gray-600 font-bold">–</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={val.away}
                    onChange={e => setScores(s => ({ ...s, [match.id]: { ...s[match.id], away: e.target.value } }))}
                    placeholder="–"
                    className="w-12 h-10 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                    style={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                  />
                </div>

                {/* Bortalag */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">{awayFlag}</span>
                  <span className="text-sm font-medium text-white truncate">{awayName}</span>
                </div>

                {/* Spara */}
                <div className="flex items-center gap-2 shrink-0">
                  {match.result_confirmed && (
                    <button
                      onClick={() => clearResult(match.id)}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1"
                    >
                      Rensa
                    </button>
                  )}
                  <button
                    onClick={() => saveResult(match.id)}
                    disabled={isSaving || val.home === '' || val.away === ''}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                    style={{
                      background: isSaved ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                      color: isSaved ? '#22c55e' : '#f59e0b',
                      border: `1px solid ${isSaved ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    }}
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isSaved ? (
                      <CheckCircle size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {isSaved ? 'Sparat!' : 'Spara'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
