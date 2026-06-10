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
 * Klient-side QR-rendering av Swishs egna QR-payload (C{phone};{amount};{message};{lock}).
 *
 * Tidigare gick QR:n via /api/swish-qr som proxade Swishs officiella
 * prefilled-API. Den API:n började returnera "Host not in allowlist" för
 * Vercels serverless-IP:er. Vi genererar koden lokalt istället – ingen
 * extern beroende, ingen auth, fungerar offline.
 *
 * Swish-appens skanner läser C-formatet och fyller i betalningsskärmen
 * identiskt som från den officiella API:n. Visuellt saknas Swish-logon
 * mitt i koden, men funktionen är densamma.
 */
export function SwishQrImage({ phone, amount, message, size = 240, className }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const payload = buildSwishQrPayload({ phone, amount, message })
    QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).then(url => {
      if (!cancelled) setDataUrl(url)
    }).catch(() => {
      if (!cancelled) setDataUrl(null)
    })
    return () => { cancelled = true }
  }, [phone, amount, message, size])

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, background: '#fff', borderRadius: 8 }}
        aria-label="Genererar QR-kod"
      />
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={dataUrl}
      alt="QR-kod till Swish-betalning"
      width={size}
      height={size}
      className={className}
    />
  )
}
