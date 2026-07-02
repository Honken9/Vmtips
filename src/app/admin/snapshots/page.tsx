'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LeaderboardEntry } from '@/lib/types'
import { Camera, Loader2, History, ArrowDown, ArrowUp, Minus } from 'lucide-react'

interface Snapshot {
  id: number
  label: string
  created_at: string
}

interface SnapRow {
  snapshot_id: number
  user_id: string
  display_name: string
  pool_id: number | null
  predictions_graded: number
  correct_results: number
  exact_scores: number
  bonus_points: number
  total_points: number
}

interface PoolRow { id: number; name: string }

// Admin-only: frys en "före"-bild av tabellen och jämför mot live efteråt.
// Syns inte för deltagare – hela /admin är gated i layouten.
export default function AdminSnapshotsPage() {
  const supabase = createClient()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [snapRows, setSnapRows] = useState<SnapRow[]>([])
  const [live, setLive] = useState<LeaderboardEntry[]>([])
  const [pools, setPools] = useState<PoolRow[]>([])
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [poolFilter, setPoolFilter] = useState<number | 'all'>('all')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: snaps }, { data: lb }, { data: ps }] = await Promise.all([
      supabase.from('leaderboard_snapshots').select('*').order('created_at', { ascending: false }),
      supabase.from('leaderboard').select('*'),
      supabase.from('pools').select('id, name').is('deleted_at', null),
    ])
    setSnapshots((snaps ?? []) as Snapshot[])
    setLive((lb ?? []) as LeaderboardEntry[])
    setPools((ps ?? []) as PoolRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (selected == null) { setSnapRows([]); return }
    supabase
      .from('leaderboard_snapshot_rows')
      .select('*')
      .eq('snapshot_id', selected)
      .then(({ data }) => setSnapRows((data ?? []) as SnapRow[]))
  }, [selected, supabase])

  async function takeSnapshot() {
    setCreating(true)
    setMsg(null)
    const res = await fetch('/api/admin/leaderboard-snapshot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: label.trim() || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setCreating(false)
    if (!res.ok) {
      setMsg({ ok: false, text: data.error ?? `HTTP ${res.status}` })
      return
    }
    setMsg({ ok: true, text: `Snapshot "${data.snapshot.label}" sparad (${data.snapshot.rows} rader)` })
    setLabel('')
    await loadAll()
    setSelected(data.snapshot.id)
  }

  const poolName = useMemo(() => new Map(pools.map(p => [p.id, p.name])), [pools])
  const liveByUser = useMemo(() => new Map(live.map(e => [e.user_id, e])), [live])

  // Jämförelserader: snapshot ("då") mot live ("nu"), med delta
  const diffRows = useMemo(() => {
    return snapRows
      .filter(r => poolFilter === 'all' || r.pool_id === poolFilter)
      .map(r => {
        const now = liveByUser.get(r.user_id) ?? null
        const nowPts = now?.total_points ?? 0
        return {
          ...r,
          now_points: nowPts,
          delta: nowPts - r.total_points,
          now_exact: now?.exact_scores ?? 0,
          now_correct: now?.correct_results ?? 0,
          now_bonus: now?.bonus_points ?? 0,
        }
      })
      .sort((a, b) =>
        (poolName.get(a.pool_id ?? -1) ?? '').localeCompare(poolName.get(b.pool_id ?? -1) ?? '') ||
        b.now_points - a.now_points
      )
  }, [snapRows, liveByUser, poolFilter, poolName])

  const changedCount = diffRows.filter(r => r.delta !== 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History size={22} className="text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Tabell-snapshots</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Frys en &quot;före&quot;-bild av poängtabellen och jämför mot live efteråt.
            Syns bara för admin.
          </p>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{
          background: msg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: msg.ok ? '#4ade80' : '#f87171',
          border: `1px solid ${msg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* Ta nytt snapshot */}
      <div className="rounded-xl p-4 flex flex-col sm:flex-row gap-2 sm:items-end"
        style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Etikett (valfri)</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={120}
            placeholder='T.ex. "Före slutspelsregel-fix"'
            className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
          />
        </div>
        <button
          onClick={takeSnapshot}
          disabled={creating}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-40 gold-gradient w-full sm:w-auto"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          Ta snapshot nu
        </button>
      </div>

      {/* Lista + jämförelse */}
      {loading ? (
        <div className="text-sm text-gray-500">Laddar…</div>
      ) : snapshots.length === 0 ? (
        <div className="rounded-xl p-8 text-center text-sm text-gray-500"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          Inga snapshots än. Har du kört supabase/add_leaderboard_snapshots.sql?
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-gray-500">Snapshot:</label>
            <select
              value={selected ?? ''}
              onChange={e => setSelected(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none"
              style={{ background: '#1f2937', border: '1px solid #374151' }}
            >
              <option value="">– Välj –</option>
              {snapshots.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label} · {new Date(s.created_at).toLocaleString('sv-SE')}
                </option>
              ))}
            </select>
            <label className="text-xs text-gray-500 ml-2">Liga:</label>
            <select
              value={String(poolFilter)}
              onChange={e => setPoolFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none"
              style={{ background: '#1f2937', border: '1px solid #374151' }}
            >
              <option value="all">Alla</option>
              {pools.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {selected != null && (
              <span className="text-xs text-gray-500 ml-auto">
                {changedCount} av {diffRows.length} deltagare har ändrats
              </span>
            )}
          </div>

          {selected != null && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#1f2937' }}>
                    <th className="text-left px-3 py-2 text-xs text-gray-400 uppercase">Deltagare</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-400 uppercase hidden sm:table-cell">Liga</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-400 uppercase">Då</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-400 uppercase">Nu</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-400 uppercase">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map(r => (
                    <tr key={r.user_id} className="border-t" style={{ borderColor: '#1f2937' }}>
                      <td className="px-3 py-2 text-white">{r.display_name}</td>
                      <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">
                        {r.pool_id != null ? poolName.get(r.pool_id) ?? '–' : '–'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300 tabular-nums">{r.total_points}</td>
                      <td className="px-3 py-2 text-right text-white font-semibold tabular-nums">{r.now_points}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.delta === 0 ? (
                          <span className="inline-flex items-center gap-1 text-gray-600"><Minus size={11} />0</span>
                        ) : r.delta > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400"><ArrowUp size={11} />+{r.delta}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400"><ArrowDown size={11} />{r.delta}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
