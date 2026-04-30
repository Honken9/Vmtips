'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Team, BonusResults } from '@/lib/types'
import { CheckCircle, Loader2, Star } from 'lucide-react'

export default function AdminBonusPage() {
  const supabase = createClient()
  const [teams, setTeams] = useState<Team[]>([])
  const [results, setResults] = useState<Partial<BonusResults>>({
    top_scorer: '', most_yellow_team_id: null, total_goals: null, confirmed: false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: teamsData }, { data: bonusData }] = await Promise.all([
        supabase.from('teams').select('*').order('group_name').order('name'),
        supabase.from('bonus_results').select('*').eq('id', 1).maybeSingle(),
      ])
      if (teamsData) setTeams(teamsData)
      if (bonusData) setResults(bonusData)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    await supabase.from('bonus_results').upsert({
      id: 1,
      top_scorer: results.top_scorer || null,
      most_yellow_team_id: results.most_yellow_team_id || null,
      total_goals: results.total_goals || null,
      confirmed: results.confirmed ?? false,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const sortedTeams = [...teams].sort((a, b) =>
    (a.group_name ?? '').localeCompare(b.group_name ?? '') || a.name.localeCompare(b.name)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bonusfacit</h1>
        <p className="text-gray-400 text-sm mt-1">
          Fyll i rätt svar efter turneringen och bocka "Bekräftat" – poäng räknas ut automatiskt.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: '#1f2937' }}>
          <Star size={18} className="text-amber-400" />
          <span className="font-bold text-white">Rätt svar (5p per kategori)</span>
        </div>

        <div className="p-5 space-y-5" style={{ background: '#111827' }}>
          {/* Skytteligavinnare */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              ⚽ Skytteligavinnare (spelarnamn)
            </label>
            <input
              type="text"
              value={results.top_scorer ?? ''}
              onChange={e => setResults(r => ({ ...r, top_scorer: e.target.value }))}
              placeholder="T.ex. Erling Haaland"
              className="w-full max-w-sm px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              style={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            />
          </div>

          {/* Flest gula kort */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              🟨 Lag med flest gula kort
            </label>
            <select
              value={results.most_yellow_team_id ?? ''}
              onChange={e => setResults(r => ({ ...r, most_yellow_team_id: e.target.value ? parseInt(e.target.value) : null }))}
              className="w-full max-w-sm px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              style={{ background: '#1f2937', border: '1px solid #374151', color: results.most_yellow_team_id ? '#f9fafb' : '#6b7280' }}
            >
              <option value="">– Välj lag –</option>
              {sortedTeams.map(t => (
                <option key={t.id} value={t.id}>{t.flag} {t.name} (Grupp {t.group_name})</option>
              ))}
            </select>
          </div>

          {/* Totalt antal mål */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              🥅 Totalt antal mål i turneringen
            </label>
            <input
              type="number"
              min="0"
              max="999"
              value={results.total_goals ?? ''}
              onChange={e => setResults(r => ({ ...r, total_goals: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="T.ex. 172"
              className="w-40 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              style={{ background: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }}
            />
          </div>

          {/* Bekräftat-toggle */}
          <div className="pt-2 border-t" style={{ borderColor: '#1f2937' }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setResults(r => ({ ...r, confirmed: !r.confirmed }))}
                className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${results.confirmed ? 'bg-green-500' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${results.confirmed ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Bekräftat</div>
                <div className="text-xs text-gray-500">Aktivera för att bonuspoängen ska räknas in i tabellen</div>
              </div>
            </label>
          </div>

          {/* Spara-knapp */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-black gold-gradient disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Spara facit
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-400">
                <CheckCircle size={16} /> Sparat!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
