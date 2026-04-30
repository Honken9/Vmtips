'use client'

import { LeaderboardEntry } from '@/lib/types'
import { Lock } from 'lucide-react'

interface Props {
  entries: LeaderboardEntry[]
  participantsWithTips: number
}

export function LeaderboardTable({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div
        className="rounded-xl p-12 text-center"
        style={{ background: '#111827', border: '1px solid #1f2937' }}
      >
        <div className="text-5xl mb-3">⚽</div>
        <div className="text-gray-400">Inga deltagare ännu</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
      <table className="w-full">
        <thead>
          <tr style={{ background: '#1f2937' }}>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">#</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Namn</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Rätt</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Exakt</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Poäng</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const isTop3 = i < 3
            const medals = ['🥇', '🥈', '🥉']

            return (
              <tr
                key={entry.user_id}
                className="border-t transition-colors hover:bg-white/5"
                style={{ borderColor: '#1f2937', background: i === 0 ? 'rgba(245,158,11,0.05)' : undefined }}
              >
                <td className="px-4 py-3.5">
                  {isTop3 ? (
                    <span className="text-lg">{medals[i]}</span>
                  ) : (
                    <span className="text-gray-500 text-sm font-medium">{i + 1}</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${i === 0 ? 'text-amber-400' : 'text-white'}`}>
                      {entry.display_name}
                    </span>
                    {entry.tips_locked && (
                      <Lock size={12} className="text-green-500" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                  <span className="text-gray-300 text-sm">{entry.correct_results}</span>
                </td>
                <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                  <span className="text-amber-400 text-sm font-medium">{entry.exact_scores}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className={`text-lg font-bold ${i === 0 ? 'text-amber-400' : 'text-white'}`}>
                    {entry.total_points}
                  </span>
                  <span className="text-gray-500 text-xs ml-1">p</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div
        className="px-4 py-3 flex gap-4 text-xs text-gray-500"
        style={{ borderTop: '1px solid #1f2937', background: '#111827' }}
      >
        <span><span className="text-gray-300 font-medium">Rätt</span> = rätt tecken (1/X/2)</span>
        <span><span className="text-amber-400 font-medium">Exakt</span> = rätt resultat</span>
      </div>
    </div>
  )
}
