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
  ExternalLink, AlertCircle, Crown,
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
}

export function LigaClient({ pool, meUserId, members, ranking, canManage }: Props) {
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
