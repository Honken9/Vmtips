'use client'

import { LeaderboardEntry, PoolMemberTag } from '@/lib/types'
import { TAG_COLOR_HEX } from '@/lib/tag-colors'
import { Layers, Trophy } from 'lucide-react'

interface Props {
  entries: LeaderboardEntry[]
  tags: PoolMemberTag[]
}

interface MemberStat {
  user_id: string
  name: string
  points: number
  exact: number
}

interface DeptStat {
  key: string
  label: string
  color: string | null
  members: MemberStat[]
  total: number
  exact: number
  avg: number
  best: MemberStat
}

const UNCLASSIFIED_KEY = '__none__'

// Bygger en avdelnings-sammanställning från leaderboard + taggar.
function buildStats(entries: LeaderboardEntry[], tags: PoolMemberTag[]): DeptStat[] {
  const tagByUser = new Map(tags.map(t => [t.user_id, t]))
  const buckets = new Map<string, { color: string | null; members: MemberStat[] }>()

  for (const e of entries) {
    const t = tagByUser.get(e.user_id)
    const dept = t?.department?.trim() || ''
    const key = dept ? dept.toLowerCase() : UNCLASSIFIED_KEY
    if (!buckets.has(key)) {
      buckets.set(key, { color: t?.color ?? null, members: [] })
    }
    const b = buckets.get(key)!
    // Behåll färgen bara om alla i avdelningen har samma. Annars: null.
    if (b.color !== (t?.color ?? null)) b.color = null
    b.members.push({
      user_id: e.user_id,
      name: e.display_name,
      points: e.total_points,
      exact: e.exact_scores,
    })
  }

  const stats: DeptStat[] = []
  for (const [key, b] of buckets.entries()) {
    if (b.members.length === 0) continue
    const sorted = [...b.members].sort((a, b) => b.points - a.points || b.exact - a.exact)
    const total = sorted.reduce((s, m) => s + m.points, 0)
    const exact = sorted.reduce((s, m) => s + m.exact, 0)
    const label = key === UNCLASSIFIED_KEY
      ? 'Utan avdelning'
      : (tags.find(t => t.department?.trim().toLowerCase() === key)?.department?.trim() ?? key)
    stats.push({
      key,
      label,
      color: b.color,
      members: sorted,
      total,
      exact,
      avg: total / sorted.length,
      best: sorted[0],
    })
  }

  return stats.sort((a, b) => {
    if (a.key === UNCLASSIFIED_KEY) return 1
    if (b.key === UNCLASSIFIED_KEY) return -1
    return b.avg - a.avg
  })
}

export function CategorySummary({ entries, tags }: Props) {
  const stats = buildStats(entries, tags)

  // Visa bara om det faktiskt finns minst två avdelningar (annars är det
  // ingen "sammanställning" – bara hela ligan).
  const namedCount = stats.filter(s => s.key !== UNCLASSIFIED_KEY).length
  if (namedCount < 2) return null

  const leader = stats.find(s => s.key !== UNCLASSIFIED_KEY) ?? null

  return (
    <section>
      <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
        <Layers size={18} className="text-indigo-400" />
        Avdelningar
      </h2>
      <p className="text-gray-500 text-xs mb-4">
        Snittpoäng per avdelning – följ med på den interna kampen.
        {leader && (
          <>
            {' '}Ledande avdelning: <span className="text-emerald-400 font-medium">{leader.label}</span>
            {' · '}<span className="text-amber-400 font-medium">{leader.avg.toFixed(1)} p i snitt</span>
          </>
        )}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((s, i) => {
          const hex = s.color ? TAG_COLOR_HEX[s.color] : null
          const isLeader = i === 0 && s.key !== UNCLASSIFIED_KEY
          return (
            <div
              key={s.key}
              className="rounded-xl p-4"
              style={{
                background: isLeader ? 'rgba(16,185,129,0.06)' : '#111827',
                border: `1px solid ${isLeader ? 'rgba(16,185,129,0.3)' : '#1f2937'}`,
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {hex && (
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: hex }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{s.label}</div>
                    <div className="text-[11px] text-gray-500">
                      {s.members.length} {s.members.length === 1 ? 'person' : 'personer'}
                    </div>
                  </div>
                </div>
                {isLeader && (
                  <Trophy size={16} className="text-amber-400 shrink-0" aria-label="Ledande avdelning" />
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <Stat label="Totalt" value={`${s.total}p`} tint="emerald" />
                <Stat label="Snitt" value={`${s.avg.toFixed(1)}p`} tint="amber" />
                <Stat label="Exakta" value={String(s.exact)} tint="indigo" />
              </div>

              <div className="text-[11px] text-gray-500 mb-1">Topp i avdelningen</div>
              <ol className="space-y-1">
                {s.members.slice(0, 3).map((m, idx) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-gray-600 w-4 text-right">{idx + 1}</span>
                      <span className="text-gray-200 truncate">{m.name}</span>
                    </span>
                    <span className="text-emerald-400 font-medium tabular-nums shrink-0">
                      {m.points}p
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Stat({ label, value, tint }: { label: string; value: string; tint: 'emerald' | 'amber' | 'indigo' }) {
  const colors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    indigo: 'text-indigo-300',
  }
  return (
    <div
      className="rounded-lg px-2 py-1.5 text-center"
      style={{ background: '#0b1120', border: '1px solid #1f2937' }}
    >
      <div className={`text-base font-bold tabular-nums ${colors[tint]}`}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}
