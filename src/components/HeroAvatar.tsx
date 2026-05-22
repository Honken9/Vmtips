'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'

interface Props {
  src: string
  alt: string
}

/** Hero-avataren på startsidan – klickbar för att visas i fullskärm. */
export function HeroAvatar({ src, alt }: Props) {
  const [lightbox, setLightbox] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setLightbox(true)}
        aria-label="Visa större bild"
        className="shrink-0 relative w-28 h-28 sm:w-36 sm:h-36 md:w-48 md:h-48 rounded-2xl overflow-hidden shadow-2xl cursor-zoom-in transition-transform hover:scale-105"
        style={{ border: '2px solid rgba(16,185,129,0.4)' }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 768px) 192px, (min-width: 640px) 144px, 112px"
          className="object-cover"
          priority
        />
      </button>

      {lightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 cursor-zoom-out"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Stor bild av ${alt}`}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Stäng"
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <X size={20} />
          </button>
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[90vh] max-w-[95vw] object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <div className="mt-3 text-white text-sm font-semibold">{alt}</div>
          </div>
        </div>
      )}
    </>
  )
}
