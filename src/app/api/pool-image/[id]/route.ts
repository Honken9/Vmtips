// Upload + delete för liga-bild. Ägare av poolen eller admin har access.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

async function canEditPool(poolId: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'auth' }

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (profile?.is_admin === true) return { ok: true }

  const { data: pool } = await supabase.from('pools').select('created_by').eq('id', poolId).maybeSingle()
  if ((pool as { created_by?: string | null } | null)?.created_by === user.id) return { ok: true }

  return { ok: false, status: 403, error: 'Bara liga-ägare eller admin kan ändra liga-bild' }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const poolId = Number(id)
  if (!Number.isInteger(poolId)) return NextResponse.json({ error: 'Ogiltigt liga-id' }, { status: 400 })

  const auth = await canEditPool(poolId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const form = await req.formData()
  const file = form.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'Ingen fil' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Bilden är för stor (max 5 MB)' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Bara JPG/PNG/WEBP/GIF' }, { status: 400 })

  const ext = file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : file.type === 'image/gif' ? 'gif' : 'jpg'
  const path = `pools/${poolId}.${ext}`

  const admin = createAdminClient()
  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from('profile-images')
    .upload(path, bytes, { contentType: file.type, upsert: true })
  if (upErr) {
    return NextResponse.json({ error: `Kunde inte spara: ${upErr.message}` }, { status: 500 })
  }

  const { data: pub } = admin.storage.from('profile-images').getPublicUrl(path)
  const url = `${pub.publicUrl}?t=${Date.now()}`

  const { error: updErr } = await admin.from('pools').update({ image_url: url }).eq('id', poolId)
  if (updErr) {
    return NextResponse.json({ error: `Kunde inte uppdatera: ${updErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, url })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const poolId = Number(id)
  if (!Number.isInteger(poolId)) return NextResponse.json({ error: 'Ogiltigt liga-id' }, { status: 400 })

  const auth = await canEditPool(poolId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()
  // Best-effort: ta bort alla varianter av filen (extensionen varierar)
  await admin.storage.from('profile-images').remove([
    `pools/${poolId}.jpg`, `pools/${poolId}.png`, `pools/${poolId}.webp`, `pools/${poolId}.gif`,
  ])
  const { error } = await admin.from('pools').update({ image_url: null }).eq('id', poolId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
