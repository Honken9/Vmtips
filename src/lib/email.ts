// Mailutskick via Brevo (gratis 300 mejl/dag, obegränsat antal domäner).
// Behöver BREVO_API_KEY i Vercel/.env.local och en verifierad domän hos Brevo
// som matchar sender_email i email_settings.

import { createAdminClient } from './supabase/admin'

export interface EmailSettings {
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

export interface SendArgs {
  to: string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export async function getEmailSettings(): Promise<EmailSettings | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('email_settings').select('*').eq('id', 1).maybeSingle()
  return (data as EmailSettings | null) ?? null
}

export async function logEmail(
  type: 'reminder' | 'digest' | 'test',
  recipientCount: number,
  subject: string,
  status: 'sent' | 'error',
  poolId: number | null = null,
  error: string | null = null
) {
  const admin = createAdminClient()
  await admin.from('email_log').insert({
    type,
    pool_id: poolId,
    subject,
    recipient_count: recipientCount,
    status,
    error,
  })
}

interface BrevoError {
  message?: string
  code?: string
}

/**
 * Skicka via Brevo. Mottagare batchas i grupper om 90 (Brevo-gräns är 99
 * inkl to/cc/bcc – vi har 1 to + 90 bcc). Varje batch blir ett mejl med
 * avsändar-adressen som "to" och alla riktiga mottagare som BCC, så de
 * inte ser varandras adresser.
 */
export async function sendEmail(args: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'BREVO_API_KEY saknas i miljövariabler' }
  }
  const settings = await getEmailSettings()
  if (!settings) {
    return { ok: false, error: 'email_settings-raden saknas i databasen' }
  }

  const BATCH = 90
  for (let i = 0; i < args.to.length; i += BATCH) {
    const batch = args.to.slice(i, i + BATCH)
    const body = {
      sender: { name: settings.sender_name, email: settings.sender_email },
      to: [{ email: settings.sender_email, name: settings.sender_name }],
      bcc: batch.map(email => ({ email })),
      subject: args.subject,
      htmlContent: args.html,
      ...(args.text ? { textContent: args.text } : {}),
      ...(args.replyTo ? { replyTo: { email: args.replyTo } } : {}),
    }
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      let detail = ''
      try {
        const err = (await res.json()) as BrevoError
        detail = err.message ?? err.code ?? ''
      } catch {
        detail = await res.text().catch(() => '')
      }
      return { ok: false, error: `Brevo ${res.status}: ${detail || res.statusText}` }
    }
  }
  return { ok: true }
}

/** Plocka mottagar-mejl för en uppsättning user-id:n, filtrerat på opt-in. */
export async function recipientsFor(
  userIds: string[],
  type: 'reminder' | 'digest'
): Promise<{ user_id: string; email: string }[]> {
  if (userIds.length === 0) return []
  const admin = createAdminClient()

  const { data: prefs } = await admin
    .from('email_preferences')
    .select('user_id, match_reminders, weekly_digest')
    .in('user_id', userIds)
  const optedOut = new Set<string>()
  for (const p of (prefs ?? []) as { user_id: string; match_reminders: boolean; weekly_digest: boolean }[]) {
    if (type === 'reminder' && p.match_reminders === false) optedOut.add(p.user_id)
    if (type === 'digest' && p.weekly_digest === false) optedOut.add(p.user_id)
  }

  const out: { user_id: string; email: string }[] = []
  for (const uid of userIds) {
    if (optedOut.has(uid)) continue
    try {
      const { data } = await admin.auth.admin.getUserById(uid)
      const email = data?.user?.email
      if (email) out.push({ user_id: uid, email })
    } catch {
      // skippa users som inte gick att läsa
    }
  }
  return out
}

/** Bygg en enkel HTML-mall med VM-Tips header + footer + opt-out-länk. */
export function wrapEmailHtml(title: string, bodyHtml: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tippavm2026.se'
  return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e7eb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0e1a;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0c2823 0%,#14202e 50%,#0a3d2a 100%);padding:24px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#fbbf24;letter-spacing:0.5px;">⚽ VM-TIPS 2026</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px;">by Alex och Daniel</div>
        </td></tr>
        <tr><td style="padding:28px;color:#e5e7eb;font-size:15px;line-height:1.55;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px;background:#0f172a;border-top:1px solid #1f2937;text-align:center;font-size:11px;color:#6b7280;">
          <a href="${baseUrl}" style="color:#10b981;text-decoration:none;">tippavm2026.se</a>
          &nbsp;·&nbsp;
          <a href="${baseUrl}/profil" style="color:#9ca3af;text-decoration:underline;">Avregistrera mejl</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
