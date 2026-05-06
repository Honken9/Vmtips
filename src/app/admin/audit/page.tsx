import { createClient } from '@/lib/supabase/server'
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
  let query = supabase
    .from('audit_log_readable')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (tableFilter) query = query.eq('table_name', tableFilter)
  if (actionFilter) query = query.eq('action', actionFilter)

  const { data, error } = await query
  const rows = (data ?? []) as AuditRow[]

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
                <span className="text-xs font-mono px-2 py-0.5 rounded shrink-0 text-gray-300"
                  style={{ background: '#1f2937' }}>
                  {TABLE_LABELS[r.table_name] ?? r.table_name}
                </span>
                {r.record_id && (
                  <span className="text-xs text-gray-500 font-mono shrink-0">
                    #{r.record_id.slice(0, 12)}
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto shrink-0">
                  {format(new Date(r.occurred_at), 'd MMM HH:mm:ss', { locale: sv })}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-white">
                  {r.user_name ?? <span className="text-gray-500 italic">System</span>}
                </span>
                {r.user_id && (
                  <span className="text-[10px] text-gray-600 font-mono">
                    {r.user_id.slice(0, 8)}
                  </span>
                )}
              </div>

              {r.changes && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
                    Visa ändring
                  </summary>
                  <pre className="mt-2 p-3 rounded-lg text-[11px] text-gray-300 overflow-x-auto"
                    style={{ background: '#0f172a', border: '1px solid #1f2937' }}>
                    {JSON.stringify(r.changes, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        Visar de senaste {rows.length} händelserna. Loggen sparas för alltid (manuell rensning efter 90 dagar rekommenderas vid stor volym).
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
