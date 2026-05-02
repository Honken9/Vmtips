'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface Props {
  targetIso: string
  homeName?: string
  awayName?: string
  homeFlag?: string
  awayFlag?: string
}

function diffParts(targetMs: number, now: number) {
  const diff = Math.max(0, targetMs - now)
  return {
    diff,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  }
}

export function MatchCountdown({ targetIso, homeName, awayName, homeFlag, awayFlag }: Props) {
  const targetMs = new Date(targetIso).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { diff, days, hours, minutes, seconds } = diffParts(targetMs, now)

  if (diff <= 0) return null

  return (
    <div
      className="rounded-2xl px-4 sm:px-6 py-5 sm:py-6"
      style={{
        background: 'linear-gradient(135deg, #0f3460 0%, #16213e 50%, #1a1a2e 100%)',
        border: '1px solid #1f2937',
      }}
    >
      <div className="flex items-center gap-2 text-amber-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-3">
        <Clock size={14} />
        <span>Nedräkning till första matchen</span>
      </div>

      {(homeName || awayName) && (
        <div className="text-white text-sm sm:text-base mb-3 truncate" suppressHydrationWarning>
          {homeFlag && <span className="mr-1">{homeFlag}</span>}
          <span className="font-medium">{homeName ?? '?'}</span>
          <span className="mx-2 text-gray-500">vs</span>
          <span className="font-medium">{awayName ?? '?'}</span>
          {awayFlag && <span className="ml-1">{awayFlag}</span>}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 sm:gap-4" suppressHydrationWarning>
        <Cell value={days} label="Dagar" />
        <Cell value={hours} label="Timmar" />
        <Cell value={minutes} label="Min" />
        <Cell value={seconds} label="Sek" />
      </div>
    </div>
  )
}

function Cell({ value, label }: { value: number; label: string }) {
  const padded = value.toString().padStart(2, '0')
  return (
    <div
      className="rounded-xl py-3 sm:py-4 text-center"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="text-2xl sm:text-4xl font-bold text-white tabular-nums">{padded}</div>
      <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  )
}
