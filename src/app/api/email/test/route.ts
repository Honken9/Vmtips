// Skicka test-mejl till en angiven adress – för admin att verifiera setup
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, wrapEmailHtml, logEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) return NextResponse.json({ error: 'admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const to = body.to as string | undefined
  if (!to || !to.includes('@')) return NextResponse.json({ error: 'Ange en giltig e-postadress' }, { status: 400 })

  const subject = 'Test-mejl från VM-Tips 2026'
  const html = wrapEmailHtml(subject, `
    <h1 style="margin:0 0 12px;font-size:20px;color:#fff;">Det här är ett test-mejl 📧</h1>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;">
      Kommer mejlet fram betyder det att Resend-integration, sender-domän och
      DNS-records är korrekt uppsatta. Du är redo att skicka påminnelser och digest.
    </p>
    <p style="color:#9ca3af;font-size:13px;">
      Mejlet skickades manuellt från admin-panelen.
    </p>
  `)

  const result = await sendEmail({ to: [to], subject, html })
  await logEmail('test', 1, subject, result.ok ? 'sent' : 'error', null, result.error ?? null)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
