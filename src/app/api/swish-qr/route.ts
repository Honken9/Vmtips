import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Server-side proxy mot Swishs officiella QR-API. Kör server-side så
// vi slipper CORS och får den korrekta QR-formaten direkt från Swish.
// Endpoint: https://mpc.getswish.net/qrg-swish/api/v1/prefilled
//
// Autentisering: bara inloggade användare får generera QR-koder så att
// inte vem som helst använder vår route som gratis Swish-QR-tjänst.

// Edge runtime ger lägre latens men har inte tillgång till hela Supabase-
// SDK:n; vi använder default Node.js runtime så getUser() funkar.

interface SwishPrefilled {
  format: 'png' | 'jpg' | 'svg'
  size: number
  border: number
  transparent: boolean
  payee: { value: string; editable: boolean }
  amount?: { value: number; editable: boolean }
  message?: { value: string; editable: boolean }
}

function normalizePhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return '46' + digits.slice(1)
  if (digits.startsWith('46')) return digits
  return digits
}

function sanitizeMessage(msg: string): string {
  return msg
    .replace(/[–—]/g, '-') // em-/en-dash
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
}

export async function GET(req: NextRequest) {
  // Auth-check: bara inloggade användare
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const phone = normalizePhone(searchParams.get('phone') ?? '')
  const amountStr = searchParams.get('amount')
  const messageRaw = searchParams.get('message') ?? ''
  const sizeStr = searchParams.get('size') ?? '300'

  if (!phone) return new NextResponse('phone required', { status: 400 })

  const body: SwishPrefilled = {
    format: 'png',
    size: parseInt(sizeStr, 10) || 300,
    border: 0,
    transparent: false,
    payee: { value: phone, editable: false },
  }
  if (amountStr) {
    const amt = Number(amountStr)
    if (!isNaN(amt)) body.amount = { value: amt, editable: false }
  }
  if (messageRaw) {
    body.message = { value: sanitizeMessage(messageRaw), editable: false }
  }

  try {
    const res = await fetch('https://mpc.getswish.net/qrg-swish/api/v1/prefilled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return new NextResponse(`Swish QR API ${res.status}: ${text.slice(0, 200)}`, {
        status: 502,
      })
    }

    // Streama PNG-bytes tillbaka
    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    return new NextResponse(`Swish QR fetch failed: ${err instanceof Error ? err.message : 'unknown'}`, {
      status: 502,
    })
  }
}
