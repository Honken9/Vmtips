'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Loader2, CheckCircle, Trash2 } from 'lucide-react'

interface Team { code: string; name: string; flag: string }

interface Props {
  teams: Team[]
  overrideMap: Record<string, { count: number; updated: string }>
}

// En spelare per rad: "Namn | Position | Klubb | Värde(M)"
// Position: MV/Back/MF/Anf  (eller engelska Goalkeeper/Defender/Midfielder/Forward)
const POS_MAP: Record<string, string> = {
  mv: 'Goalkeeper', målvakt: 'Goalkeeper', gk: 'Goalkeeper', goalkeeper: 'Goalkeeper',
  back: 'Defender', försvar: 'Defender', def: 'Defender', defender: 'Defender',
  mf: 'Midfielder', mittfält: 'Midfielder', midfielder: 'Midfielder', mid: 'Midfielder',
  anf: 'Forward', anfallare: 'Forward', forward: 'Forward', fw: 'Forward', anfall: 'Forward',
}

export function SquadOverrideClient({ teams, overrideMap }: Props) {
  const supabase = createClient()
  const [code, setCode] = useState<string>(teams[0]?.code ?? '')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    if (!code) return
    setLoading(true)
    setMsg(null)
    const { data } = await supabase
      .from('team_squad_overrides')
      .select('players')
      .eq('team_code', code)
      .maybeSingle()
    const players = (data?.players ?? []) as Array<{
      name: string; position?: string; club?: string; marketValueM?: number
    }>
    setText(
      players
        .map(p =>
          [p.name, p.position ?? '', p.club ?? '', p.marketValueM ?? '']
            .join(' | ')
            .replace(/(\s\|\s*)+$/, '')
        )
        .join('\n')
    )
    setLoading(false)
  }

  function parse(): { name: string; position: string; club: string; marketValueM?: number }[] {
    return text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split('|').map(s => s.trim())
        const name = parts[0] ?? ''
        const posRaw = (parts[1] ?? '').toLowerCase()
        const position = POS_MAP[posRaw] ?? parts[1] ?? ''
        const club = parts[2] ?? ''
        const mv = parts[3] ? parseFloat(parts[3].replace(',', '.')) : undefined
        return {
          name,
          position,
          club,
          ...(mv != null && !isNaN(mv) ? { marketValueM: mv } : {}),
        }
      })
      .filter(p => p.name)
  }

  async function save() {
    if (!code) return
    const players = parse()
    setLoading(true)
    setMsg(null)
    const { error } = await supabase
      .from('team_squad_overrides')
      .upsert(
        { team_code: code, players, updated_at: new Date().toISOString() },
        { onConflict: 'team_code' }
      )
    setLoading(false)
    if (error) {
      setMsg({ ok: false, text: error.message })
    } else {
      setMsg({ ok: true, text: `Sparat ${players.length} spelare för ${code}` })
    }
  }

  async function clearOverride() {
    if (!code) return
    if (!confirm(`Ta bort officiell trupp för ${code}? Då används football-data.org/fallback igen.`)) return
    setLoading(true)
    await supabase.from('team_squad_overrides').delete().eq('team_code', code)
    setText('')
    setLoading(false)
    setMsg({ ok: true, text: `Override borttagen för ${code}` })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users size={22} className="text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Officiella trupper</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Spika exakt trupp per land. Tar prioritet före football-data.org och fallback.
          </p>
        </div>
      </div>

      <div className="rounded-xl p-5 space-y-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Land</label>
            <select
              value={code}
              onChange={e => { setCode(e.target.value); setText(''); setMsg(null) }}
              className="px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              style={{ background: '#1f2937', border: '1px solid #374151' }}
            >
              {teams.map(t => (
                <option key={t.code} value={t.code}>
                  {t.name} ({t.code}){overrideMap[t.code] ? ` ✓ ${overrideMap[t.code].count}` : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-200 disabled:opacity-50"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Ladda nuvarande'}
          </button>
          {overrideMap[code] && (
            <button
              onClick={clearOverride}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <Trash2 size={14} />
              Ta bort override
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            En spelare per rad: <span className="font-mono text-gray-400">Namn | Position | Klubb | Värde(M)</span>
            <br />
            Position: MV / Back / MF / Anf (eller Goalkeeper/Defender/Midfielder/Forward). Klubb och värde valfria.
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={20}
            spellCheck={false}
            placeholder={'Robin Olsen | MV | Aston Villa | 2\nViktor Gyökeres | Anf | Arsenal | 95\nLucas Bergvall | MF | Tottenham | 50'}
            className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            style={{ background: '#0f172a', border: '1px solid #374151' }}
          />
        </div>

        {msg && (
          <div
            className="text-sm px-4 py-2 rounded-lg flex items-center gap-2"
            style={{
              background: msg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: msg.ok ? '#4ade80' : '#f87171',
            }}
          >
            {msg.ok && <CheckCircle size={14} />}
            {msg.text}
          </div>
        )}

        <button
          onClick={save}
          disabled={loading || !text.trim()}
          className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-black transition-all disabled:opacity-50 gold-gradient"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
          Spara officiell trupp för {code}
        </button>
      </div>
    </div>
  )
}
