import { createClient } from '@/lib/supabase/server'
import { Mail } from 'lucide-react'
import { EmailAdminClient } from './EmailAdminClient'

export const dynamic = 'force-dynamic'

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

export default async function AdminEmailPage() {
  const supabase = await createClient()
  const [{ data: settingsRaw }, { data: logRaw }] = await Promise.all([
    supabase.from('email_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('email_log').select('*').order('sent_at', { ascending: false }).limit(30),
  ])
  const settings = settingsRaw as EmailSettings | null
  const log = (logRaw ?? []) as LogRow[]

  if (!settings) {
    return (
      <div className="rounded-xl p-6 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
        email_settings-raden saknas. Kör <code>supabase/add_email.sql</code> i Supabase SQL Editor.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Mail size={22} className="text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Mejlutskick</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Påminnelser inför matcher och veckans digest. Kräver <code>RESEND_API_KEY</code> + verifierad sender-domän hos Resend.
          </p>
        </div>
      </div>

      <EmailAdminClient settings={settings} log={log} />
    </div>
  )
}
