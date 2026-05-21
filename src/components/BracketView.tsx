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

      {/* Bracket */}
      <div className="overflow-x-auto pb-4 -mx-2 px-2">
        <div className="flex gap-3 min-w-max">
          <Round title="16-delsfinaler" cards={r32Cards} preds={predByMatch} />
          <Round title="Åttondelar" cards={r16Cards} preds={predByMatch} />
          <Round title="Kvart" cards={qfCards} preds={predByMatch} />
          <Round title="Semi" cards={sfCards} preds={predByMatch} />
          <Round title="Final" cards={[finalCard]} preds={predByMatch} highlight />
          <Round title="Brons" cards={[thirdCard]} preds={predByMatch} muted />
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Tabellen bygger på dina egna tips. Justera ett resultat på{' '}
        <a href="/tips" className="text-emerald-400 hover:underline">Mina tips</a>{' '}
        så uppdateras bracketen direkt.
      </p>
    </div>
  )
}

function Round({
  title,
  cards,
  preds,
  highlight,
  muted,
}: {
  title: string
  cards: MatchCardData[]
  preds: Record<number, { home: number | null; away: number | null }>
  highlight?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex flex-col min-w-[180px] sm:min-w-[200px]">
      <h3
        className={`text-[11px] uppercase tracking-wider text-center font-bold mb-3 ${highlight ? 'text-amber-400' : muted ? 'text-gray-500' : 'text-gray-400'}`}
      >
        {title}
      </h3>
      <div className="flex-1 flex flex-col justify-around gap-3">
        {cards.map((c, i) => (
          <BracketMatchCard key={c.match?.id ?? `slot-${i}`} card={c} pred={c.match ? preds[c.match.id] : undefined} highlight={highlight} />
        ))}
      </div>
    </div>
  )
}

function BracketMatchCard({
  card,
  pred,
  highlight,
}: {
  card: MatchCardData
  pred?: { home: number | null; away: number | null }
  highlight?: boolean
}) {
  const homeName = card.home?.name ?? card.match?.home_placeholder ?? '?'
  const awayName = card.away?.name ?? card.match?.away_placeholder ?? '?'
  const homeUnknown = !card.home
  const awayUnknown = !card.away
  const ph = pred?.home ?? null
  const pa = pred?.away ?? null
  const haveBoth = ph != null && pa != null
  // I knockout är oavgjort ej tillåtet, men we read whatever is saved
  const homeWins = haveBoth && (ph as number) > (pa as number)
  const awayWins = haveBoth && (pa as number) > (ph as number)
  const isConfirmed = card.match?.result_confirmed === true

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: '#111827',
        border: `1px solid ${highlight ? 'rgba(245,158,11,0.4)' : '#1f2937'}`,
      }}
    >
      <TeamLine
        name={homeName}
        flag={card.home?.flag}
        score={ph}
        wins={homeWins}
        unknown={homeUnknown}
        highlight={highlight}
      />
      <div className="border-t" style={{ borderColor: '#1f2937' }} />
      <TeamLine
        name={awayName}
        flag={card.away?.flag}
        score={pa}
        wins={awayWins}
        unknown={awayUnknown}
        highlight={highlight}
      />
      {isConfirmed && card.match?.home_score != null && (
        <div
          className="px-2 py-1 text-[10px] text-center font-medium"
          style={{ background: '#1a2233', color: '#9ca3af' }}
        >
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
}: {
  name: string
  flag?: string
  score: number | null
  wins: boolean
  unknown: boolean
  highlight?: boolean
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 transition-colors"
      style={{
        background: wins
          ? highlight
            ? 'rgba(245,158,11,0.15)'
            : 'rgba(16,185,129,0.1)'
          : 'transparent',
      }}
    >
      {flag ? (
        <Flag emoji={flag} name={name} width={16} height={12} className="shrink-0" />
      ) : (
        <span className="w-4 h-3 rounded-sm shrink-0" style={{ background: '#1f2937' }} />
      )}
      <span
        className={`text-xs flex-1 truncate ${unknown ? 'text-gray-500 italic' : wins ? 'text-white font-semibold' : 'text-gray-300'}`}
        title={name}
      >
        {name}
      </span>
      {wins && <Crown size={10} className={highlight ? 'text-amber-400' : 'text-emerald-400'} />}
      <span
        className={`text-sm font-bold tabular-nums ${score == null ? 'text-gray-600' : wins ? (highlight ? 'text-amber-400' : 'text-emerald-400') : 'text-gray-400'}`}
      >
        {score ?? '–'}
      </span>
    </div>
  )
}
