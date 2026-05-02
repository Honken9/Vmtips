'use client'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  byline?: string
}

export function TrophyLogo({ size = 'md', byline }: Props) {
  const sizes = { sm: 36, md: 56, lg: 88 }
  const px = sizes[size]

  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/vm2026-logo.avif"
        alt="FIFA World Cup 2026"
        width={px}
        height={px}
        className="shrink-0 object-contain"
        style={{ width: px, height: px }}
      />

      <div className="min-w-0">
        <div
          className={`font-black tracking-tight leading-none text-emerald-400 ${
            size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base'
          }`}
        >
          VM-TIPS
          {byline && (
            <span
              className="ml-2 align-baseline text-amber-400 font-script font-normal whitespace-nowrap"
              style={{
                fontSize: size === 'lg' ? '1.05em' : size === 'md' ? '1em' : '0.95em',
                letterSpacing: 0,
              }}
            >
              {byline}
            </span>
          )}
        </div>
        <div
          className={`text-gray-400 font-medium tracking-widest uppercase ${
            size === 'lg' ? 'text-sm mt-1' : 'text-xs mt-0.5'
          }`}
        >
          FIFA World Cup 2026
        </div>
      </div>
    </div>
  )
}
