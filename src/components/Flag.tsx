'use client'

// Renderar en landsflagga som bild (FlagCDN) med emoji-fallback.
// Löser att Windows Chrome inte ritar flagg-emojis.

interface Props {
  emoji: string | null | undefined
  name?: string
  className?: string
  width?: number
  height?: number
}

const ISO_OVERRIDES: Record<string, string> = {
  // Specialfall där emoji-tolkningen blir fel eller saknas
  // (t.ex. England 🏴󠁧󠁢󠁥󠁮󠁧󠁿 är tag-baserad, inte regional indicator)
}

function flagEmojiToIso2(flagEmoji: string | null | undefined): string | null {
  if (!flagEmoji) return null
  const cps: number[] = []
  for (const ch of flagEmoji) {
    const cp = ch.codePointAt(0)
    if (cp != null) cps.push(cp)
  }
  // Standard regional-indicator-flagga: två tecken i U+1F1E6 – U+1F1FF
  const RI_BASE = 0x1f1e6
  if (cps.length === 2 && cps.every(cp => cp >= RI_BASE && cp <= 0x1f1ff)) {
    const a = String.fromCharCode(0x41 + (cps[0] - RI_BASE))
    const b = String.fromCharCode(0x41 + (cps[1] - RI_BASE))
    return (a + b).toLowerCase()
  }
  return null
}

export function Flag({ emoji, name, className = '', width = 24, height = 18 }: Props) {
  if (!emoji) return null

  const iso = ISO_OVERRIDES[emoji] ?? flagEmojiToIso2(emoji)
  if (!iso) {
    // Fallback för icke-ISO-flaggor (t.ex. tag-baserade) – emoji
    return <span className={className}>{emoji}</span>
  }

  // FlagCDN: 80x60 räcker för crisp på alla rimliga storlekar
  const url = `https://flagcdn.com/w80/${iso}.png`
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={name ?? iso.toUpperCase()}
      width={width}
      height={height}
      loading="lazy"
      className={`inline-block object-cover rounded-sm ${className}`}
      style={{ width, height }}
    />
  )
}
