import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, logEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Låser ALLA deltagares tips nu och skickar ett sista-chansen-mail till
// dem som inte hade lämnat in. Mailet förklarar att tipsen låstes med det
// som var ifyllt, och att de kan höra av sig till admin för en sista
// upplåsning (admin använder "Lås upp"-knappen i /admin/users).
//
// Endast master admin. Kör i ordningen: samla icke-inlämnade → maila →
// lås. Om mailet failar låser vi ÄNDÅ (låsningen är huvudsyftet) men
// rapporterar mailfelet i svaret.

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 })

  const { data: meProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!meProfile?.is_admin) {
    return NextResponse.json({ error: 'Endast admin' }, { status: 403 })
  }

  const admin = createAdminClient()

  // 1) Hitta alla som inte lämnat in + antal tippade matcher per person
  const [{ data: notSubmittedRaw }, { count: totalMatches }, { data: predCountsRaw }] =
    await Promise.all([
      admin.from('profiles').select('id, display_name').eq('tips_locked', false),
      admin.from('matches').select('id', { count: 'exact', head: true }),
      admin.from('predictions').select('user_id'),
    ])

  const notSubmitted = (notSubmittedRaw ?? []) as { id: string; display_name: string }[]
  const predCountByUser = new Map<string, number>()
  for (const p of (predCountsRaw ?? []) as { user_id: string }[]) {
    predCountByUser.set(p.user_id, (predCountByUser.get(p.user_id) ?? 0) + 1)
  }

  // 2) Hämta email-adresser via auth (viktigt meddelande – ingen opt-out-filtrering)
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map<string, string>(
    (authList?.users ?? []).map(u => [u.id, u.email ?? ''])
  )
  const recipients = notSubmitted
    .map(p => emailById.get(p.id) ?? '')
    .filter(e => e.length > 0)

  // 3) Skicka sista-chansen-mailet (innan låsning så texten stämmer)
  let emailResult: { ok: boolean; error?: string } = { ok: true }
  if (recipients.length > 0) {
    const total = totalMatches ?? 104
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color:#0a3d2a;">⚽ Dina VM-tips är nu låsta</h2>
        <p>Hej!</p>
        <p>
          VM är igång och vi har nu låst alla tips för att tabellen ska vara
          rättvis. <strong>Du hade inte hunnit lämna in</strong>, så dina tips
          låstes med det som var ifyllt.
        </p>
        <p>
          <strong>Vill du komplettera? Du får en sista chans.</strong><br/>
          Svara på det här mailet så låser vi upp dig så att du kan tippa
          färdigt resterande matcher. Matcher som redan spelats går inte att
          tippa i efterhand.
        </p>
        <p>
          <a href="https://tippavm2026.se/tips"
             style="display:inline-block;background:#10b981;color:#000;font-weight:bold;padding:10px 20px;border-radius:8px;text-decoration:none;">
            Till mina tips
          </a>
        </p>
        <p style="color:#666;font-size:13px;">
          Ju tidigare du hör av dig desto fler matcher hinner du tippa –
          poäng räknas bara på matcher som tippats innan avspark.
        </p>
      </div>
    `
    emailResult = await sendEmail({
      to: recipients,
      subject: 'Sista chansen – dina VM-tips är nu låsta',
      html,
    })
    await logEmail(
      'last-chance-lock',
      recipients.length,
      'Sista chansen – dina VM-tips är nu låsta',
      emailResult.ok ? 'sent' : 'error',
      null,
      emailResult.error ?? null
    )
  }

  // 4) Lås allt: profiler + alla olåsta predictions.
  //    Service-role → prevent_late_predictions-triggern släpper igenom,
  //    och UPDATE:n rör ändå inte pred_home/pred_away.
  const { error: profErr } = await admin
    .from('profiles')
    .update({ tips_locked: true, tips_locked_at: new Date().toISOString() })
    .eq('tips_locked', false)
  if (profErr) {
    return NextResponse.json(
      { error: `Kunde inte låsa profiler: ${profErr.message}` },
      { status: 500 }
    )
  }

  const { error: predErr } = await admin
    .from('predictions')
    .update({ locked: true, locked_at: new Date().toISOString() })
    .eq('locked', false)
  if (predErr) {
    return NextResponse.json(
      { error: `Profiler låsta men kunde inte låsa tips: ${predErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    lockedProfiles: notSubmitted.length,
    emailed: recipients.length,
    emailOk: emailResult.ok,
    emailError: emailResult.error ?? null,
    notSubmittedNames: notSubmitted.map(p => p.display_name).sort(),
  })
}
