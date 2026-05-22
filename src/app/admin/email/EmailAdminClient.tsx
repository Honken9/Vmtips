'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Save, Send, Mail, CheckCircle, AlertCircle, Clock, Newspaper } from 'lucide-react'

interface EmailSettings {
  id: number
  reminder_enabled: boolean
  reminder_minutes_before: number
  reminder_subject: string
  reminder_intro: string
  digest_enabled: boolean
  digest_day_of_week: number
  digest_hour: number
  last_digest_at: string | null
  sender_name: string
  sender_email: string
}

interface LogRow {
  id: number
  type: string
  pool_id: number | null
  subject: string | null
  recipient_count: number
  sent_at: string
  status: string
  error: string | null
}

interface DigestPreviewRow {
  pool_id: number
  pool_name: string
  recipient_count: number
  witty_intro: string
  matches_count: number
  leaderboard_count: number
}

export function EmailAdminClient({ settings: initial, log }: { settings: EmailSettings; log: LogRow[] }) {
  const supabase = createClient()
  const [s, setS] = useState<EmailSettings>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [digestPreview, setDigestPreview] = useState<DigestPreviewRow[] | null>(null)
  const [editedIntros, setEditedIntros] = useState<Record<number, string>>({})

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text })
    setTimeout(() => setMsg(null), 6000)
  }

  function update<K extends keyof EmailSettings>(key: K, val: EmailSettings[K]) {
    setS(prev => ({ ...prev, [key]: val }))
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('email_settings').update({
      reminder_enabled: s.reminder_enabled,
      reminder_minutes_before: s.reminder_minutes_before,
      reminder_subject: s.reminder_subject,
      reminder_intro: s.reminder_intro,
      digest_enabled: s.digest_enabled,
      digest_day_of_week: s.digest_day_of_week,
      digest_hour: s.digest_hour,
      sender_name: s.sender_name,
      sender_email: s.sender_email,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setSaving(false)
    if (error) {
      flash(false, error.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function sendTest() {
    if (!testEmail.includes('@')) return
    setBusy('test')
    const res = await fetch('/api/email/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: testEmail }),
    })
    setBusy(null)
    const data = await res.json().catch(() => ({}))
    if (res.ok) flash(true, `Test-mejl skickat till ${testEmail}`)
    else flash(false, data.error ?? `HTTP ${res.status}`)
  }

  async function previewDigest() {
    setBusy('preview')
    setDigestPreview(null)
    const res = await fetch('/api/email/digest/preview', { method: 'POST' })
    setBusy(null)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      flash(false, data.error ?? `HTTP ${res.status}`)
      return
    }
    const rows = (data.previews ?? []) as DigestPreviewRow[]
    setDigestPreview(rows)
    const intros: Record<number, string> = {}
    for (const r of rows) intros[r.pool_id] = r.witty_intro
    setEditedIntros(intros)
    if (rows.length === 0) flash(false, 'Inga ligor att skicka till')
  }

  async function sendDigestNow() {
    if (!digestPreview) return
    if (!confirm(`Skicka digest till ${digestPreview.length} ligor nu med texterna nedan?`)) return
    setBusy('digest')
    const res = await fetch('/api/email/digest?manual=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intros: editedIntros }),
    })
    setBusy(null)
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      const sentPools = (data.pools ?? []).filter((p: { status: string }) => p.status === 'sent').length
      flash(true, `Digest skickad till ${sentPools} ligor`)
      setDigestPreview(null)
    } else {
      flash(false, data.error ?? `HTTP ${res.status}`)
    }
  }

  async function sendReminderNow() {
    if (!confirm('Skicka påminnelse till alla matcher i fönstret nu?')) return
    setBusy('reminder')
    const res = await fetch('/api/email/reminder', { method: 'POST' })
    setBusy(null)
    const data = await res.json().catch(() => ({}))
    if (res.ok) flash(true, `Påminnelse: ${data.sent ?? 0} mottagare, ${data.matches ?? 0} matcher`)
    else flash(false, data.error ?? `HTTP ${res.status}`)
  }

  return (
    <div className="space-y-6">
      {/* Setup-check */}
      <div className="rounded-xl p-4 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
        <strong>Setup-checklista (Brevo – gratis 300 mejl/dag, obegränsat antal domäner):</strong>
        <ol className="mt-2 space-y-1 list-decimal list-inside text-gray-300">
          <li>Skapa konto på <a href="https://www.brevo.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">brevo.com</a></li>
          <li>Senders, Domains &amp; Dedicated IPs → Domains → Add → <code>tippavm2026.se</code> + lägg DNS-records (SPF + DKIM + DMARC)</li>
          <li>SMTP &amp; API → API keys → Generate new → kopiera nyckeln (börjar med <code>xkeysib-…</code>)</li>
          <li>Lägg <code>BREVO_API_KEY</code> i Vercel env vars (Production + Preview) → Redeploy</li>
          <li>Klicka &quot;Skicka test-mejl&quot; nedan för att verifiera</li>
        </ol>
      </div>

      {msg && (
        <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-2" style={{
          background: msg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: msg.ok ? '#4ade80' : '#f87171',
          border: `1px solid ${msg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {msg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {msg.text}
        </div>
      )}

      {/* Sender */}
      <Section title="Avsändare">
        <Row label="Avsändar-namn">
          <input type="text" value={s.sender_name} onChange={e => update('sender_name', e.target.value)} className={inputCls} style={inputStyle} />
        </Row>
        <Row label="Avsändar-mejl">
          <input type="email" value={s.sender_email} onChange={e => update('sender_email', e.target.value)} className={inputCls} style={inputStyle} />
        </Row>
        <Row label="Skicka test-mejl">
          <div className="flex gap-2">
            <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="din@email.se" className={`${inputCls} flex-1`} style={inputStyle} />
            <button onClick={sendTest} disabled={!testEmail || busy === 'test'} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-black gold-gradient disabled:opacity-40">
              {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Skicka test
            </button>
          </div>
        </Row>
      </Section>

      {/* Reminder */}
      <Section title="Match-påminnelser" icon={<Clock size={16} className="text-emerald-400" />}>
        <Row label="Aktiverad">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.reminder_enabled} onChange={e => update('reminder_enabled', e.target.checked)} />
            {s.reminder_enabled ? 'På' : 'Av'}
          </label>
        </Row>
        <Row label="Minuter före kickoff">
          <input type="number" min="5" max="720" value={s.reminder_minutes_before} onChange={e => update('reminder_minutes_before', Math.max(5, parseInt(e.target.value) || 60))} className={`${inputCls} w-24`} style={inputStyle} />
          <span className="ml-2 text-xs text-gray-500">Vercel cron körs varje 15 min → mejlet kan komma 0-15 min senare än önskat</span>
        </Row>
        <Row label="Ämne">
          <input type="text" value={s.reminder_subject} onChange={e => update('reminder_subject', e.target.value)} className={inputCls} style={inputStyle} />
        </Row>
        <Row label="Meddelande">
          <textarea value={s.reminder_intro} onChange={e => update('reminder_intro', e.target.value)} rows={3} className={inputCls} style={inputStyle} />
        </Row>
        <div className="pt-2">
          <button onClick={sendReminderNow} disabled={busy === 'reminder'} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-emerald-300 disabled:opacity-40" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
            {busy === 'reminder' ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            Skicka påminnelse nu (manuellt)
          </button>
        </div>
      </Section>

      {/* Digest */}
      <Section title="Veckans digest" icon={<Newspaper size={16} className="text-emerald-400" />}>
        <p className="text-xs text-gray-500">
          Digesten skickas manuellt nedan – så ofta du vill, inte bara en gång i veckan.
          Förhandsgranska först, läs och redigera den fyndiga texten per liga, skicka sedan.
        </p>
        {s.last_digest_at && (
          <Row label="Senast skickad">
            <span className="text-sm text-gray-400">{new Date(s.last_digest_at).toLocaleString('sv-SE')}</span>
          </Row>
        )}

        {!digestPreview ? (
          <div className="pt-2">
            <button onClick={previewDigest} disabled={busy === 'preview'} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-emerald-300 disabled:opacity-40" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Newspaper size={14} />}
              Förhandsgranska digest
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="text-xs text-gray-400">
              {digestPreview.length} ligor. Läs och justera intro-texten per liga – resten
              (tabell, matcher) genereras automatiskt från statistiken.
            </div>
            {digestPreview.map(p => (
              <div key={p.pool_id} className="rounded-lg p-3 space-y-2" style={{ background: '#0f172a', border: '1px solid #1f2937' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{p.pool_name}</span>
                  <span className="text-[11px] text-gray-500">
                    {p.recipient_count} mottagare · {p.matches_count} matcher · {p.leaderboard_count} i tabell
                  </span>
                </div>
                <textarea
                  value={editedIntros[p.pool_id] ?? ''}
                  onChange={e => setEditedIntros(prev => ({ ...prev, [p.pool_id]: e.target.value }))}
                  rows={3}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Intro-text för digesten…"
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={sendDigestNow} disabled={busy === 'digest'} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-40 gold-gradient">
                {busy === 'digest' ? <Loader2 size={14} className="animate-spin" /> : <Newspaper size={14} />}
                Skicka digest till {digestPreview.length} ligor
              </button>
              <button onClick={() => setDigestPreview(null)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white" style={{ background: '#1f2937', border: '1px solid #374151' }}>
                Avbryt
              </button>
              <button onClick={previewDigest} disabled={busy === 'preview'} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white disabled:opacity-40" style={{ background: '#1f2937', border: '1px solid #374151' }}>
                {busy === 'preview' ? <Loader2 size={14} className="animate-spin inline" /> : 'Generera om texterna'}
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Save */}
      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-black disabled:opacity-50 gold-gradient">
        {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <CheckCircle size={18} /> : <Save size={18} />}
        {saved ? 'Sparat' : 'Spara inställningar'}
      </button>

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Historik (senaste 30)</h2>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
          {log.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500" style={{ background: '#111827' }}>Inga utskick gjorda än</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#1f2937' }}>
                  <th className="text-left px-4 py-2 text-xs text-gray-400 uppercase">Tid</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-400 uppercase">Typ</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-400 uppercase">Ämne</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 uppercase">Mottagare</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.map(row => (
                  <tr key={row.id} className="border-t" style={{ borderColor: '#1f2937', background: '#111827' }}>
                    <td className="px-4 py-2 text-xs text-gray-500">{new Date(row.sent_at).toLocaleString('sv-SE')}</td>
                    <td className="px-4 py-2 text-xs text-gray-300">{row.type}</td>
                    <td className="px-4 py-2 text-xs text-gray-300 truncate max-w-xs">{row.subject ?? '–'}</td>
                    <td className="px-4 py-2 text-xs text-right text-gray-300">{row.recipient_count}</td>
                    <td className={`px-4 py-2 text-xs text-right font-semibold ${row.status === 'sent' ? 'text-green-400' : 'text-red-400'}`} title={row.error ?? ''}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const inputCls = 'px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 w-full'
const inputStyle = { background: '#1f2937', border: '1px solid #374151' }

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: '#111827', border: '1px solid #1f2937' }}>
      <h3 className="font-semibold text-white flex items-center gap-2">{icon}{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center">
      <label className="text-xs text-gray-400 sm:text-sm">{label}</label>
      <div>{children}</div>
    </div>
  )
}
