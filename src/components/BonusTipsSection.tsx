'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Team, BonusPrediction, BonusResults, Prediction } from '@/lib/types'
import { Star, CheckCircle, Loader2, Calculator } from 'lucide-react'
import { getAllFallbackPlayers } from '@/lib/wc-fallback-squads'

interface Props {
  userId: string
  teams: Team[]
  bonus: BonusPrediction | null
  bonusResults: BonusResults | null
  locked: boolean
  predictions?: Prediction[]
}

type Field = 'top_scorer' | 'most_yellow_team_id' | 'total_goals'

const CATEGORIES = [
  {
    field: 'top_scorer' as Field,
    label: 'Skytteligavinnare (spelarens namn)',
    emoji: '⚽',
    description: 'Skriv NAMNET på spelaren – inte laget – som gör flest mål under turneringen.',
    type: 'text' as const,
  },
  {
    field: 'most_yellow_team_id' as Field,
    label: 'Flest gula kort (lag)',
    emoji: '🟨',
    description: 'Välj LAGET som får flest gula kort sammanlagt i turneringen.',
    type: 'team' as const,
  },
  {
    field: 'total_goals' as Field,
    label: 'Totalt antal mål',
    emoji: '🥅',
    description: 'Hur många mål görs i hela turneringen?',
    type: 'number' as const,
  },
]

function getResultBadge(field: Field, pred: BonusPrediction | null, results: BonusResults | null, teams: Team[]): React.ReactNode {
  if (!results?.confirmed || !pred) return null

  let correct = false
  if (field === 'top_scorer' && pred.top_scorer && results.top_scorer) {
    correct = pred.top_scorer.toLowerCase().trim() === results.top_scorer.toLowerCase().trim()
  } else if (field === 'most_yellow_team_id' && pred.most_yellow_team_id != null && results.most_yellow_team_id != null) {
    correct = pred.most_yellow_team_id === results.most_yellow_team_id
  } else if (field === 'total_goals' && pred.total_goals != null && results.total_goals != null) {
    correct = pred.total_goals === results.total_goals
  }

  const facitTeam = field === 'most_yellow_team_id'
    ? teams.find(t => t.id === results.most_yellow_team_id)
    : null

  const facitText =
    field === 'top_scorer' ? results.top_scorer :
    field === 'most_yellow_team_id' ? (facitTeam ? `${facitTeam.flag} ${facitTeam.name}` : '–') :
    field === 'total_goals' ? `${results.total_goals} mål` : '–'

  return (
    <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${correct ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
      {correct ? '✓ Rätt! +5p' : `✗ Fel – rätt svar: ${facitText}`}
    </div>
  )
}

export function BonusTipsSection({ userId, teams, bonus, bonusResults, locked, predictions = [] }: Props) {
  const supabase = createClient()

  // Spelare för skytteligavinnare-dropdown. När football-data.org levererar
  // riktiga trupper kan denna bytas mot spelare från trupp-endpointen.
  const allPlayers = useMemo(() => {
    const players = getAllFallbackPlayers()
    // Sortera: anfallare och mittfältare först (de som faktiskt gör mål),
    // sen efter marknadsvärde, sen alfabetiskt på namn.
    const positionWeight: Record<string, number> = {
      Forward: 0, Midfielder: 1, Defender: 2, Goalkeeper: 3,
    }
    return [...players].sort((a, b) => {
      const pw = (positionWeight[a.position] ?? 9) - (positionWeight[b.position] ?? 9)
      if (pw !== 0) return pw
      const mv = (b.marketValueM ?? 0) - (a.marketValueM ?? 0)
      if (mv !== 0) return mv
      return a.name.localeCompare(b.name)
    })
  }, [])

  // Summan av användarens egna tippade mål — auto-förslag för "Totalt antal mål".
  const tippedTotalGoals = useMemo(() => {
    return predictions.reduce((sum, p) => sum + (p.pred_home ?? 0) + (p.pred_away ?? 0), 0)
  }, [predictions])

  const [vals, setVals] = useState<Record<Field, string>>({
    top_scorer: bonus?.top_scorer ?? '',
    most_yellow_team_id: bonus?.most_yellow_team_id != null ? String(bonus.most_yellow_team_id) : '',
    total_goals: bonus?.total_goals != null ? String(bonus.total_goals) : '',
  })
  const [saving, setSaving] = useState<Field | null>(null)
  const [saved, setSaved] = useState<Set<Field>>(new Set())

  const save = useCallback(async (field: Field) => {
    const raw = vals[field]
    if (raw === '') return

    setSaving(field)
    const update: Record<string, string | number | null> = { user_id: userId }

    if (field === 'top_scorer') {
      update.top_scorer = raw
    } else if (field === 'most_yellow_team_id') {
      update.most_yellow_team_id = parseInt(raw)
    } else if (field === 'total_goals') {
      update.total_goals = parseInt(raw)
    }

    await supabase
      .from('bonus_predictions')
      .upsert(update, { onConflict: 'user_id' })

    setSaving(null)
    setSaved(prev => new Set(prev).add(field))
    setTimeout(() => setSaved(prev => { const s = new Set(prev); s.delete(field); return s }), 2000)
    fetch('/api/backup?reason=user-bonus-save', { method: 'POST' }).catch(() => {})
  }, [vals, supabase, userId])

  const sortedTeams = [...teams].sort((a, b) => {
    if (a.group_name && b.group_name) return a.group_name.localeCompare(b.group_name) || a.name.localeCompare(b.name)
    return a.name.localeCompare(b.name)
  })

  // Räkna ihop bonuspoäng
  const earnedBonus = (() => {
    if (!bonusResults?.confirmed || !bonus) return 0
    let pts = 0
    if (bonus.top_scorer && bonusResults.top_scorer &&
        bonus.top_scorer.toLowerCase().trim() === bonusResults.top_scorer.toLowerCase().trim()) pts += 5
    if (bonus.most_yellow_team_id != null && bonus.most_yellow_team_id === bonusResults.most_yellow_team_id) pts += 5
    if (bonus.total_goals != null && bonus.total_goals === bonusResults.total_goals) pts += 5
    return pts
  })()

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#111827' }}>
        <div className="flex items-center gap-3">
          <Star size={18} className="text-emerald-400" />
          <span className="font-bold text-white">Bonustips</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1f2937', color: '#9ca3af' }}>
            5p per rätt svar
          </span>
        </div>
        {bonusResults?.confirmed && earnedBonus > 0 && (
          <span className="text-sm font-bold text-emerald-400">+{earnedBonus}p</span>
        )}
      </div>

      {/* Hjälptext – syns alltid */}
      {!locked && (
        <div className="px-5 py-2.5 text-xs text-emerald-300 border-b" style={{ background: 'rgba(16,185,129,0.05)', borderColor: '#1f2937' }}>
          Dina bonustips sparas automatiskt och du kan ändra dem ända fram tills du låser dina tips.
        </div>
      )}

      <div className="divide-y" style={{ borderColor: '#1f2937' }}>
        {CATEGORIES.map(cat => {
          const isSaving = saving === cat.field
          const isJustSaved = saved.has(cat.field)
          const val = vals[cat.field]

          return (
            <div key={cat.field} className="px-5 py-4" style={{ background: '#0f172a' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="font-medium text-white text-sm">{cat.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{cat.description}</p>

                  {/* Input */}
                  {locked ? (
                    <div className="text-sm px-3 py-2 rounded-lg inline-block"
                      style={{ background: '#1f2937', color: val ? '#f9fafb' : '#6b7280' }}>
                      {cat.type === 'team'
                        ? (() => {
                            const t = teams.find(t => String(t.id) === val)
                            return t ? `${t.flag} ${t.name}` : (val ? val : '– ej tippat –')
                          })()
                        : (val || '– ej tippat –')
                      }
                    </div>
                  ) : cat.type === 'text' ? (
                    <>
                      <input
                        type="text"
                        list="top-scorer-suggestions"
                        value={val}
                        placeholder="Sök eller skriv spelarnamn…"
                        onChange={e => setVals(v => ({ ...v, [cat.field]: e.target.value }))}
                        onBlur={() => save(cat.field)}
                        className="w-full max-w-md px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        style={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                      />
                      <datalist id="top-scorer-suggestions">
                        {allPlayers.slice(0, 250).map(p => (
                          <option key={`${p.country}-${p.name}`} value={p.name}>
                            {p.country} · {p.club ?? ''}
                          </option>
                        ))}
                      </datalist>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Förslag baseras på preliminära trupper – uppdateras när VM-trupperna är spikade.
                      </p>
                    </>
                  ) : cat.type === 'team' ? (
                    <select
                      value={val}
                      onChange={e => {
                        setVals(v => ({ ...v, [cat.field]: e.target.value }))
                      }}
                      onBlur={() => save(cat.field)}
                      className="w-full max-w-xs px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      style={{ background: '#1f2937', border: '1px solid #374151', color: val ? '#f9fafb' : '#6b7280' }}
                    >
                      <option value="">– Välj lag –</option>
                      {sortedTeams.map(t => (
                        <option key={t.id} value={String(t.id)}>
                          {t.flag} {t.name} (Grupp {t.group_name})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={val}
                        placeholder="Antal mål…"
                        onChange={e => setVals(v => ({ ...v, [cat.field]: e.target.value }))}
                        onBlur={() => save(cat.field)}
                        className="w-36 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        style={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
                      />
                      {tippedTotalGoals > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setVals(v => ({ ...v, total_goals: String(tippedTotalGoals) }))
                            // Spara direkt så slipper vi extra blur-klick
                            setTimeout(() => save('total_goals'), 0)
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black transition-all hover:opacity-90 shadow-sm"
                          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                          title="Räknar ihop alla mål från dina egna matchtips"
                        >
                          <Calculator size={14} />
                          Använd mina tips: {tippedTotalGoals} mål
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Lägg först några matchtips, så summerar vi målen automatiskt"
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium opacity-60 cursor-not-allowed"
                          style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #374151' }}
                        >
                          <Calculator size={14} />
                          Lägg först matchtips
                        </button>
                      )}
                    </div>
                  )}

                  {/* Spara-indikator */}
                  <div className="mt-1.5 h-4 flex items-center gap-1.5">
                    {isSaving && <Loader2 size={12} className="animate-spin text-emerald-400" />}
                    {!isSaving && isJustSaved && (
                      <>
                        <CheckCircle size={12} className="text-green-400" />
                        <span className="text-xs text-green-400">Sparat</span>
                      </>
                    )}
                  </div>

                  {/* Resultat-badge om facit är klart */}
                  {getResultBadge(cat.field, bonus
                    ? { ...bonus, top_scorer: vals.top_scorer || bonus.top_scorer, total_goals: vals.total_goals ? parseInt(vals.total_goals) : bonus.total_goals, most_yellow_team_id: vals.most_yellow_team_id ? parseInt(vals.most_yellow_team_id) : bonus.most_yellow_team_id }
                    : null, bonusResults, teams)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
