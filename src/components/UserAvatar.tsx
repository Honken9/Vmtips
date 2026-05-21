'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'

const SIZE_PX: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
}

const SIZE_CLASS: Record<string, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserAvatar({
  src,
  name,
  size = 'sm',
  className = '',
}: {
  src?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const [lightbox, setLightbox] = useState(false)
  const px = SIZE_PX[size]
  const cls = SIZE_CLASS[size]

  // Klick på avataren → öppna lightbox utan att trigga föräldra-Link
  function handleClick(e: React.MouseEvent) {
    if (!src) return
    e.preventDefault()
    e.stopPropagation()
    setLightbox(true)
  }

  function closeLightbox() {
    setLightbox(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!src}
        aria-label={src ? `Visa större bild av ${name}` : name}
        className={`relative shrink-0 rounded-full overflow-hidden ${cls} ${className} ${src ? 'cursor-zoom-in hover:ring-2 hover:ring-emerald-400/40 transition-shadow' : 'cursor-default'}`}
        style={{ background: '#1f2937', border: '1px solid #374151' }}
      >
        {src ? (
          <Image src={src} alt={name} fill sizes={`${px}px`} className="object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {initialsOf(name)}
          </div>
        )}
      </button>

      {lightbox && src && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 cursor-zoom-out"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`Stor bild av ${name}`}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Stäng"
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <X size={20} />
          </button>
          <div className="relative max-h-[95vh] max-w-[95vw] aspect-[3/4] flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={name}
              className="max-h-[90vh] max-w-[95vw] object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <div className="mt-3 text-white text-sm font-semibold">{name}</div>
          </div>
        </div>
      )}
    </>
  )
}
