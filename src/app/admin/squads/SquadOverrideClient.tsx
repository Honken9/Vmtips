'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Loader2, CheckCircle, Trash2, Plus, Lock, Unlock, Download, AlertTriangle, FolderOpen,
} from 'lucide-react'

interface Team { code: string; name: string; flag: string }

type PosBucket = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward'

interface EditPlayer {
  id: string
  name: string
  position: PosBucket | ''
  club: string
  youthClub: string
  marketValueM: number | null
}

const POS_LABELS: Record<PosBucket, string> = {
  Goalkeeper: 'Målvakt',
  Defender: 'Back',
  Midfielder: 'Mittfält',
  Forward: 'Anfallare',
}

const POS_ORDER: PosBucket[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']

function normalizeBucket(raw: string | null | undefined): PosBucket | null {
  const p = (raw ?? '').toLowerCase().trim()
  if (!p) return null
  if (p.includes('keeper') || p === 'gk') return 'Goalkeeper'
  if (
    p.includes('back') || p.includes('defen') ||
    p === 'cb' || p === 'lb' || p === 'rb' || p === 'wb' || p.includes('sweeper')
  ) return 'Defender'
  if (
    p.includes('midfield') ||
    p === 'cm' || p === 'dm' || p === 'am' || p === 'cdm' || p === 'cam'
  ) return 'Midfielder'
  if (
    p.includes('forward') || p.includes('winger') || p.includes('wing') ||
    p.includes('striker') || p.includes('attack') ||
    p === 'st' || p === 'cf' || p === 'lw' || p === 'rw'
  ) return 'Forward'
  return null
}

interface Props {
  teams: Team[]
  overrideMap: Record<string, { count: number; updated: string; locked: boolean }>
}

interface ApiPlayer {
  name: string
  position: PosBucket | null
  club: string
  youthClub: string
  marketValueM: number | null
}

export function SquadOverrideClient({ teams, overrideMap }: Props) {
  const supabase = createClient()
  const [code, setCode] = useState<string>(teams[0]?.code ?? '')
  const [players, setPlayers] = useState<EditPlayer[]>([])
  const [locked, setLocked] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function uid() {
    return Math.random().toString(36).slice(2)
  }

  function toEditPlayers(raw: Array<Partial<ApiPlayer> & { position?: unknown }>): EditPlayer[] {
    return raw.map(p => ({
      id: uid(),
      name: typeof p.name === 'string' ? p.name : '',
      position: normalizeBucket(typeof p.position === 'string' ? p.position : null) ?? '',
      club: typeof p.club === 'string' ? p.club : '',
      youthClub: typeof p.youthClub === 'string' ? p.youthClub : '',
      marketValueM: typeof p.marketValueM === 'number' ? p.marketValueM : null,
    }))
  }

  function changeCode(next: string) {
    if (dirty && !confirm('Du har osparade ändringar. Byta land ändå?')) return
    setCode(next)
    setPlayers([])
    setLocked(false)
    setLoaded(false)
    setDirty(false)
    setMsg(null)
  }

  async function loadOverride() {
    if (!code) return
    setLoading(true)
    setMsg(null)
    const { data } = await supabase
      .from('team_squad_overrides')
      .select('players, locked')
      .eq('team_code', code)
      .maybeSingle()
    if (data && Array.isArray(data.players)) {
      setPlayers(toEditPlayers(data.players as Array<Partial<ApiPlayer>>))
      setLocked(!!data.locked)
    } else {
      setPlayers([])
      setLocked(false)
      setMsg({ ok: true, text: `Ingen sparad override för ${code} – hämta från sajten eller börja från tomt.` })
    }
    setLoaded(true)
    setDirty(false)
    setLoading(false)
  }

  async function loadFromSite(bypassOverride: boolean) {
    if (!code) return
    if (dirty && !confirm('Du har osparade ändringar. Skriva över dem?')) return
    if (locked && bypassOverride && !confirm(
      'Truppen är låst. Att hämta direkt från football-data ersätter listan här i editorn (sparas inte förrän du klickar Spara). Fortsätt?'
    )) return
    setLoading(true)
    setMsg(null)
    try {
      const url = bypassOverride
        ? `/api/admin/squads/${code}?bypass=1`
        : `/api/admin/squads/${code}`
      const res = await fetch(url)
      if (!res.ok) {
        setMsg({ ok: false, text: `Kunde inte hämta (HTTP ${res.status})` })
        setLoading(false)
        return
      }
      const json = (await res.json()) as { players: ApiPlayer[] }
      setPlayers(toEditPlayers(json.players ?? []))
      setLoaded(true)
      setDirty(true)
      setMsg({
        ok: true,
        text: bypassOverride
          ? `Hämtade ${json.players?.length ?? 0} spelare direkt från football-data + Wikipedia (override ignorerad)`
          : `Hämtade ${json.players?.length ?? 0} spelare som sajten visar nu`,
      })
    } catch {
      setMsg({ ok: false, text: 'Nätverksfel vid hämtning' })
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!code) return
    setSaving(true)
    setMsg(null)
    const payload = players
      .filter(p => p.name.trim())
      .map(p => ({
        name: p.name.trim(),
        ...(p.position ? { position: p.position } : {}),
        ...(p.club.trim() ? { club: p.club.trim() } : {}),
        ...(p.youthClub.trim() ? { youthClub: p.youthClub.trim() } : {}),
        ...(p.marketValueM != null && !isNaN(p.marketValueM) ? { marketValueM: p.marketValueM } : {}),
      }))
    const { error } = await supabase
      .from('team_squad_overrides')
      .upsert(
        {
          team_code: code,
          players: payload,
          locked,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'team_code' }
      )
    setSaving(false)
    if (error) {
      setMsg({ ok: false, text: error.message })
    } else {
      setMsg({ ok: true, text: `Sparat ${payload.length} spelare för ${code}${locked ? ' (LÅST)' : ''}` })
      setDirty(false)
    }
  }

  async function clearOverride() {
    if (!code) return
    if (!confirm(`Ta bort sparad trupp för ${code}? Då används football-data/fallback igen.`)) return
    setLoading(true)
    const { error } = await supabase.from('team_squad_overrides').delete().eq('team_code', code)
    setLoading(false)
    if (error) {
      setMsg({ ok: false, text: error.message })
      return
    }
    setPlayers([])
    setLocked(false)
    setLoaded(false)
    setDirty(false)
    setMsg({ ok: true, text: `Override borttagen för ${code}` })
  }

  function update(id: string, patch: Partial<EditPlayer>) {
    setPlayers(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
    setDirty(true)
  }

  function removeRow(id: string) {
    setPlayers(prev => prev.filter(p => p.id !== id))
    setDirty(true)
  }

  function addRow(pos: PosBucket) {
    setPlayers(prev => [
      ...prev,
      { id: uid(), name: '', position: pos, club: '', youthClub: '', marketValueM: null },
    ])
    setDirty(true)
  }

  const noPosPlayers = players.filter(p => !p.position)
  const totalValue = players.reduce((s, p) => s + (p.marketValueM ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users size={22} className="text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Officiella trupper</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Redigera och lås trupp per land. Override:n tar prioritet före football-data och fallback.
          </p>
        </div>
      </div>

      <div className="rounded-xl p-5 space-y-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        {/* Topp-rad: land + actions */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Land</label>
            <select
              value={code}
              onChange={e => changeCode(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 min-w-[220px]"
              style={{ background: '#1f2937', border: '1px solid #374151' }}
            >
              {teams.map(t => {
                const ov = overrideMap[t.code]
                const suffix = ov ? ` ✓ ${ov.count}${ov.locked ? ' 🔒' : ''}` : ''
                return (
                  <option key={t.code} value={t.code}>
                    {t.name} ({t.code}){suffix}
                  </option>
                )
              })}
            </select>
          </div>

          <button
            onClick={loadOverride}
            disabled={loading || !code}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-200 disabled:opacity-50"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
            title="Läs in den sparade override:n från databasen"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
            Ladda sparad
          </button>

          <button
            onClick={() => loadFromSite(false)}
            disabled={loading || !code}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-emerald-300 disabled:opacity-50"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}
            title="Hämta truppen som sajten visar (override → football-data → fallback)"
          >
            <Download size={14} />
            Hämta från sajten
          </button>

          <button
            onClick={() => loadFromSite(true)}
            disabled={loading || !code}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-indigo-300 disabled:opacity-50"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}
            title="Hämta direkt från football-data + Wikipedia (ignorerar override)"
          >
            <Download size={14} />
            Färsk från football-data
          </button>

          {loaded && (
            <button
              onClick={() => { setLocked(l => !l); setDirty(true) }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${locked ? 'text-amber-300' : 'text-gray-300'}`}
              style={{
                background: locked ? 'rgba(245,158,11,0.12)' : '#1f2937',
                border: `1px solid ${locked ? 'rgba(245,158,11,0.4)' : '#374151'}`,
              }}
              title={locked ? 'Lås upp – tillåt uppdateringar från football-data igen' : 'Lås – stoppa football-data-uppdateringar för denna trupp'}
            >
              {locked ? <Lock size={14} /> : <Unlock size={14} />}
              {locked ? 'Låst' : 'Olåst'}
            </button>
          )}

          {overrideMap[code] && (
            <button
              onClick={clearOverride}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ml-auto"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <Trash2 size={14} />
              Ta bort override
            </button>
          )}
        </div>

        {locked && loaded && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}
          >
            <Lock size={12} className="mt-0.5 shrink-0" />
            <span>
              Truppen är låst – football-data-uppdateringar visas inte på sajten. Klicka <strong>Olåst</strong> för att tillåta uppdateringar igen.
            </span>
          </div>
        )}

        {msg && (
          <div
            className="text-sm px-4 py-2 rounded-lg flex items-center gap-2"
            style={{
              background: msg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: msg.ok ? '#4ade80' : '#f87171',
            }}
          >
            {msg.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {msg.text}
          </div>
        )}

        {!loaded && !loading && (
          <div className="rounded-lg px-4 py-6 text-sm text-gray-400 text-center"
            style={{ background: '#0f172a', border: '1px dashed #374151' }}>
            Välj land och klicka <strong className="text-gray-200">Ladda sparad</strong> eller <strong className="text-gray-200">Hämta från sajten</strong> för att börja redigera.
          </div>
        )}

        {/* Position-grupper */}
        {loaded && (
          <div className="space-y-4">
            {POS_ORDER.map(pos => {
              const list = players.filter(p => p.position === pos)
              return (
                <div key={pos} className="rounded-xl overflow-hidden" style={{ background: '#0f172a', border: '1px solid #1f2937' }}>
                  <div
                    className="flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-400"
                    style={{ background: '#1a2233' }}
                  >
                    <span>{POS_LABELS[pos]} ({list.length})</span>
                    <button
                      onClick={() => addRow(pos)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded text-gray-300 hover:text-emerald-300"
                      style={{ background: '#1f2937' }}
                    >
                      <Plus size={12} /> Spelare
                    </button>
                  </div>
                  <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="col-span-3">Namn</div>
                    <div className="col-span-2">Position</div>
                    <div className="col-span-3">Klubb</div>
                    <div className="col-span-2">Moderklubb</div>
                    <div className="col-span-1 text-right">M€</div>
                    <div className="col-span-1"></div>
                  </div>
                  {list.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-600">Inga spelare i denna position än.</div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: '#1f2937' }}>
                      {list.map(p => (
                        <PlayerEditRow key={p.id} p={p} update={update} remove={removeRow} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {noPosPlayers.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ background: '#0f172a', border: '1px solid rgba(245,158,11,0.3)' }}>
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-amber-400" style={{ background: '#1a2233' }}>
                  Saknar position ({noPosPlayers.length}) – sätt position på varje rad
                </div>
                <div className="divide-y" style={{ borderColor: '#1f2937' }}>
                  {noPosPlayers.map(p => (
                    <PlayerEditRow key={p.id} p={p} update={update} remove={removeRow} />
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
              <span>
                Totalt: <span className="text-white font-semibold">{players.length}</span> spelare
              </span>
              {totalValue > 0 && (
                <span>
                  Truppvärde: <span className="text-emerald-400 font-semibold">
                    €{totalValue >= 1000 ? `${(totalValue / 1000).toFixed(2)}B` : `${totalValue.toFixed(0)}M`}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {loaded && (
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-black transition-all disabled:opacity-50 gold-gradient"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            Spara trupp för {code}{locked ? ' (låst)' : ''}
            {dirty && <span className="text-xs font-normal opacity-70 ml-1">– osparade ändringar</span>}
          </button>
        )}
      </div>
    </div>
  )
}

function PlayerEditRow({
  p,
  update,
  remove,
}: {
  p: EditPlayer
  update: (id: string, patch: Partial<EditPlayer>) => void
  remove: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-12 gap-2 px-3 py-2 items-center text-sm">
      <input
        value={p.name}
        onChange={e => update(p.id, { name: e.target.value })}
        placeholder="Namn"
        className="col-span-12 md:col-span-3 px-2 py-1.5 rounded text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        style={{ background: '#1f2937', border: '1px solid #374151' }}
      />
      <select
        value={p.position}
        onChange={e => update(p.id, { position: e.target.value as PosBucket | '' })}
        className="col-span-6 md:col-span-2 px-2 py-1.5 rounded text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        style={{ background: '#1f2937', border: '1px solid #374151' }}
      >
        <option value="">– Position –</option>
        <option value="Goalkeeper">Målvakt</option>
        <option value="Defender">Back</option>
        <option value="Midfielder">Mittfält</option>
        <option value="Forward">Anfallare</option>
      </select>
      <input
        value={p.club}
        onChange={e => update(p.id, { club: e.target.value })}
        placeholder="Klubb"
        className="col-span-12 md:col-span-3 px-2 py-1.5 rounded text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        style={{ background: '#1f2937', border: '1px solid #374151' }}
      />
      <input
        value={p.youthClub}
        onChange={e => update(p.id, { youthClub: e.target.value })}
        placeholder="Moderklubb"
        className="col-span-12 md:col-span-2 px-2 py-1.5 rounded text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        style={{ background: '#1f2937', border: '1px solid #374151' }}
      />
      <input
        type="number"
        step="0.1"
        min="0"
        value={p.marketValueM ?? ''}
        onChange={e =>
          update(p.id, {
            marketValueM: e.target.value === '' ? null : parseFloat(e.target.value),
          })
        }
        placeholder="M€"
        className="col-span-5 md:col-span-1 px-2 py-1.5 rounded text-white text-right focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        style={{ background: '#1f2937', border: '1px solid #374151' }}
      />
      <button
        onClick={() => remove(p.id)}
        className="col-span-1 flex items-center justify-center py-1.5 text-red-400 hover:bg-red-500/10 rounded"
        title="Ta bort spelare"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
