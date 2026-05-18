'use client'

interface Props {
  size?: 'sm' | 'md' | 'lg'
}

export function TrophyLogo({ size = 'md' }: Props) {
  const sizes = { sm: 36, md: 56, lg: 88 }
  const px = sizes[size]
  const wordmarkClass =
    size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base'
  const bylineFontSize =
    size === 'lg' ? '1.6em' : size === 'md' ? '1.5em' : '1.4em'
  const subtitleClass =
    size === 'lg' ? 'text-sm mt-1' : 'text-xs mt-1'

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
        {/* På sm (navbar): stapla byline under för att aldrig klippa "Daniel".
            På md/lg: inline bredvid VM-TIPS. */}
        <div
          className={`flex gap-x-2 ${
            size === 'sm' ? 'flex-col gap-y-0' : 'flex-row items-baseline'
          } ${wordmarkClass}`}
        >
          <span className="font-black tracking-tight text-emerald-400 leading-tight">
            VM-TIPS
          </span>
          <span
            className="text-amber-400 font-script font-normal whitespace-nowrap"
            style={{
              letterSpacing: 0,
              fontSize: bylineFontSize,
              lineHeight: size === 'sm' ? 1 : 1.1,
              paddingBlock: '0.05em',
            }}
          >
            by Alex och Daniel
          </span>
        </div>
        {size !== 'sm' && (
          <div
            className={`text-gray-400 font-medium tracking-widest uppercase leading-tight ${subtitleClass}`}
          >
            FIFA World Cup 2026
          </div>
        )}
      </div>
    </div>
  )
}
