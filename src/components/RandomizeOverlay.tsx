'use client'

import { useEffect, useMemo, useState } from 'react'

const FOOTBALL_PHRASES = [
  '⚽ Skickar bollen till VAR…',
  '🎲 Konsulterar fotbollsgudarna…',
  '📊 Räknar oddsen i Las Vegas…',
  '🧤 Målvakten gör sig redo…',
  '🏟️ Fyller upp arenan med fans…',
  '⚽ Sliter på gräset…',
  '🥶 Frostfärsk gräsmatta…',
  '🎯 Sätter en frispark från 30 meter…',
  '🤔 Diskuterar med domaren…',
  '📺 Tittar på repris…',
  '🚑 Vinkar in sjukvårdarna…',
  '🍀 Ringer Zlatan för råd…',
  '🎤 Skriker GOOOOOOOOOAL!',
  '🔥 Stadion brinner!',
  '⚡ Kontringsläge aktiverat…',
  '💪 Spelarna laddar musklerna…',
  '🏃 Sprintar mot mållinjen…',
  '👀 Domarens blick blir kall…',
  '🟨 Gult kort utdelat (slumpmässigt)…',
  '🟥 Rött kort? Nej… eller jo!',
  '🎺 Vuvuzelan startar…',
  '🍻 Tar en paus med en alkoholfri…',
  '📐 Mäter offside med linjal…',
  '🐐 GOAT-läge på…',
  '🤡 Bonusspelaren kom in…',
  '🦵 Hamstring-test pågår…',
  '🎩 Drar fram resultaten ur hatten…',
  '✨ Magi händer just nu…',
  '🔮 Kristallkulan glöder…',
  '🥅 Justerar nätet…',
  '⏱️ Tilläggstid räknas…',
  '🚨 Övertidsalarm!',
  '🎯 Straffläggning förbereds…',
]

// Hårdkodat smeknamn för vanliga svenska förnamn. Saknas namnet i mappen
// faller vi tillbaka på ett deterministiskt "titel"-mönster.
const NICKNAME_MAP: Record<string, string> = {
  Daniel: 'Danne',
  David: 'Davve',
  Peter: 'Pelle',
  Per: 'Pelle',
  Erik: 'Erra',
  Anders: 'Andis',
  Johan: 'Janne',
  Lars: 'Lasse',
  Karl: 'Kalle',
  Carl: 'Calle',
  Thomas: 'Tomte',
  Tomas: 'Tomte',
  Mikael: 'Mickis',
  Niklas: 'Nicke',
  Andreas: 'Anders',
  Stefan: 'Steffe',
  Magnus: 'Mange',
  Alexander: 'Allan',
  Alex: 'Allan',
  Oskar: 'Osse',
  Oscar: 'Osse',
  Henrik: 'Hempa',
  Jonas: 'Jojje',
  Robert: 'Robban',
  Patrik: 'Patte',
  Gustav: 'Gugge',
  Joakim: 'Jocke',
  Filip: 'Fippe',
  Sebastian: 'Sebbe',
  Christian: 'Krille',
  Kristian: 'Krille',
  Marcus: 'Macke',
  Markus: 'Macke',
  Fredrik: 'Fredde',
  Martin: 'Matte',
  Anna: 'Anki',
  Maria: 'Mia',
  Katarina: 'Kattis',
  Kristina: 'Stina',
  Christina: 'Stina',
  Sofia: 'Soffan',
  Sara: 'Sarra',
  Emma: 'Emmis',
  Amanda: 'Mandis',
  Charlotte: 'Lotta',
  Hanna: 'Hannis',
  Demus: 'Demmel',
  Honken: 'Honkis',
}

function getFirstName(displayName: string): string {
  return (displayName || '').trim().split(/\s+/)[0] || ''
}

function getNickname(firstName: string): string {
  if (!firstName) return 'Mästaren'
  const cap = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  if (NICKNAME_MAP[cap]) return NICKNAME_MAP[cap]
  const patterns = [
    `Stor-${cap}`,
    `${cap}-Bagaren`,
    `Mästar-${cap}`,
    `Kung-${cap}`,
    `${cap} the Goat`,
    `${cap}-Magnetar`,
  ]
  // Deterministiskt val så samma namn ger samma smeknamn varje gång
  let h = 0
  for (let i = 0; i < firstName.length; i++) h = (h * 31 + firstName.charCodeAt(i)) | 0
  return patterns[Math.abs(h) % patterns.length]
}

function buildPersonalPhrases(firstName: string, nickname: string): string[] {
  if (!firstName) return []
  return [
    `🎯 ${firstName} fokuserar på en lyckoboll…`,
    `🤞 ${firstName} korsar fingrarna…`,
    `😱 ${firstName} blev plötsligt nervös…`,
    `🍀 ${firstName} hittar fyrklövern…`,
    `💪 ${firstName} kraftsamlar inför kvällens slag…`,
    `🔮 ${firstName} ser framtiden…`,
    `🐐 ${nickname} är i goalmode!`,
    `⚡ ${nickname} laddar med energi…`,
    `🎩 ${nickname} drar tipsen ur hatten…`,
    `🎲 ${nickname} kastar tärningen…`,
    `👑 ${nickname} härskar över bracketen!`,
    `🚀 ${nickname} skjuter iväg ett rocket-tips…`,
  ]
}

export function RandomizeOverlay({
  duration = 15000,
  customPhrases = [],
  displayName = '',
}: {
  duration?: number
  customPhrases?: string[]
  displayName?: string
}) {
  // Bygg personliga fraser från användarens förnamn + smeknamn
  const personalPhrases = useMemo(() => {
    const firstName = getFirstName(displayName)
    const nickname = getNickname(firstName)
    return buildPersonalPhrases(firstName, nickname)
  }, [displayName])

  // Slå ihop alla fraser. Anpassade och personliga visas oftare (viktning).
  const allPhrases = [
    ...FOOTBALL_PHRASES,
    ...customPhrases, ...customPhrases, ...customPhrases,
    ...personalPhrases, ...personalPhrases,
  ]
  const [phrase, setPhrase] = useState(allPhrases[0])
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Byt fras var 1.2 sek
    const phraseInterval = setInterval(() => {
      setPhrase(allPhrases[Math.floor(Math.random() * allPhrases.length)])
    }, 1200)

    // Animera progress-bar
    const start = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, (elapsed / duration) * 100)
      setProgress(pct)
      if (pct >= 100) clearInterval(progressInterval)
    }, 50)

    return () => {
      clearInterval(phraseInterval)
      clearInterval(progressInterval)
    }
  }, [duration])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div className="relative max-w-md w-full mx-4 rounded-2xl p-8 text-center"
        style={{
          background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
          border: '1px solid #374151',
          boxShadow: '0 0 60px rgba(16,185,129,0.3)',
        }}>
        {/* Animerad fotboll */}
        <div className="text-7xl mb-6 inline-block animate-bounce-football">
          ⚽
        </div>

        {/* Roterande fras */}
        <div className="min-h-[3.5rem] flex items-center justify-center mb-6">
          <p key={phrase} className="text-lg font-medium text-white animate-fade-in">
            {phrase}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 rounded-full overflow-hidden mb-3"
          style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div
            className="h-full transition-all duration-100 gold-gradient"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-xs text-gray-500">
          {progress < 30 && 'Tipsen tippas…'}
          {progress >= 30 && progress < 60 && 'Spänningen stiger…'}
          {progress >= 60 && progress < 90 && 'Domarpipan blåser snart…'}
          {progress >= 90 && 'GOOOOAL!!! 🎉'}
        </p>

        {/* Studsande prickar */}
        <div className="flex justify-center gap-2 mt-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce-dot" style={{ animationDelay: '0s' }} />
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce-dot" style={{ animationDelay: '0.15s' }} />
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce-dot" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-football {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-20px) rotate(180deg); }
          50% { transform: translateY(0) rotate(360deg); }
          75% { transform: translateY(-10px) rotate(540deg); }
        }
        .animate-bounce-football {
          animation: bounce-football 1.5s ease-in-out infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
        @keyframes bounce-dot {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
        .animate-bounce-dot {
          animation: bounce-dot 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
