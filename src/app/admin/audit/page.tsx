import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Activity, Filter } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface AuditRow {
  id: number
  occurred_at: string
  user_id: string | null
  user_name: string | null
  action: 'insert' | 'update' | 'delete'
  table_name: string
  record_id: string | null
  changes: Record<string, unknown> | null
}

interface MatchLookup {
  id: number
  match_number: number
  home_team_name: string | null
  away_team_name: string | null
  home_placeholder: string | null
  away_placeholder: string | null
}

const TABLE_LABELS: Record<string, string> = {
  predictions: 'Tipps',
  bonus_predictions: 'Bonustips',
  bonus_results: 'Bonusfacit',
  pools: 'Liga',
  pool_memberships: 'Liga-medlem',
  pool_payments: 'Betalning',
  profiles: 'Profil',
  matches: 'Match',
  settings: 'Inställningar',
}

const ACTION_COLORS: Record<string, string> = {
  insert: 'rgba(34,197,94,0.15)',
  update: 'rgba(99,102,241,0.15)',
  delete: 'rgba(239,68,68,0.15)',
}

const ACTION_TEXT_COLORS: Record<string, string> = {
  insert: '#4ade80',
  update: '#a5b4fc',
  delete: '#f87171',
}

const ACTION_LABELS: Record<string, string> = {
  insert: 'Skapad',
  update: 'Ändrad',
  delete: 'Raderad',
}

const SETTINGS_FIELD_LABELS: Record<string, string> = {
  tournament_mode: 'Spelläge',
  mode_a_global_lock: 'Globalt lås',
  points_correct_result: 'Poäng rätt tecken',
  points_exact_score: 'Poäng exakt resultat',
  points_winner: 'Poäng rätt mästare',
  points_finalist: 'Poäng rätt finalist',
  randomize_duration: 'Slumpningens längd',
  randomize_phrase_1: 'Slumpfras 1',
  randomize_phrase_2: 'Slumpfras 2',
  randomize_phrase_3: 'Slumpfras 3',
}

const POOL_FIELD_LABELS: Record<string, string> = {
  name: 'Liganamn',
  description: 'Beskrivning',
  invite_code: 'Invite-kod',
  entry_fee: 'Avgift',
  swish_recipient_name: 'Swish-mottagare',
  swish_phone: 'Swish-nummer',
  prize_distribution: 'Prisfördelning',
  tournament_mode: 'Spelläge',
  mode_a_global_lock: 'Globalt lås',
}

const PROFILE_FIELD_LABELS: Record<string, string> = {
  display_name: 'Visningsnamn',
  is_admin: 'Admin',
  tips_locked: 'Tips låsta',
  pool_id: 'Aktiv liga',
  avatar_url: 'Avatar',
}

const MATCH_FIELD_LABELS: Record<string, string> = {
  home_score: 'Hemmamål',
  away_score: 'Bortamål',
  result_confirmed: 'Bekräftat',
  manually_edited: 'Manuellt redigerad',
  kickoff_at: 'Avspark',
  venue: 'Arena',
}

function fmtVal(v: unknown): string {
  if (v == null) return '–'
  if (typeof v === 'boolean') return v ? 'ja' : 'nej'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

interface Diff {
  old: unknown
  new: unknown
}

function isDiff(x: unknown): x is Diff {
  return !!x && typeof x === 'object' && 'old' in x && 'new' in x
}

function arrowFmt(d: Diff): string {
  return `${fmtVal(d.old)} → ${fmtVal(d.new)}`
}

interface Lookups {
  matches: Map<number, MatchLookup>
  pools: Map<number, string>
  teams: Map<number, string>
}

function matchLabel(m: MatchLookup | undefined, fallbackId?: number): string {
  if (!m) {
    return fallbackId ? `Match #${fallbackId}` : 'Okänd match'
  }
  const home = m.home_team_name ?? m.home_placeholder ?? '?'
  const away = m.away_team_name ?? m.away_placeholder ?? '?'
  return `Match ${m.match_number}: ${home} – ${away}`
}

function describePrediction(row: AuditRow, lookups: Lookups): string {
  const c = (row.changes ?? {}) as Record<string, unknown>
  const fullRow = (c._row as Record<string, unknown> | undefined) ?? c
  const matchId = Number(
    fullRow.match_id ?? c.match_id ?? (isDiff(c.match_id) ? (c.match_id as Diff).new : undefined)
  )
  const m = isFinite(matchId) && matchId > 0 ? lookups.matches.get(matchId) : undefined
  const label = matchLabel(m, isFinite(matchId) ? matchId : undefined)

  if (row.action === 'insert') {
    return `${label}: ${c.pred_home}–${c.pred_away}`
  }
  if (row.action === 'delete') {
    return `Raderade tipps på ${label}: ${c.pred_home}–${c.pred_away}`
  }
  // update
  const home = isDiff(c.pred_home) ? c.pred_home : null
  const away = isDiff(c.pred_away) ? c.pred_away : null
  if (home && away) {
    return `${label}: ${home.old}–${away.old} → ${home.new}–${away.new}`
  }
  if (home) return `${label}: hemmamål ${arrowFmt(home)}`
  if (away) return `${label}: bortamål ${arrowFmt(away)}`
  if (isDiff(c.locked)) return `${label}: ${(c.locked as Diff).new ? 'låst' : 'olåst'}`
  return label
}

function describeBonus(row: AuditRow): string {
  const c = (row.changes ?? {}) as Record<string, unknown>
  if (row.action === 'insert') {
    const parts: string[] = []
    if (c.top_scorer) parts.push(`skytteliga: ${c.top_scorer}`)
    if (c.total_goals != null) parts.push(`totalt mål: ${c.total_goals}`)
    if (c.most_yellow_team_id != null) parts.push(`flest gula: lag #${c.most_yellow_team_id}`)
    return parts.length ? `Tippade ${parts.join(', ')}` : 'Bonustips skapat'
  }
  const parts: string[] = []
  if (isDiff(c.top_scorer)) parts.push(`skytteliga: ${arrowFmt(c.top_scorer)}`)
  if (isDiff(c.total_goals)) parts.push(`totalt mål: ${arrowFmt(c.total_goals)}`)
  if (isDiff(c.most_yellow_team_id)) parts.push(`flest gula: ${arrowFmt(c.most_yellow_team_id)}`)
  return parts.length ? parts.join(', ') : 'Bonustips ändrat'
}

function describePool(row: AuditRow): string {
  const c = (row.changes ?? {}) as Record<string, unknown>
  const fullRow = (c._row as Record<string, unknown> | undefined) ?? c
  const name = fullRow.name as string | undefined

  if (row.action === 'insert') {
    return `Skapade ligan "${name ?? '?'}" (kod: ${c.invite_code ?? '?'})`
  }
  if (row.action === 'delete') {
    return `Raderade ligan "${name ?? '?'}"`
  }
  const prefix = name ? `Ligan "${name}": ` : ''
  const parts: string[] = []
  for (const [key, val] of Object.entries(c)) {
    if (key.startsWith('_') || !isDiff(val)) continue
    const label = POOL_FIELD_LABELS[key] ?? key
    parts.push(`${label} ${arrowFmt(val)}`)
  }
  return parts.length ? prefix + parts.join(', ') : prefix + 'ändrad'
}

function describeMembership(row: AuditRow, lookups: Lookups): string {
  const c = (row.changes ?? {}) as Record<string, unknown>
  const fullRow = (c._row as Record<string, unknown> | undefined) ?? c
  const poolId = Number(fullRow.pool_id ?? c.pool_id)
  const poolName = lookups.pools.get(poolId) ?? `liga #${poolId}`

  if (row.action === 'insert') return `Gick med i "${poolName}"`
  if (row.action === 'delete') return `Lämnade "${poolName}"`
  return `Medlemskap i "${poolName}" ändrat`
}

function describePayment(row: AuditRow, lookups: Lookups): string {
  const c = (row.changes ?? {}) as Record<string, unknown>
  const fullRow = (c._row as Record<string, unknown> | undefined) ?? c
  const poolId = Number(fullRow.pool_id ?? c.pool_id)
  const poolName = lookups.pools.get(poolId) ?? `liga #${poolId}`
  const amount = fullRow.amount as number | null | undefined
  const paid = (fullRow.paid as boolean | undefined) ?? false

  if (row.action === 'insert' || (isDiff(c.paid) && (c.paid as Diff).new === true)) {
    const amt = amount != null ? `${amount} kr` : ''
    return `Markerades som betald i "${poolName}"${amt ? ` (${amt})` : ''}`
  }
  if (isDiff(c.paid) && (c.paid as Diff).new === false) {
    return `Markerades som obetald i "${poolName}"`
  }
  if (row.action === 'delete') return `Tog bort betalning i "${poolName}"`
  return `Betalning i "${poolName}" ${paid ? 'uppdaterad' : 'ändrad'}`
}

function describeProfile(row: AuditRow, lookups: Lookups): string {
  const c = (row.changes ?? {}) as Record<string, unknown>
  if (row.action === 'insert') return `Profil skapad`
  if (row.action === 'delete') return `Profil raderad`

  const parts: string[] = []
  for (const [key, val] of Object.entries(c)) {
    if (key.startsWith('_') || !isDiff(val)) continue
    const label = PROFILE_FIELD_LABELS[key] ?? key
    if (key === 'pool_id') {
      const oldName = val.old != null ? lookups.pools.get(Number(val.old)) ?? `#${val.old}` : '–'
      const newName = val.new != null ? lookups.pools.get(Number(val.new)) ?? `#${val.new}` : '–'
      parts.push(`${label}: ${oldName} → ${newName}`)
    } else {
      parts.push(`${label}: ${arrowFmt(val)}`)
    }
  }
  return parts.length ? parts.join(', ') : 'Profil ändrad'
}

function describeMatch(row: AuditRow, lookups: Lookups): string {
  const c = (row.changes ?? {}) as Record<string, unknown>
  const fullRow = (c._row as Record<string, unknown> | undefined) ?? c
  // För matches-tabellen: id är primärnyckeln OCH lika med record_id.
  const matchId = Number(
    fullRow.id ?? c.id ?? row.record_id
  )
  const m = isFinite(matchId) && matchId > 0 ? lookups.matches.get(matchId) : undefined
  const label = matchLabel(m, isFinite(matchId) ? matchId : undefined)

  if (row.action !== 'update') return label
  const home = isDiff(c.home_score) ? c.home_score : null
  const away = isDiff(c.away_score) ? c.away_score : null
  if (home && away) {
    return `${label}: ${home.old ?? '–'}–${away.old ?? '–'} → ${home.new}–${away.new}`
  }
  if (home) return `${label}: hemmamål ${arrowFmt(home)}`
  if (away) return `${label}: bortamål ${arrowFmt(away)}`
  const parts: string[] = []
  for (const [key, val] of Object.entries(c)) {
    if (key.startsWith('_') || !isDiff(val)) continue
    const fieldLabel = MATCH_FIELD_LABELS[key] ?? key
    parts.push(`${fieldLabel} ${arrowFmt(val)}`)
  }
  return parts.length ? `${label}: ${parts.join(', ')}` : label
}

function describeSettings(row: AuditRow): string {
  const c = (row.changes ?? {}) as Record<string, unknown>
  const parts: string[] = []
  for (const [key, val] of Object.entries(c)) {
    if (key.startsWith('_') || !isDiff(val)) continue
    const label = SETTINGS_FIELD_LABELS[key] ?? key
    parts.push(`${label}: ${arrowFmt(val)}`)
  }
  return parts.length ? parts.join(', ') : 'Inställningar ändrade'
}

function describeBonusResults(row: AuditRow): string {
  const c = (row.changes ?? {}) as Record<string, unknown>
  if (row.action === 'insert') return 'Bonusfacit skapat'
  const parts: string[] = []
  for (const [key, val] of Object.entries(c)) {
    if (key.startsWith('_') || !isDiff(val)) continue
    const labels: Record<string, string> = {
      top_scorer: 'Skytteliga',
      most_yellow_team_id: 'Flest gula',
      total_goals: 'Totalt mål',
      confirmed: 'Bekräftat',
    }
    const label = labels[key] ?? key
    parts.push(`${label}: ${arrowFmt(val)}`)
  }
  return parts.length ? parts.join(', ') : 'Bonusfacit ändrat'
}

function describe(row: AuditRow, lookups: Lookups): string {
  switch (row.table_name) {
    case 'predictions': return describePrediction(row, lookups)
    case 'bonus_predictions': return describeBonus(row)
    case 'bonus_results': return describeBonusResults(row)
    case 'pools': return describePool(row)
    case 'pool_memberships': return describeMembership(row, lookups)
    case 'pool_payments': return describePayment(row, lookups)
    case 'profiles': return describeProfile(row, lookups)
    case 'matches': return describeMatch(row, lookups)
    case 'settings': return describeSettings(row)
    default: return `Ändring i ${row.table_name}`
  }
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; action?: string; limit?: string }>
}) {
  const params = await searchParams
  const tableFilter = params.table || ''
  const actionFilter = params.action || ''
  const limit = Math.min(parseInt(params.limit || '200', 10) || 200, 1000)

  const supabase = await createClient()
  // Admin-klient för matches/pools så RLS aldrig kan blockera kontextlookups
  const admin = createAdminClient()

  const [
    { data: auditData, error },
    { data: matchesRaw },
    { data: poolsRaw },
  ] = await Promise.all([
    (() => {
      let q = supabase
        .from('audit_log_readable')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(limit)
      if (tableFilter) q = q.eq('table_name', tableFilter)
      if (actionFilter) q = q.eq('action', actionFilter)
      return q
    })(),
    admin
      .from('matches')
      .select('id, match_number, home_placeholder, away_placeholder, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)'),
    admin.from('pools').select('id, name'),
  ])

  const rows = (auditData ?? []) as AuditRow[]

  const lookups: Lookups = {
    matches: new Map(
      ((matchesRaw ?? []) as Array<{
        id: number; match_number: number;
        home_placeholder: string | null; away_placeholder: string | null;
        home_team: { name: string } | { name: string }[] | null
        away_team: { name: string } | { name: string }[] | null
      }>).map(m => {
        const ht = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team
        const at = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team
        return [m.id, {
          id: m.id,
          match_number: m.match_number,
          home_team_name: ht?.name ?? null,
          away_team_name: at?.name ?? null,
          home_placeholder: m.home_placeholder,
          away_placeholder: m.away_placeholder,
        }]
      })
    ),
    pools: new Map(((poolsRaw ?? []) as Array<{ id: number; name: string }>).map(p => [p.id, p.name])),
    teams: new Map(),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity size={22} className="text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Audit-log</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Alla ändringar i datan – senaste {limit} händelser
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-4 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>
          {error.message}
        </div>
      )}

      {/* Filter */}
      <div className="rounded-xl p-4 flex flex-wrap items-center gap-3"
        style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <Filter size={16} className="text-gray-500" />

        <div className="flex flex-wrap gap-2 flex-1">
          <FilterPill
            label="Alla tabeller"
            active={!tableFilter}
            href={buildHref({ table: '', action: actionFilter })}
          />
          {Object.entries(TABLE_LABELS).map(([k, v]) => (
            <FilterPill
              key={k}
              label={v}
              active={tableFilter === k}
              href={buildHref({ table: k, action: actionFilter })}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <FilterPill
            label="Alla händelser"
            active={!actionFilter}
            href={buildHref({ table: tableFilter, action: '' })}
          />
          {(['insert', 'update', 'delete'] as const).map(a => (
            <FilterPill
              key={a}
              label={ACTION_LABELS[a]}
              active={actionFilter === a}
              href={buildHref({ table: tableFilter, action: a })}
            />
          ))}
        </div>
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <div className="rounded-xl p-8 text-center text-gray-500"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          Inga händelser matchar filtret än.
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden divide-y"
          style={{ background: '#111827', border: '1px solid #1f2937', borderColor: '#1f2937' }}>
          {rows.map(r => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-start gap-3 flex-wrap">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded shrink-0"
                  style={{
                    background: ACTION_COLORS[r.action] ?? '#1f2937',
                    color: ACTION_TEXT_COLORS[r.action] ?? '#9ca3af',
                  }}
                >
                  {ACTION_LABELS[r.action] ?? r.action}
                </span>
                <span className="text-xs px-2 py-0.5 rounded shrink-0 text-gray-300"
                  style={{ background: '#1f2937' }}>
                  {TABLE_LABELS[r.table_name] ?? r.table_name}
                </span>
                <span className="text-xs text-gray-400 ml-auto shrink-0">
                  {format(new Date(r.occurred_at), 'd MMM HH:mm:ss', { locale: sv })}
                </span>
              </div>

              <div className="mt-1.5 text-sm text-white">
                {describe(r, lookups)}
              </div>

              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">
                  av {r.user_name ?? <span className="italic">System</span>}
                </span>
                <details className="ml-auto">
                  <summary className="text-[11px] text-gray-600 cursor-pointer hover:text-gray-400">
                    rådata
                  </summary>
                  <pre className="mt-2 p-3 rounded-lg text-[11px] text-gray-300 overflow-x-auto"
                    style={{ background: '#0f172a', border: '1px solid #1f2937' }}>
                    {JSON.stringify(r.changes, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        Visar de senaste {rows.length} händelserna.
      </p>
    </div>
  )
}

function buildHref({ table, action }: { table: string; action: string }) {
  const params = new URLSearchParams()
  if (table) params.set('table', table)
  if (action) params.set('action', action)
  const qs = params.toString()
  return qs ? `/admin/audit?${qs}` : '/admin/audit'
}

function FilterPill({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
        active
          ? 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/30'
          : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      {label}
    </Link>
  )
}
