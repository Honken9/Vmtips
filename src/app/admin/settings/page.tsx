'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, TournamentMode } from '@/lib/types'
import { Loader2, CheckCircle, AlertTriangle, Lock } from 'lucide-react'

export default function AdminSettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [lockingAll, setLockingAll] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('*').single().then(({ data }) => {
      setSettings(data as Settings)
    })
  }, [])

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    await supabase.from('settings').update({
      tournament_mode: settings.tournament_mode,
      points_correct_result: settings.points_correct_result,
      points_exact_score: settings.points_exact_score,
      points_winner: settings.points_winner,
      points_finalist: settings.points_finalist,
      randomize_duration: settings.randomize_duration ?? 15,
      randomize_phrase_1: settings.randomize_phrase_1 ?? '',
      randomize_phrase_2: settings.randomize_phrase_2 ?? '',
      randomize_phrase_3: settings.randomize_phrase_3 ?? '',
    }).eq('id', 1)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function lockAllTips() {
    if (!confirm('Lås ALLA deltagares tips? Detta går inte att ångra.')) return
    setLockingAll(true)

    // Hämta alla users
    const { data: profiles } = await supabase.from('profiles').select('id').eq('is_admin', false)
    for (const p of profiles ?? []) {
      await supabase.rpc('lock_user_tips', { p_user_id: p.id })
    }
    // Sätt global lock
    await supabase.from('settings').update({ mode_a_global_lock: true }).eq('id', 1)
    setSettings(s => s ? { ...s, mode_a_global_lock: true } : s)
    setLockingAll(false)
  }

  if (!settings) {
    return <div className="flex items-center gap-2 text-gray-400"><Loader2 size={16} className="animate-spin" /> Laddar...</div>
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Inställningar</h1>
        <p className="text-gray-400 text-sm mt-1">Turneringsläge och poängsystem</p>
      </div>

      {/* Turneringsläge */}
      <section className="rounded-xl p-6 space-y-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <h2 className="text-lg font-semibold text-white">Turneringsläge</h2>

        <div className="grid gap-3">
          {([
            {
              mode: 'A' as TournamentMode,
              title: 'Läge A – Allt på en gång',
              desc: 'Deltagarna tippar alla matcher och lämnar in. Tips kan inte ändras efter inlämning. Perfekt för klassiskt ligaformat.',
              icon: '📋',
            },
            {
              mode: 'B' as TournamentMode,
              title: 'Läge B – Löpande per match',
              desc: 'Deltagarna tippar inför varje match. Tips låses automatiskt vid avspark. Mer engagerande under turneringen.',
              icon: '⚡',
            },
          ] as const).map(({ mode, title, desc, icon }) => (
            <button
              key={mode}
              onClick={() => setSettings(s => s ? { ...s, tournament_mode: mode } : s)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                settings.tournament_mode === mode
                  ? 'border-emerald-400/60 bg-emerald-400/5'
                  : 'border-transparent hover:border-white/10'
              }`}
              style={settings.tournament_mode !== mode ? { background: '#1f2937' } : undefined}
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xl">{icon}</span>
                <span className="font-semibold text-white">{title}</span>
                {settings.tournament_mode === mode && (
                  <span className="ml-auto text-xs text-emerald-400 font-medium">Aktivt</span>
                )}
              </div>
              <p className="text-sm text-gray-400 ml-8">{desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Poängsystem */}
      <section className="rounded-xl p-6 space-y-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <h2 className="text-lg font-semibold text-white">Poängsystem</h2>

        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'points_correct_result' as const, label: 'Rätt tecken (1/X/2)', hint: 'ex. 3 poäng' },
            { key: 'points_exact_score' as const, label: 'Exakt resultat', hint: 'ex. 5 poäng' },
            { key: 'points_winner' as const, label: 'Rätt mästare (bonus)', hint: 'ex. 10 poäng' },
            { key: 'points_finalist' as const, label: 'Rätt finalist (bonus)', hint: 'ex. 5 poäng' },
          ].map(({ key, label, hint }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={settings[key]}
                  onChange={e => setSettings(s => s ? { ...s, [key]: parseInt(e.target.value) || 0 } : s)}
                  className="w-20 px-3 py-2 rounded-lg text-center text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  style={{ background: '#1f2937', border: '1px solid #374151' }}
                />
                <span className="text-sm text-gray-500">{hint}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Slumpning – globala inställningar för "Slumpa fram tips" */}
      <section className="rounded-xl p-6 space-y-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <h2 className="text-lg font-semibold text-white">Slumpinställningar</h2>
        <p className="text-sm text-gray-400">
          Påverkar &quot;Slumpa fram tips&quot;-funktionen för alla deltagare.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Animationslängd: <span className="text-emerald-400 font-bold">{settings.randomize_duration ?? 15} sek</span>
          </label>
          <input
            type="range"
            min={3}
            max={30}
            value={settings.randomize_duration ?? 15}
            onChange={e => setSettings(s => s ? { ...s, randomize_duration: parseInt(e.target.value) } : s)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>3 sek</span><span>30 sek</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Egna fraser i animeringen <span className="text-xs text-gray-500 font-normal">(valfritt)</span>
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Visas blandat med standardfraserna under spänningsanimationen. Lämna tomma för att bara använda standardfraserna.
          </p>
          {[1, 2, 3].map(i => {
            const key = `randomize_phrase_${i}` as 'randomize_phrase_1' | 'randomize_phrase_2' | 'randomize_phrase_3'
            return (
              <input
                key={i}
                type="text"
                value={settings[key] ?? ''}
                onChange={e => setSettings(s => s ? { ...s, [key]: e.target.value } : s)}
                placeholder={`Fras ${i} – t.ex. "Tippsen rullar in..."`}
                maxLength={60}
                className="w-full mb-2 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              />
            )
          })}
        </div>
      </section>

      {/* Spara-knapp */}
      <button
        onClick={saveSettings}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-black transition-all disabled:opacity-50 gold-gradient"
      >
        {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <CheckCircle size={18} /> : null}
        {saved ? 'Sparat!' : 'Spara inställningar'}
      </button>

      {/* Lås alla tips (Läge A) */}
      {settings.tournament_mode === 'A' && (
        <section className="rounded-xl p-6 space-y-3"
          style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={18} />
            <h2 className="text-lg font-semibold">Globalt lås – Läge A</h2>
          </div>
          <p className="text-sm text-gray-400">
            Lås ALLA deltagares tips på en gång. Används när turneringen börjar och tippningstiden är slut. Kan inte ångras.
          </p>
          {settings.mode_a_global_lock ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Lock size={16} />
              Alla tips är låsta
            </div>
          ) : (
            <button
              onClick={lockAllTips}
              disabled={lockingAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}
            >
              {lockingAll ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              Lås alla tips nu
            </button>
          )}
        </section>
      )}
    </div>
  )
}
