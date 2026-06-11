'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { buildSwishUrl } from '@/lib/swish'

interface Props {
  phone: string
  amount: number
  message?: string
  size?: number
  className?: string
}

/**
 * Klient-side QR-rendering av Swishs Universal Link
 * (https://app.swish.nu/1/p/sw/?...). Den läses av både Swish-appens egen
 * skanner OCH kamera-appen på iOS/Android, och öppnar betalningsskärmen
 * förfylld.
 *
 * Vi körde tidigare Swishs C-format-payload (C{phone};{amount};{message};{lock})
 * men det visade sig att vissa Swish-app-versioner inte plockade upp det
 * från QR-skannern. Universal Link funkar överallt.
 *
 * SVG-rendering används istället för canvas/dataURL eftersom SVG är
 * vektorbaserat och inte beroende av canvas-API:t (vissa iOS-versioner
 * råkar ut för canvas-begränsningar).
 */
export function SwishQrImage({ phone, amount, message, size = 240, className }: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    const url = buildSwishUrl({ phone, amount, message: message ?? '' })
    QRCode.toString(url, {
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
      // SVG från qrcode-paketet – innehåller bara <svg>...</svg>, säkert att
      // dangerously sätta in eftersom payload:en är vår egen Swish-URL.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
