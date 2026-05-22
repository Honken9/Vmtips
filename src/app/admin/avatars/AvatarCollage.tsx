'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'

interface AvatarItem {
  id: string
  name: string
  url: string
}

export function AvatarCollage({ avatars }: { avatars: AvatarItem[] }) {
  const [lightbox, setLightbox] = useState<AvatarItem | null>(null)

  return (
    <>
      {/* Collage – tätt rutnät, helkropps-avatarer i 3:4 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        {avatars.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setLightbox(a)}
            className="group relative aspect-[3/4] rounded-xl overflow-hidden cursor-zoom-in"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
            aria-label={`Visa ${a.name} i fullskärm`}
          >
            <Image
              src={a.url}
              alt={a.name}
              fill
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
            <div
              className="absolute bottom-0 left-0 right-0 px-2 py-1.5 text-xs font-semibold text-white truncate"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}
            >
              {a.name}
            </div>
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 cursor-zoom-out"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Stor bild av ${lightbox.name}`}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Stäng"
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <X size={20} />
          </button>
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="max-h-[90vh] max-w-[95vw] object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <div className="mt-3 text-white text-sm font-semibold">{lightbox.name}</div>
          </div>
        </div>
      )}
    </>
  )
}
