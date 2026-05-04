// Hjälpare för Swish-djuplänkar och QR-koder.
//
// Swish accepterar betalningslänkar via standard URL-schema som öppnar
// Swish-appen direkt på mobil. På desktop får användaren skanna QR-koden.

export function normalizeSwishPhone(input: string): string {
  // Ta bort allt utom siffror
  const digits = (input || '').replace(/\D/g, '')
  if (!digits) return ''
  // 0701234567 → 46701234567 (Swish vill ha landskod utan +)
  if (digits.startsWith('0')) return '46' + digits.slice(1)
  if (digits.startsWith('46')) return digits
  return digits
}

export function buildSwishUrl(args: {
  phone: string
  amount: number
  message?: string
}): string {
  const sw = normalizeSwishPhone(args.phone)
  const params = new URLSearchParams()
  params.set('sw', sw)
  params.set('amt', String(args.amount))
  params.set('cur', 'SEK')
  if (args.message) params.set('msg', args.message)
  // app.swish.nu fungerar både på iOS, Android och faller tillbaka
  // till en informationssida på desktop.
  return `https://app.swish.nu/1/p/sw/?${params.toString()}`
}

export function buildSwishQrUrl(swishUrl: string, size = 200): string {
  // Använder goqr.me:s gratis QR-API – server-side QR utan dependencies.
  const encoded = encodeURIComponent(swishUrl)
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encoded}&size=${size}x${size}&margin=8&color=10b981&bgcolor=0b1320`
}

export function isValidSwishPhone(input: string): boolean {
  const d = normalizeSwishPhone(input)
  // Svenska mobilnummer: 4670... – 4679..., totalt 11 siffror
  return /^467\d{8}$/.test(d)
}
