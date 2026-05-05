// Hjälpare för Swish-djuplänkar och QR-koder.
//
// Swish accepterar betalningslänkar via två format:
//   1. https://app.swish.nu/1/p/sw/?... — Universal Link, öppnar Swish-appen
//      när man klickar i webbläsaren på mobilen
//   2. swish://payment?data={JSON} — native scheme, det Swish-appens egen
//      QR-skanner förväntar sig och auto-fyller betalningen från
//
// QR-koden får #2 så att Swish-appens scanner förstår den. Klick-knappen
// får #1 så desktop-användare kan klicka och bli redirectade.

export function normalizeSwishPhone(input: string): string {
  // Ta bort allt utom siffror
  const digits = (input || '').replace(/\D/g, '')
  if (!digits) return ''
  // 0701234567 → 46701234567 (Swish vill ha landskod utan +)
  if (digits.startsWith('0')) return '46' + digits.slice(1)
  if (digits.startsWith('46')) return digits
  return digits
}

// Swish-meddelandet får inte innehålla vissa specialtecken.
// Vi byter ut em-/en-dash mot vanligt bindestreck och begränsar till 50 tecken
// (Swishs max är 50). Behåller åäö och svenska bokstäver — de hanteras OK.
function sanitizeSwishMessage(msg: string): string {
  return msg
    .replace(/[–—]/g, '-') // em-dash, en-dash → -
    .replace(/[‘’]/g, "'") // smart quotes → '
    .replace(/[“”]/g, '"') // smart double quotes → "
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)
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
  if (args.message) params.set('msg', sanitizeSwishMessage(args.message))
  // app.swish.nu fungerar både på iOS, Android och faller tillbaka
  // till en informationssida på desktop.
  return `https://app.swish.nu/1/p/sw/?${params.toString()}`
}

// QR-payload som Swish-appens egen scanner känner igen — JSON enligt
// Swish-protokollet, transporterat via swish:// custom scheme.
export function buildSwishQrPayload(args: {
  phone: string
  amount: number
  message?: string
}): string {
  const data = {
    version: 1,
    payee: { value: normalizeSwishPhone(args.phone), editable: false },
    amount: { value: args.amount, editable: false },
    message: { value: args.message ? sanitizeSwishMessage(args.message) : '', editable: true },
  }
  return `swish://payment?data=${encodeURIComponent(JSON.stringify(data))}`
}

export function buildSwishQrUrl(swishOrPayload: string, size = 200): string {
  // Använder goqr.me:s gratis QR-API – server-side QR utan dependencies.
  // Svart på vit för universell scanbarhet (Swish-appens skanner och iOS/Android-kameror
  // kräver mörk-på-ljus kontrast — färgade/inverterade QR är opålitliga). qzone=2 ger
  // tillräcklig "quiet zone" runt koden så scannern hittar den.
  const encoded = encodeURIComponent(swishOrPayload)
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encoded}&size=${size}x${size}&qzone=2&ecc=M&format=png`
}

export function isValidSwishPhone(input: string): boolean {
  const d = normalizeSwishPhone(input)
  // Svenska mobilnummer: 4670... – 4679..., totalt 11 siffror
  return /^467\d{8}$/.test(d)
}
