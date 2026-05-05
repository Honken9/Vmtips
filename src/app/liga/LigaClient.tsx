'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { LeaderboardEntry, Pool } from '@/lib/types'
import {
  buildSwishUrl, buildSwishQrUrl, isValidSwishPhone,
} from '@/lib/swish'
import {
  PRESETS, calcPot, calcPayouts, formatKr, type PrizeDistribution, findPresetId,
} from '@/lib/payments'
import {
  Users, Trophy, CheckCircle, Loader2, Save, Settings, Wallet, QrCode,
  ExternalLink, AlertCircle, Crown, Plus, LogOut, Check,
} from 'lucide-react'

interface MemberRow {
  user_id: string
  display_name: string
  is_admin: boolean
  paid: boolean
  paid_at: string | null
  amount: number | null
}

interface Props {
  pool: Pool
  meUserId: string
  meDisplayName: string
  members: MemberRow[]
  ranking: LeaderboardEntry[]
  canManage: boolean
  allLigor: Pool[]
}

export function LigaClient({ pool, meUserId, members, ranking, canManage, allLigor }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const me = members.find(m => m.user_id === meUserId)
  const fee = pool.entry_fee ?? 0
  const distribution = pool.prize_distribution ?? { '1': 1.0 }

  const paidCount = members.filter(m => m.paid).length
  const { paidTotal, potentialTotal } = calcPot({
    entryFee: fee,
    paidCount,
    totalMembers: members.length,
  })
  const payouts = useMemo(
    () => calcPayouts({ totalPot: paidTotal, distribution, ranking }),
    [paidTotal, distribution, ranking]
  )

  // Swish-URL för min egen betalning
  const swishUrl = useMemo(() => {
    if (!fee || !pool.swish_phone) return null
    return buildSwishUrl({
      phone: pool.swish_phone,
      amount: fee,
      message: `${pool.name} – VM-Tips`,
    })
  }, [fee, pool.swish_phone, pool.name])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users size={22} className="text-emerald-400" />
          {pool.name}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Invite-kod: <span className="font-mono text-white">{pool.invite_code}</span>
          {' · '}
          {members.length} medlemmar
        </p>
      </div>

      {/* Mina ligor – välj aktiv */}
      <LigaSelector
        activePoolId={pool.id}
        allLigor={allLigor}
        meUserId={meUserId}
        onChanged={() => router.refresh()}
        supabase={supabase}
      />

      {/* Pott-sammanfattning – visas bara om avgift är satt */}
      {fee > 0 && (
        <PotSummary
          fee={fee}
          paidCount={paidCount}
          totalMembers={members.length}
          paidTotal={paidTotal}
          potentialTotal={potentialTotal}
          payouts={payouts}
        />
      )}

      {/* Min betalning – visas om avgift > 0 OCH jag inte är skapare/admin */}
      {fee > 0 && me && !me.paid && (
        <MyPayment
          fee={fee}
          poolName={pool.name}
          recipient={pool.swish_recipient_name ?? null}
          swishUrl={swishUrl}
          markedByMe={!canManage}
          meUserId={meUserId}
          poolId={pool.id}
          onChanged={() => router.refresh()}
        />
      )}
      {fee > 0 && me?.paid && (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)',
          }}
        >
          <CheckCircle size={20} className="text-green-400" />
          <div>
            <div className="text-sm font-semibold text-green-400">Du har betalt</div>
            <div className="text-xs text-gray-400">
              {me.amount ? formatKr(me.amount) : formatKr(fee)}
              {me.paid_at && ` · ${new Date(me.paid_at).toLocaleDateString('sv-SE')}`}
            </div>
          </div>
        </div>
      )}

      {/* Spelform & lås – bara för skapare/admin */}
      {canManage && (
        <LigaModePicker pool={pool} onChanged={() => router.refresh()} />
      )}

      {/* Inställningar – bara för skapare/admin */}
      {canManage && (
        <LigaSettings pool={pool} onSaved={() => router.refresh()} />
      )}

      {/* Medlemmar + betalningsstatus */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Wallet size={14} className="text-emerald-400" />
          {fee > 0 ? 'Medlemmar & betalningar' : 'Medlemmar'}
        </h2>
        <MemberList
          members={members}
          poolId={pool.id}
          fee={fee}
          canManage={canManage}
          meUserId={meUserId}
          onChanged={() => router.refresh()}
          supabase={supabase}
        />
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function LigaSelector({
  activePoolId,
  allLigor,
  meUserId,
  onChanged,
  supabase,
}: {
  activePoolId: number
  allLigor: Pool[]
  meUserId: string
  onChanged: () => void
  supabase: ReturnType<typeof createClient>
}) {
  const [busy, setBusy] = useState<number | null>(null)
  const isOnlyOne = allLigor.length <= 1

  async function switchTo(poolId: number) {
    if (poolId === activePoolId) return
    setBusy(poolId)
    await supabase.from('profiles').update({ pool_id: poolId }).eq('id', meUserId)
    setBusy(null)
    onChanged()
  }

  async function leave(p: Pool) {
    const ok = window.confirm(
      `Lämna ligan "${p.name}"? Du kommer behöva en ny invite-kod för att gå med igen.`
    )
    if (!ok) return
    setBusy(p.id)
    await supabase
      .from('pool_memberships')
      .delete()
      .eq('pool_id', p.id)
      .eq('user_id', meUserId)
    if (p.id === activePoolId) {
      const next = allLigor.find(l => l.id !== p.id)
      await supabase
        .from('profiles')
        .update({ pool_id: next?.id ?? null })
        .eq('id', meUserId)
    }
    setBusy(null)
    onChanged()
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Users size={14} className="text-emerald-400" />
        Mina ligor
        {!isOnlyOne && (
          <span className="text-xs text-gray-500 font-normal normal-case tracking-normal">
            (klicka för att byta aktiv)
          </span>
        )}
      </h2>
      <div className="rounded-xl overflow-hidden divide-y" style={{ background: '#111827', border: '1px solid #1f2937', borderColor: '#1f2937' }}>
        {allLigor.map(p => {
          const isActive = p.id === activePoolId
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                isActive ? 'bg-emerald-400/5' : 'hover:bg-white/5'
              }`}
            >
              <button
                onClick={() => switchTo(p.id)}
                disabled={busy === p.id || isActive}
                className="flex-1 flex items-center gap-3 min-w-0 text-left disabled:cursor-default"
              >
                <div className={`w-5 h-5 shrink-0 flex items-center justify-center ${isActive ? 'text-emerald-400' : 'text-transparent'}`}>
                  {busy === p.id ? <Loader2 size={14} className="animate-spin text-gray-400" /> : <Check size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${isActive ? 'text-emerald-400' : 'text-white'}`}>
                    {p.name}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {p.invite_code}
                  </div>
                </div>
              </button>
              <button
                onClick={() => leave(p)}
                disabled={busy === p.id}
                title="Lämna ligan"
                className="text-gray-500 hover:text-red-400 transition-colors p-2 rounded disabled:opacity-40"
              >
                <LogOut size={14} />
              </button>
            </div>
          )
        })}
        <Link
          href="/select-pool"
          className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-emerald-400 hover:bg-emerald-400/5 transition-colors"
        >
          <Plus size={16} />
          Lägg till en ny liga
        </Link>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────
function PotSummary({
  fee, paidCount, totalMembers, paidTotal, potentialTotal, payouts,
}: {
  fee: number
  paidCount: number
  totalMembers: number
  paidTotal: number
  potentialTotal: number
  payouts: ReturnType<typeof calcPayouts>
}) {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 space-y-4"
      style={{
        background: 'linear-gradient(135deg, #0c2823 0%, #14202e 50%, #0a3d2a 100%)',
        border: '1px solid #1f2937',
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
            Prispott
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white tabular-nums">
            {formatKr(paidTotal)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {paidCount} av {totalMembers} har betalt · max {formatKr(potentialTotal)}
            {' · '}
            {formatKr(fee)} per spelare
          </div>
        </div>
        <Trophy size={48} className="text-amber-400 opacity-60" />
      </div>

      {payouts.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {payouts.map(p => {
            const medals = ['🥇', '🥈', '🥉']
            return (
              <div
                key={p.place}
                className="rounded-lg px-3 py-2"
                style={{
                  background: p.place === 1 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${p.place === 1 ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">{medals[p.place - 1] ?? `#${p.place}`}</span>
                  <span className={`text-base font-bold ${p.place === 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {formatKr(p.amount)}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 mt-1 truncate">
                  {p.user
                    ? `${p.user.display_name} · ${p.user.total_points}p`
                    : `Andel: ${(p.share * 100).toFixed(0)}%`}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function MyPayment({
  fee, poolName, recipient, swishUrl, markedByMe, meUserId, poolId, onChanged,
}: {
  fee: number
  poolName: string
  recipient: string | null
  swishUrl: string | null
  markedByMe: boolean
  meUserId: string
  poolId: number
  onChanged: () => void
}) {
  const supabase = createClient()
  const [showQr, setShowQr] = useState(false)
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function markPaid() {
    setMarking(true)
    setError(null)
    const { error } = await supabase
      .from('pool_payments')
      .upsert(
        {
          pool_id: poolId,
          user_id: meUserId,
          paid: true,
          paid_at: new Date().toISOString(),
          marked_by_user_id: meUserId,
          amount: fee,
        },
        { onConflict: 'pool_id,user_id' }
      )
    setMarking(false)
    if (error) {
      // Om medlem inte får uppdatera (RLS) → visa meddelande
      setError('Du kan inte själv markera som betald – be liga-skaparen verifiera och markera.')
      return
    }
    onChanged()
  }

  return (
    <div
      className="rounded-xl p-5 space-y-3"
      style={{ background: '#111827', border: '1px solid rgba(245,158,11,0.25)' }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <AlertCircle size={14} />
            Du har inte betalt
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Avgift: <span className="text-white font-semibold">{formatKr(fee)}</span>
            {recipient && ` · till ${recipient}`}
          </div>
        </div>
      </div>

      {swishUrl ? (
        <>
          <div className="flex flex-wrap gap-2">
            <a
              href={swishUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <ExternalLink size={14} />
              Betala via Swish
            </a>
            <button
              onClick={() => setShowQr(s => !s)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-300"
              style={{ background: '#1f2937', border: '1px solid #374151' }}
            >
              <QrCode size={14} />
              {showQr ? 'Dölj QR' : 'Visa QR'}
            </button>
          </div>
          {showQr && (
            <div className="flex flex-col items-center gap-2 pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildSwishQrUrl(swishUrl, 220)}
                alt="QR-kod till Swish-betalning"
                width={220}
                height={220}
                className="rounded-lg"
              />
              <p className="text-xs text-gray-500">Skanna med Swish-appen</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-500">
          Liga-skaparen har inte fyllt i Swish-uppgifter än.
        </p>
      )}

      {markedByMe && swishUrl && (
        <button
          onClick={markPaid}
          disabled={marking}
          className="text-xs text-gray-400 hover:text-white underline self-start disabled:opacity-50"
        >
          {marking ? 'Sparar…' : 'Jag har betalt – meddela liga-skaparen'}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function LigaModePicker({ pool, onChanged }: { pool: Pool; onChanged: () => void }) {
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mode = (pool.tournament_mode ?? 'B') as 'A' | 'B' | 'C'
  const groupLocked = pool.mode_a_global_lock === true

  async function setMode(next: 'A' | 'B' | 'C') {
    if (next === mode) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('pools')
      .update({ tournament_mode: next })
      .eq('id', pool.id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    onChanged()
  }

  async function lockGroup() {
    if (!confirm(
      mode === 'C'
        ? 'Lås alla deltagares gruppspels-tips? Slutspels-tips kan fortfarande ändras tills avspark.'
        : 'Lås ALLA deltagares tips? Detta går inte att ångra.'
    )) return
    setBusy(true)
    setError(null)

    // Hämta alla användare i ligan
    const { data: members } = await supabase
      .from('pool_memberships')
      .select('user_id')
      .eq('pool_id', pool.id)

    const onlyGroup = mode === 'C'
    for (const m of members ?? []) {
      await supabase.rpc('lock_user_tips', {
        p_user_id: (m as { user_id: string }).user_id,
        p_only_group: onlyGroup,
      })
    }

    const { error: err } = await supabase
      .from('pools')
      .update({ mode_a_global_lock: true })
      .eq('id', pool.id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    onChanged()
  }

  const options: Array<{
    key: 'A' | 'B' | 'C'
    title: string
    desc: string
    icon: string
  }> = [
    {
      key: 'A',
      title: 'Läge A – Allt på en gång',
      desc: 'Deltagarna tippar alla matcher och lämnar in. Tips kan inte ändras efter inlämning.',
      icon: '📋',
    },
    {
      key: 'B',
      title: 'Läge B – Löpande per match',
      desc: 'Deltagarna tippar inför varje match. Tips låses automatiskt vid avspark.',
      icon: '⚡',
    },
    {
      key: 'C',
      title: 'Läge C – Hybrid',
      desc: 'Gruppspelet tippas i förväg som Läge A. När gruppspelet är klart tippas slutspelet löpande som Läge B.',
      icon: '🎯',
    },
  ]

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Settings size={14} className="text-emerald-400" />
        Spelform – {pool.name}
      </h2>
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: '#111827', border: '1px solid #1f2937' }}
      >
        <div className="grid gap-2">
          {options.map(opt => {
            const active = opt.key === mode
            return (
              <button
                key={opt.key}
                onClick={() => setMode(opt.key)}
                disabled={busy}
                className={`text-left p-3 rounded-xl border-2 transition-all disabled:opacity-60 ${
                  active
                    ? 'border-emerald-400/60 bg-emerald-400/5'
                    : 'border-transparent hover:border-white/10'
                }`}
                style={!active ? { background: '#1f2937' } : undefined}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{opt.icon}</span>
                  <span className="font-semibold text-white text-sm">{opt.title}</span>
                  {active && (
                    <span className="ml-auto text-xs text-emerald-400 font-medium">Aktivt</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 ml-7">{opt.desc}</p>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="text-xs text-red-400 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            {error}
          </div>
        )}

        {/* Globalt lås (relevant för A och C) */}
        {(mode === 'A' || mode === 'C') && (
          <div className="rounded-xl p-4"
            style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <div className="flex items-center gap-2 text-red-400 text-sm font-semibold mb-2">
              <AlertCircle size={14} />
              {mode === 'C' ? 'Lås gruppspels-tips' : 'Globalt lås'}
            </div>
            <p className="text-xs text-gray-400 mb-3">
              {mode === 'C'
                ? 'Lås alla deltagares gruppspels-tips när gruppspelet startar. Slutspelet kan fortfarande tippas inför varje match.'
                : 'Lås ALLA deltagares tips på en gång när turneringen börjar. Kan inte ångras.'}
            </p>
            {groupLocked ? (
              <div className="flex items-center gap-2 text-green-400 text-xs">
                <CheckCircle size={14} />
                {mode === 'C' ? 'Gruppspels-tips är låsta' : 'Alla tips är låsta'}
              </div>
            ) : (
              <button
                onClick={lockGroup}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white text-sm transition-all disabled:opacity-50"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: '#ef4444',
                }}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <AlertCircle size={14} />}
                {mode === 'C' ? 'Lås gruppspels-tips nu' : 'Lås alla tips nu'}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────
function LigaSettings({ pool, onSaved }: { pool: Pool; onSaved: () => void }) {
  const supabase = createClient()
  const [fee, setFee] = useState(String(pool.entry_fee ?? 0))
  const [recipient, setRecipient] = useState(pool.swish_recipient_name ?? '')
  const [phone, setPhone] = useState(pool.swish_phone ?? '')
  const [presetId, setPresetId] = useState<string>(
    findPresetId(pool.prize_distribution ?? { '1': 1.0 }) ?? 'winner-takes-all'
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)

    const feeNum = Math.max(0, parseInt(fee, 10) || 0)
    if (phone && !isValidSwishPhone(phone)) {
      setSaving(false)
      setMessage({ type: 'err', text: 'Ogiltigt Swish-nummer (svenskt mobilnummer krävs)' })
      return
    }
    const dist: PrizeDistribution =
      PRESETS.find(p => p.id === presetId)?.dist ?? { '1': 1.0 }

    const { error } = await supabase
      .from('pools')
      .update({
        entry_fee: feeNum,
        swish_recipient_name: recipient.trim() || null,
        swish_phone: phone.trim() || null,
        prize_distribution: dist,
      })
      .eq('id', pool.id)

    setSaving(false)
    if (error) {
      setMessage({ type: 'err', text: error.message })
      return
    }
    setMessage({ type: 'ok', text: 'Sparat' })
    setTimeout(() => setMessage(null), 3000)
    onSaved()
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Settings size={14} className="text-emerald-400" />
        Liga-inställningar (bara du som skapare ser detta)
      </h2>
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: '#111827', border: '1px solid #1f2937' }}
      >
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Avgift per spelare (kr)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={fee}
              onChange={e => setFee(e.target.value)}
              placeholder="100"
              className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              style={{ background: '#1f2937', border: '1px solid #374151' }}
            />
          </Field>
          <Field label="Mottagarens namn">
            <input
              type="text"
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              placeholder="t.ex. Anna Ek"
              maxLength={60}
              className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              style={{ background: '#1f2937', border: '1px solid #374151' }}
            />
          </Field>
          <Field label="Swish-nummer">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="070-123 45 67"
              className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              style={{ background: '#1f2937', border: '1px solid #374151' }}
            />
          </Field>
        </div>

        <Field label="Prisfördelning">
          <select
            value={presetId}
            onChange={e => setPresetId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
          >
            {PRESETS.map(p => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black gold-gradient disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Spara inställningar
          </button>
          {message && (
            <span
              className={`text-xs ${
                message.type === 'ok' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {message.text}
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Tips: lämna avgift på 0 om ligan ska köras utan pott. Inget visas då för medlemmarna.
        </p>
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function MemberList({
  members, poolId, fee, canManage, meUserId, onChanged, supabase,
}: {
  members: MemberRow[]
  poolId: number
  fee: number
  canManage: boolean
  meUserId: string
  onChanged: () => void
  supabase: ReturnType<typeof createClient>
}) {
  const [busy, setBusy] = useState<string | null>(null)

  async function toggle(member: MemberRow) {
    setBusy(member.user_id)
    const newPaid = !member.paid
    const { error } = await supabase
      .from('pool_payments')
      .upsert(
        {
          pool_id: poolId,
          user_id: member.user_id,
          paid: newPaid,
          paid_at: newPaid ? new Date().toISOString() : null,
          marked_by_user_id: meUserId,
          amount: newPaid ? fee : null,
        },
        { onConflict: 'pool_id,user_id' }
      )
    setBusy(null)
    if (!error) onChanged()
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
      {members.map((m, i) => (
        <div
          key={m.user_id}
          className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
          style={{ borderColor: '#1f2937', background: '#111827' }}
        >
          <Link
            href={`/spelare/${m.user_id}`}
            className="flex-1 min-w-0 flex items-center gap-2 hover:underline"
          >
            <span className="text-sm font-medium text-white truncate">
              {m.display_name}
            </span>
            {m.is_admin && <Crown size={12} className="text-amber-400 shrink-0" />}
          </Link>

          {fee > 0 && (
            <>
              {m.paid ? (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle size={14} />
                  <span className="hidden sm:inline">
                    Betalt
                    {m.paid_at &&
                      ` ${new Date(m.paid_at).toLocaleDateString('sv-SE')}`}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-gray-500">Inte betald</span>
              )}

              {canManage && (
                <button
                  onClick={() => toggle(m)}
                  disabled={busy === m.user_id}
                  className="text-xs px-2 py-1 rounded transition-colors disabled:opacity-40"
                  style={{
                    background: m.paid ? '#1f2937' : 'rgba(34,197,94,0.15)',
                    color: m.paid ? '#9ca3af' : '#4ade80',
                    border: `1px solid ${m.paid ? '#374151' : 'rgba(34,197,94,0.3)'}`,
                  }}
                >
                  {busy === m.user_id ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : m.paid ? (
                    'Ångra'
                  ) : (
                    'Markera betald'
                  )}
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
