'use client'

import { useMemo } from 'react'
import { Flag } from '@/components/Flag'
import type { Match, Team, Prediction } from '@/lib/types'
import { resolveBracket } from '@/lib/bracket'
import { Crown, Trophy } from 'lucide-react'

interface Props {
  matches: Match[]
  teams: Team[]
  predictions: Prediction[]
  displayName?: string
}

interface MatchCardData {
  match: Match | undefined
  home: Team | null
  away: Team | null
}

// Indexar in i bracket-arrays för vänster vs höger sida av trädet
// Härlett från R16_BRACKET / QF_BRACKET / SF_BRACKET i standings.ts:
//   SF[0] = QF[0,1] = R16[0,1,2,3] = R32[0,1,2,3,6,7,8,9]
//   SF[1] = QF[2,3] = R16[4,5,6,7] = R32[4,5,10,11,12,13,14,15]
// Ordning vald så att R16-paret står grafiskt bredvid de R32-matcher
// det är uppbyggt från (paret R32[i], R32[i+6] etc).
const LEFT_R32  = [0, 6, 1, 7, 2, 8, 3, 9]
const RIGHT_R32 = [4, 10, 5, 11, 12, 13, 14, 15]
const LEFT_R16  = [0, 1, 2, 3]
const RIGHT_R16 = [4, 5, 6, 7]
const LEFT_QF   = [0, 1]
const RIGHT_QF  = [2, 3]
const LEFT_SF   = [0]
const RIGHT_SF  = [1]

export function BracketView({ matches, teams, predictions, displayName }: Props) {
  const b = useMemo(() => resolveBracket(matches, teams, predictions), [matches, teams, predictions])
  const predByMatch = useMemo(() => {
    const map: Record<number, { home: number | null; away: number | null }> = {}
    predictions.forEach(p => {
      map[p.match_id] = { home: p.pred_home, away: p.pred_away }
    })
    return map
  }, [predictions])

  const r32Cards: MatchCardData[] = b.r32Matches.map((m, i) => ({ match: m, home: b.r32Teams[i]?.[0], away: b.r32Teams[i]?.[1] }))
  const r16Cards: MatchCardData[] = b.r16Matches.map((m, i) => ({ match: m, home: b.r16Teams[i]?.[0], away: b.r16Teams[i]?.[1] }))
  const qfCards : MatchCardData[] = b.qfMatches .map((m, i) => ({ match: m, home: b.qfTeams [i]?.[0], away: b.qfTeams [i]?.[1] }))
  const sfCards : MatchCardData[] = b.sfMatches .map((m, i) => ({ match: m, home: b.sfTeams [i]?.[0], away: b.sfTeams [i]?.[1] }))
  const finalCard: MatchCardData = { match: b.finalMatch, home: b.finalTeams[0], away: b.finalTeams[1] }
  const thirdCard: MatchCardData = { match: b.thirdMatch, home: b.thirdTeams[0], away: b.thirdTeams[1] }

  const pick = (cards: MatchCardData[], idxs: number[]) => idxs.map(i => cards[i]).filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Champion-banner */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{
          background: 'linear-gradient(135deg, #1a1408 0%, #14202e 50%, #2a1f08 100%)',
          border: '1px solid rgba(245,158,11,0.3)',
        }}
      >
        <Trophy size={32} className="text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
            {displayName ? `${displayName}s VM-vinnare` : 'VM-vinnare enligt dina tips'}
          </div>
          {b.champion ? (
            <div className="flex items-center gap-2 mt-1">
              <Flag emoji={b.champion.flag} name={b.champion.name} width={28} height={20} />
              <span className="text-2xl font-bold text-white">{b.champion.name}</span>
            </div>
          ) : (
            <div className="text-sm text-gray-500 mt-1 italic">
              Tippa hela slutspelet för att se vem som vinner VM
            </div>
          )}
        </div>
      </div>

      {/* Två-sidigt slutspels-träd */}
      <div className="overflow-x-auto pb-4 -mx-2 px-2">
        <div className="flex gap-2 sm:gap-3 min-w-max items-stretch">
          {/* VÄNSTER SIDA: matar in i SF[0] */}
          <Round title="16-delar" cards={pick(r32Cards, LEFT_R32)} preds={predByMatch} />
          <Round title="Åttondelar" cards={pick(r16Cards, LEFT_R16)} preds={predByMatch} />
          <Round title="Kvart" cards={pick(qfCards, LEFT_QF)} preds={predByMatch} />
          <Round title="Semi" cards={pick(sfCards, LEFT_SF)} preds={predByMatch} />

          {/* MITTEN: Final + Brons */}
          <CenterColumn final={finalCard} third={thirdCard} preds={predByMatch} />

          {/* HÖGER SIDA: matar in i SF[1] (samma rundor men i omvänd ordning) */}
          <Round title="Semi" cards={pick(sfCards, RIGHT_SF)} preds={predByMatch} mirrored />
          <Round title="Kvart" cards={pick(qfCards, RIGHT_QF)} preds={predByMatch} mirrored />
          <Round title="Åttondelar" cards={pick(r16Cards, RIGHT_R16)} preds={predByMatch} mirrored />
          <Round title="16-delar" cards={pick(r32Cards, RIGHT_R32)} preds={predByMatch} mirrored />
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Slutspels-trädet bygger på dina egna tips. Justera ett resultat på{' '}
        <a href="/tips" className="text-emerald-400 hover:underline">Mina tips</a>{' '}
        så uppdateras trädet direkt.
      </p>
    </div>
  )
}

function Round({
  title,
  cards,
  preds,
  mirrored,
}: {
  title: string
  cards: MatchCardData[]
  preds: Record<number, { home: number | null; away: number | null }>
  mirrored?: boolean
}) {
  return (
    <div className="flex flex-col min-w-[160px] sm:min-w-[180px]">
      <h3 className={`text-[11px] uppercase tracking-wider text-center font-bold mb-3 text-gray-400 ${mirrored ? 'text-right pr-1' : 'text-left pl-1'}`}>
        {title}
      </h3>
      <div className="flex-1 flex flex-col justify-around gap-3">
        {cards.map((c, i) => (
          <BracketMatchCard key={c?.match?.id ?? `slot-${i}`} card={c} pred={c?.match ? preds[c.match.id] : undefined} mirrored={mirrored} />
        ))}
      </div>
    </div>
  )
}

function CenterColumn({
  final,
  third,
  preds,
}: {
  final: MatchCardData
  third: MatchCardData
  preds: Record<number, { home: number | null; away: number | null }>
}) {
  return (
    <div className="flex flex-col items-center justify-center min-w-[180px] sm:min-w-[200px] px-1 sm:px-2 gap-4">
      <h3 className="text-[11px] uppercase tracking-wider text-center font-bold text-amber-400">
        Final
      </h3>
      <div className="w-full">
        <BracketMatchCard card={final} pred={final.match ? preds[final.match.id] : undefined} highlight />
      </div>
      <div className="w-full pt-2 border-t" style={{ borderColor: '#1f2937' }}>
        <h3 className="text-[11px] uppercase tracking-wider text-center font-bold text-gray-500 mb-2">
          Bronsmatch
        </h3>
        <BracketMatchCard card={third} pred={third.match ? preds[third.match.id] : undefined} muted />
      </div>
    </div>
  )
}

function BracketMatchCard({
  card,
  pred,
  highlight,
  muted,
  mirrored,
}: {
  card: MatchCardData
  pred?: { home: number | null; away: number | null }
  highlight?: boolean
  muted?: boolean
  mirrored?: boolean
}) {
  const homeName = card?.home?.name ?? card?.match?.home_placeholder ?? '?'
  const awayName = card?.away?.name ?? card?.match?.away_placeholder ?? '?'
  const homeUnknown = !card?.home
  const awayUnknown = !card?.away
  const ph = pred?.home ?? null
  const pa = pred?.away ?? null
  const haveBoth = ph != null && pa != null
  const homeWins = haveBoth && (ph as number) > (pa as number)
  const awayWins = haveBoth && (pa as number) > (ph as number)
  const isConfirmed = card?.match?.result_confirmed === true

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: muted ? '#0f172a' : '#111827',
        border: `1px solid ${highlight ? 'rgba(245,158,11,0.4)' : '#1f2937'}`,
        opacity: muted ? 0.85 : 1,
      }}
    >
      <TeamLine name={homeName} flag={card?.home?.flag} score={ph} wins={homeWins} unknown={homeUnknown} highlight={highlight} mirrored={mirrored} />
      <div className="border-t" style={{ borderColor: '#1f2937' }} />
      <TeamLine name={awayName} flag={card?.away?.flag} score={pa} wins={awayWins} unknown={awayUnknown} highlight={highlight} mirrored={mirrored} />
      {isConfirmed && card?.match?.home_score != null && (
        <div className="px-2 py-1 text-[10px] text-center font-medium"
          style={{ background: '#1a2233', color: '#9ca3af' }}>
          Slut: {card.match.home_score}–{card.match.away_score}
        </div>
      )}
    </div>
  )
}

function TeamLine({
  name,
  flag,
  score,
  wins,
  unknown,
  highlight,
  mirrored,
}: {
  name: string
  flag?: string
  score: number | null
  wins: boolean
  unknown: boolean
  highlight?: boolean
  mirrored?: boolean
}) {
  const winColor = highlight ? 'text-amber-400' : 'text-emerald-400'
  const winBg = wins ? (highlight ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.1)') : 'transparent'

  // Höger sida: spegelvänd så bocken visas mot mitten av trädet
  const flagEl = flag ? (
    <Flag emoji={flag} name={name} width={16} height={12} className="shrink-0" />
  ) : (
    <span className="w-4 h-3 rounded-sm shrink-0" style={{ background: '#1f2937' }} />
  )
  const nameEl = (
    <span
      className={`text-xs flex-1 truncate ${unknown ? 'text-gray-500 italic' : wins ? 'text-white font-semibold' : 'text-gray-300'}`}
      title={name}
    >
      {name}
    </span>
  )
  const crownEl = wins && <Crown size={10} className={winColor} />
  const scoreEl = (
    <span className={`text-sm font-bold tabular-nums ${score == null ? 'text-gray-600' : wins ? winColor : 'text-gray-400'}`}>
      {score ?? '–'}
    </span>
  )

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 transition-colors" style={{ background: winBg }}>
      {mirrored ? (
        <>
          {scoreEl}
          {crownEl}
          {nameEl}
          {flagEl}
        </>
      ) : (
        <>
          {flagEl}
          {nameEl}
          {crownEl}
          {scoreEl}
        </>
      )}
    </div>
  )
}
