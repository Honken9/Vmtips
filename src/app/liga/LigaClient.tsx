'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { LeaderboardEntry, Pool, PoolMemberTag } from '@/lib/types'
import {
  buildSwishUrl, isValidSwishPhone,
} from '@/lib/swish'
import {
  PRESETS, calcPot, calcPayouts, formatKr, type PrizeDistribution, findPresetId,
} from '@/lib/payments'
import {
  Users, Trophy, CheckCircle, Loader2, Save, Settings, Wallet, QrCode,
  AlertCircle, Crown, Plus, LogOut, Check,
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
  tags: PoolMemberTag[]
}

export function LigaClient({ pool, meUserId, members, ranking, canManage, allLigor, tags }: Props) {
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

  // Swish-URL för min egen betalning (klickbar knapp på mobil)
  const swishUrl = useMemo(() => {
    if (!fee || !pool.swish_phone) return null
    return buildSwishUrl({
      phone: pool.swish_phone,
      amount: fee,
      message: `${pool.name} – VM-Tips`,
    })
  }, [fee, pool.swish_phone, pool.name])

  // QR-bild via vår server-route som proxar Swishs officiella QR-API
  const swishQrSrc = useMemo(() => {
    if (!fee || !pool.swish_phone) return null
    const params = new URLSearchParams({
      phone: pool.swish_phone,
      amount: String(fee),
      message: `${pool.name} – VM-Tips`,
      size: '300',
    })
    return `/api/swish-qr?${params.toString()}`
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
          swishQrSrc={swishQrSrc}
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
          tags={tags}
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
        <span className="text-xs text-gray-500 font-normal normal-case tracking-normal">
          ({allLigor.length} st – klicka för att byta aktiv)
        </span>
      </h2>
      <div className="rounded-xl overflow-hidden divide-y" style={{ background: '#111827', border: '1px solid #1f2937', borderColor: '#1f2937' }}>
        {allLigor.map(p => {
          const isActive = p.id === activePoolId
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                isActive ? 'bg-emerald-400/10 border-l-4 border-l-emerald-400' : 'hover:bg-white/5 border-l-4 border-l-transparent'
              }`}
            >
              <button
                onClick={() => switchTo(p.id)}
                disabled={busy === p.id || isActive}
                className="flex-1 flex items-center gap-3 min-w-0 text-left disabled:cursor-default"
                title={isActive ? 'Aktiv liga' : 'Klicka för att byta till denna liga'}
              >
                <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${
                  isActive ? 'bg-emerald-400 text-black' : 'border border-gray-600 text-gray-600'
                }`}>
                  {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : isActive ? <Check size={14} strokeWidth={3} /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`text-sm font-semibold truncate ${isActive ? 'text-emerald-400' : 'text-white'}`}>
                      {p.name}
                    </div>
                    {isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-400">
                        Aktiv
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">
                    Invite: {p.invite_code}
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
  fee, poolName, recipient, swishUrl, swishQrSrc, markedByMe, meUserId, poolId, onChanged,
}: {
  fee: number
  poolName: string
  recipient: string | null
  swishUrl: string | null
  swishQrSrc: string | null
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
          <button
            onClick={() => setShowQr(s => !s)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black transition-all"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            <QrCode size={14} />
            {showQr ? 'Dölj QR-kod' : 'Betala via Swish – Visa QR-kod'}
          </button>
          {showQr && swishQrSrc && (
            <div className="flex flex-col items-center gap-2 pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={swishQrSrc}
                alt="QR-kod till Swish-betalning"
                width={240}
                height={240}
                className="rounded-lg bg-white p-2"
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
// Färgpalett som taggar kan välja mellan. Tailwind-namn + hex för rendering.
const TAG_COLORS: { key: string; hex: string; label: string }[] = [
  { key: 'emerald', hex: '#10b981', label: 'Grön' },
  { key: 'sky', hex: '#0ea5e9', label: 'Blå' },
  { key: 'rose', hex: '#f43f5e', label: 'Rosa' },
  { key: 'amber', hex: '#f59e0b', label: 'Gul' },
  { key: 'violet', hex: '#8b5cf6', label: 'Lila' },
  { key: 'cyan', hex: '#06b6d4', label: 'Cyan' },
  { key: 'lime', hex: '#84cc16', label: 'Lime' },
  { key: 'pink', hex: '#ec4899', label: 'Skär' },
  { key: 'orange', hex: '#f97316', label: 'Orange' },
  { key: 'slate', hex: '#94a3b8', label: 'Grå' },
]

function colorHex(key: string | null | undefined): string | null {
  if (!key) return null
  return TAG_COLORS.find(c => c.key === key)?.hex ?? null
}

function MemberList({
  members, poolId, fee, canManage, meUserId, tags, onChanged, supabase,
}: {
  members: MemberRow[]
  poolId: number
  fee: number
  canManage: boolean
  meUserId: string
  tags: PoolMemberTag[]
  onChanged: () => void
  supabase: ReturnType<typeof createClient>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const tagByUser = new Map(tags.map(t => [t.user_id, t]))

  async function saveTag(userId: string, color: string | null, department: string | null) {
    setBusy(`tag-${userId}`)
    await supabase
      .from('pool_member_tags')
      .upsert(
        {
          pool_id: poolId,
          user_id: userId,
          color: color ?? null,
          department: department?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'pool_id,user_id' }
      )
    setBusy(null)
    setEditingTag(null)
    onChanged()
  }

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
      {members.map((m, i) => {
        const tag = tagByUser.get(m.user_id)
        const canEditTag = canManage || m.user_id === meUserId
        const dotHex = colorHex(tag?.color)
        return (
        <div key={m.user_id}>
        <div
          className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
          style={{ borderColor: '#1f2937', background: '#111827' }}
        >
          {/* Färgprick */}
          <button
            type="button"
            onClick={() => canEditTag && setEditingTag(editingTag === m.user_id ? null : m.user_id)}
            disabled={!canEditTag}
            title={canEditTag ? 'Redigera färg + avdelning' : tag?.department ?? ''}
            className="shrink-0 w-3.5 h-3.5 rounded-full transition-transform disabled:cursor-default"
            style={{
              background: dotHex ?? 'transparent',
              border: `1px solid ${dotHex ? 'transparent' : '#374151'}`,
            }}
            aria-label="Färg-tagg"
          />

          <Link
            href={`/spelare/${m.user_id}`}
            className="flex-1 min-w-0 flex items-center gap-2 hover:underline"
          >
            <span className="text-sm font-medium text-white truncate">
              {m.display_name}
            </span>
            {m.is_admin && <Crown size={12} className="text-amber-400 shrink-0" />}
            {tag?.department && (
              <span className="text-[11px] px-1.5 py-0.5 rounded shrink-0 text-gray-300"
                style={{ background: '#1f2937', border: '1px solid #374151' }}>
                {tag.department}
              </span>
            )}
          </Link>

          {canEditTag && (
            <button
              type="button"
              onClick={() => setEditingTag(editingTag === m.user_id ? null : m.user_id)}
              className="text-xs text-gray-500 hover:text-emerald-400 shrink-0"
              title="Redigera tagg"
            >
              {editingTag === m.user_id ? '✕' : '✎'}
            </button>
          )}

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

        {/* Tag-editor: visas inline under raden när användaren klickat redigera */}
        {editingTag === m.user_id && canEditTag && (
          <TagEditor
            currentColor={tag?.color ?? null}
            currentDepartment={tag?.department ?? null}
            busy={busy === `tag-${m.user_id}`}
            onSave={(color, dept) => saveTag(m.user_id, color, dept)}
            onCancel={() => setEditingTag(null)}
          />
        )}
        </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
function TagEditor({
  currentColor, currentDepartment, busy, onSave, onCancel,
}: {
  currentColor: string | null
  currentDepartment: string | null
  busy: boolean
  onSave: (color: string | null, department: string | null) => void
  onCancel: () => void
}) {
  const [color, setColor] = useState<string | null>(currentColor)
  const [department, setDepartment] = useState<string>(currentDepartment ?? '')
  return (
    <div className="px-4 py-3 space-y-3 border-t"
      style={{ background: '#0f172a', borderColor: '#1f2937' }}>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Färg</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setColor(null)}
            className={`w-7 h-7 rounded-full transition-transform ${color === null ? 'ring-2 ring-emerald-400 scale-110' : ''}`}
            style={{ background: 'transparent', border: '1px dashed #374151' }}
            title="Ingen färg"
            aria-label="Ingen färg"
          />
          {TAG_COLORS.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColor(c.key)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c.key ? 'ring-2 ring-white scale-110' : ''}`}
              style={{ background: c.hex }}
              title={c.label}
              aria-label={c.label}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Avdelning</div>
        <input
          type="text"
          value={department}
          onChange={e => setDepartment(e.target.value)}
          maxLength={30}
          placeholder="t.ex. Försäljning, Kompisar, Familj"
          className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          style={{ background: '#1f2937', border: '1px solid #374151' }}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(color, department)}
          disabled={busy}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-black gold-gradient disabled:opacity-40"
        >
          {busy ? 'Sparar…' : 'Spara'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white"
          style={{ background: '#1f2937', border: '1px solid #374151' }}
        >
          Avbryt
        </button>
      </div>
    </div>
  )
}
