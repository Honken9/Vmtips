'use client'

import { useEffect, useState } from 'react'
import { Music, X } from 'lucide-react'

const SPOTIFY_EMBED =
  'https://open.spotify.com/embed/album/6SVY7GMw6KZxOSduyXSeoi?utm_source=generator&theme=0&autoplay=1'

const STORAGE_KEY = 'vm-tips:music-dismissed'

export function MusicToggle() {
  // Hydration-säkert: börja stängt, öppna efter mount om användaren
  // inte stängt den tidigare i denna session.
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(STORAGE_KEY) === '1'
      if (!dismissed) setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [])

  function close() {
    setOpen(false)
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {}
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Spela VM-musik"
          title="VM-musik"
          className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110"
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#0b1320',
          }}
        >
          <Music size={20} />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden shadow-2xl"
          style={{ background: '#0b1320', border: '1px solid #334155' }}
        >
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ background: '#14202e', borderBottom: '1px solid #1f2937' }}
          >
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
              <Music size={12} />
              VM-musik
            </span>
            <button
              onClick={close}
              className="text-gray-400 hover:text-white"
              aria-label="Stäng spelare"
            >
              <X size={14} />
            </button>
          </div>
          <iframe
            src={SPOTIFY_EMBED}
            width="100%"
            height="380"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="eager"
            style={{ border: 0, display: 'block' }}
            title="Spotify – VM-musik"
          />
        </div>
      )}
    </>
  )
}
