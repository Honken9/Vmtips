'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Bell, Newspaper, Loader2, CheckCircle } from 'lucide-react'

interface Props {
  userId: string
  initialMatchReminders: boolean
  initialWeeklyDigest: boolean
}

export function EmailPreferencesToggle({
  userId,
  initialMatchReminders,
  initialWeeklyDigest,
}: Props) {
  const supabase = createClient()
  const [matchReminders, setMatchReminders] = useState(initialMatchReminders)
  const [weeklyDigest, setWeeklyDigest] = useState(initialWeeklyDigest)
  const [busy, setBusy] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  async function save(field: 'match_reminders' | 'weekly_digest', value: boolean) {
    setBusy(field)
    // Optimistisk uppdatering
    if (field === 'match_reminders') setMatchReminders(value)
    else setWeeklyDigest(value)

    const { error } = await supabase
      .from('email_preferences')
      .upsert(
        {
          user_id: userId,
          match_reminders: field === 'match_reminders' ? value : matchReminders,
          weekly_digest: field === 'weekly_digest' ? value : weeklyDigest,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    setBusy(null)
    if (error) {
      // Rollback
      if (field === 'match_reminders') setMatchReminders(!value)
      else setWeeklyDigest(!value)
      alert(`Kunde inte spara: ${error.message}`)
      return
    }
    setSavedKey(field)
    setTimeout(() => setSavedKey(k => (k === field ? null : k)), 2000)
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#1f2937' }}>
        <Mail size={16} className="text-emerald-400" />
        <span className="text-sm font-semibold text-white">Mejlinställningar</span>
      </div>
      <div className="px-5 py-4 space-y-4" style={{ background: '#0f172a' }}>
        <ToggleRow
          icon={<Bell size={14} />}
          label="Match-påminnelser"
          description="Mejl ~60 min före nästa match med dina otippade matcher."
          checked={matchReminders}
          onChange={v => save('match_reminders', v)}
          busy={busy === 'match_reminders'}
          saved={savedKey === 'match_reminders'}
        />
        <ToggleRow
          icon={<Newspaper size={14} />}
          label="Veckans digest"
          description="Fyndig sammanfattning varje måndag morgon – tabell, raket-tippare och senaste resultat."
          checked={weeklyDigest}
          onChange={v => save('weekly_digest', v)}
          busy={busy === 'weekly_digest'}
          saved={savedKey === 'weekly_digest'}
        />
        <p className="text-[11px] text-gray-600 pt-2 border-t" style={{ borderColor: '#1f2937' }}>
          Inställningarna sparas direkt. Vill du sluta få mejl helt – stäng av båda två.
        </p>
      </div>
    </div>
  )
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
  busy,
  saved,
}: {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  busy: boolean
  saved: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{icon}</span>
          <span className="text-sm font-medium text-white">{label}</span>
          {saved && (
            <span className="flex items-center gap-1 text-[11px] text-green-400">
              <CheckCircle size={11} /> Sparat
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={busy}
        role="switch"
        aria-checked={checked}
        className={`shrink-0 relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-gray-700'}`}
      >
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={11} className="animate-spin text-white" />
          </span>
        ) : (
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform"
            style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
          />
        )}
      </button>
    </div>
  )
}
