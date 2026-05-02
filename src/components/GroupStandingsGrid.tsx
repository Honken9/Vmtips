'use client'

import { StandingsRow } from '@/lib/standings'

interface Props {
  standings: Record<string, StandingsRow[]>
  best8ThirdIds: Set<number>
}

const GROUPS = 'ABCDEFGHIJKL'.split('')

export function GroupStandingsGrid({ standings, best8ThirdIds }: Props) {
  const hasAnyTips = Object.values(standings).some(rows => rows.some(r => r.played > 0))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Grupptabeller</h2>
          <p className="text-xs text-gray-500 mt-0.5">Baserat på dina tips · uppdateras live</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(34,197,94,0.3)' }} />
            Vidare (top 2)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(16,185,129,0.3)' }} />
            Bästa trea
          </span>
        </div>
      </div>

      {!hasAnyTips && (
        <div className="text-center py-8 text-gray-500 text-sm rounded-xl" style={{ border: '1px dashed #1f2937' }}>
          Tippa gruppspelsmatcherna ovan så beräknas tabellerna automatiskt
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {GROUPS.map(g => {
          const rows = standings[g]
          if (!rows?.length) return null
          const tipped = rows.reduce((s, r) => s + r.played, 0) / 2 // antal spelade matcher

          return (
            <div key={g} className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
              {/* Header */}
              <div className="px-4 py-2.5 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg, #1f2937, #1a1a2e)' }}>
                <span className="font-bold text-emerald-400">Grupp {g}</span>
                <span className="text-xs text-gray-500">{tipped}/6 matcher</span>
              </div>

              {/* Kolumnrubriker */}
              <div className="px-3 py-1 text-xs text-gray-600 flex" style={{ background: '#0f172a' }}>
                <span className="w-5 shrink-0" />
                <span className="flex-1">Lag</span>
                <span className="w-6 text-center">S</span>
                <span className="w-6 text-center">V</span>
                <span className="w-6 text-center">O</span>
                <span className="w-6 text-center">F</span>
                <span className="w-8 text-center">M</span>
                <span className="w-8 text-center">+/-</span>
                <span className="w-7 text-center font-semibold text-gray-500">P</span>
              </div>

              {/* Rader */}
              {rows.map((row, i) => {
                const advances = i < 2
                const isBestThird = i === 2 && best8ThirdIds.has(row.team.id)
                const bg = advances ? 'rgba(34,197,94,0.07)' : isBestThird ? 'rgba(16,185,129,0.07)' : 'transparent'
                const posColor = advances ? '#22c55e' : isBestThird ? '#10b981' : '#4b5563'

                return (
                  <div key={row.team.id}
                    className="px-3 py-2 flex items-center text-sm border-t"
                    style={{ borderColor: '#1f2937', background: bg }}>
                    <span className="w-5 shrink-0 text-xs font-bold" style={{ color: posColor }}>{i + 1}</span>
                    <div className="flex-1 flex items-center gap-1.5 min-w-0">
                      <span className="shrink-0">{row.team.flag}</span>
                      <span className="truncate text-xs" style={{ color: row.played > 0 ? '#f9fafb' : '#6b7280' }}>
                        {row.team.name}
                      </span>
                    </div>
                    <span className="w-6 text-center text-xs text-gray-500">{row.played}</span>
                    <span className="w-6 text-center text-xs text-gray-500">{row.won}</span>
                    <span className="w-6 text-center text-xs text-gray-500">{row.drawn}</span>
                    <span className="w-6 text-center text-xs text-gray-500">{row.lost}</span>
                    <span className="w-8 text-center text-xs text-gray-400">{row.played > 0 ? row.gf : '–'}</span>
                    <span className="w-8 text-center text-xs text-gray-400">
                      {row.played > 0 ? (row.gd > 0 ? `+${row.gd}` : row.gd) : '–'}
                    </span>
                    <span className="w-7 text-center text-sm font-bold"
                      style={{ color: advances ? '#22c55e' : row.played > 0 ? '#f9fafb' : '#374151' }}>
                      {row.pts}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
