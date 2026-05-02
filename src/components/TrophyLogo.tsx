'use client'

import Image from 'next/image'

export function TrophyLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 36, md: 56, lg: 88 }
  const px = sizes[size]

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: px, height: px }}>
        <Image
          src="/vm2026-logo.avif"
          alt="FIFA World Cup 2026"
          fill
          sizes={`${px}px`}
          priority={size === 'lg'}
          className="object-contain"
        />
      </div>

      <div>
        <div
          className={`font-black tracking-tight leading-none text-emerald-400 ${
            size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base'
          }`}
        >
          VM-TIPS
        </div>
        <div
          className={`text-gray-400 font-medium tracking-widest uppercase ${
            size === 'lg' ? 'text-sm' : 'text-xs'
          }`}
        >
          FIFA World Cup 2026
        </div>
      </div>
    </div>
  )
}
