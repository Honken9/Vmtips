'use client'

import { useEffect, useRef, useState } from 'react'
import { Music, X, Play, Pause, Volume2 } from 'lucide-react'

// Lokal m4a-fil i /public — undviker Spotify-konton, ingen tredjepart.
const AUDIO_SRC = '/vmlaten.m4a'

const STORAGE_KEY = 'vm-tips:music-dismissed'

export function MusicToggle() {
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Försök auto-spela direkt vid mount. Webbläsare blockerar autoplay utan
  // user-interaction, så vi förbereder elementet och låter användaren klicka
  // play om webbläsaren stoppade oss.
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(STORAGE_KEY) === '1'
      if (!dismissed) setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [])

  // När spelaren öppnas: försök autoplay med max-volym
  useEffect(() => {
    if (!open) return
    const audio = audioRef.current
    if (!audio) return
    audio.volume = 1.0
    audio.loop = true
    const tryPlay = async () => {
      try {
        await audio.play()
        setPlaying(true)
      } catch {
        // Autoplay blockerad — användaren måste klicka play-knappen
        setPlaying(false)
      }
    }
    tryPlay()
  }, [open])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.volume = 1.0
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  function close() {
    const audio = audioRef.current
    if (audio) audio.pause()
    setPlaying(false)
    setOpen(false)
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {}
  }

  return (
    <>
      {/* Audio-elementet renderas alltid — så det är redo att spela direkt
          när play-knappen klickas. Inget UI direkt från elementet. */}
      <audio
        ref={audioRef}
        src={AUDIO_SRC}
        preload="auto"
        loop
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

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
          className="fixed bottom-4 right-4 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden shadow-2xl"
          style={{ background: '#0b1320', border: '1px solid #334155' }}
        >
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ background: '#14202e', borderBottom: '1px solid #1f2937' }}
          >
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
              <Music size={12} />
              VM-låten
            </span>
            <button
              onClick={close}
              className="text-gray-400 hover:text-white"
              aria-label="Stäng spelare"
            >
              <X size={14} />
            </button>
          </div>
          <div className="px-4 py-4 flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#0b1320',
              }}
              aria-label={playing ? 'Pausa' : 'Spela'}
            >
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                Vi gräver guld i USA
              </div>
              <div className="text-[11px] text-gray-500 flex items-center gap-1">
                <Volume2 size={10} />
                {playing ? 'Spelar – loopar' : 'Klicka för att spela'}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
