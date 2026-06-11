'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { buildSwishQrPayload } from '@/lib/swish'

interface Props {
  phone: string
  amount: number
  message?: string
  size?: number
  className?: string
}

/**
 * Klient-side QR-rendering av Swishs officiella C-format-payload
 * (C{phone};{amount};{message};{editable}). Det är den dokumenterade
 * QR-format Swish-appen läser och förfyller betalningen från.
 *
 * Källa: github.com/lindskogen/swish-qr-format, motsvarar det officiella
 * Swish "Prefilled QR Code"-formatet (Type C). Samma payload som tidigare
 * gick via mpc.getswish.net-API:n.
 *
 * VIKTIGT: Skanna med Swish-appens egen skanner – inte kamera-appen.
 * Kameran ser bara textsträngen "C46701...;100;..." och vet inte vad
 * den ska göra med den. Swish-appens skanner förstår C-formatet och
 * öppnar betalningsskärmen förfylld.
 *
 * SVG istället för canvas/dataURL – vektor, inget canvas-beroende, mer
 * pålitligt på äldre iOS-versioner.
 */
export function SwishQrImage({ phone, amount, message, size = 240, className }: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    const payload = buildSwishQrPayload({ phone, amount, message })
    QRCode.toString(payload, {
      type: 'svg',
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(s => { if (!cancelled) setSvg(s) })
      .catch(err => {
        if (!cancelled) {
          setSvg(null)
          setError(err instanceof Error ? err.message : 'Kunde inte skapa QR-kod')
        }
      })
    return () => { cancelled = true }
  }, [phone, amount, message, size])

  if (error) {
    return (
      <div
        className={className}
        style={{
          width: size, height: size, background: '#fff', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 12, textAlign: 'center', color: '#b91c1c', fontSize: 12,
        }}
      >
        QR-koden kunde inte genereras: {error}
      </div>
    )
  }

  if (!svg) {
    return (
      <div
        className={className}
        style={{
          width: size, height: size, background: '#fff', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#6b7280', fontSize: 12,
        }}
        aria-label="Genererar QR-kod"
      >
        Genererar QR-kod…
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      aria-label="QR-kod till Swish-betalning"
      // SVG-strängen kommer från qrcode-paketet (vår egen Swish-payload som input).
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
