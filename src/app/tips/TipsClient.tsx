'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Match, Prediction, Settings, Profile, Team, Stage, STAGE_LABELS, calcPredictionResult,
  BonusPrediction, BonusResults, Pool, TournamentMode
} from '@/lib/types'
import {
  calcAllGroupStandings, getBest8Third,
  R32_BRACKET, R16_BRACKET, QF_BRACKET, SF_BRACKET, StandingsRow
} from '@/lib/standings'
import { GroupStandingsGrid } from '@/components/GroupStandingsGrid'
import { Flag } from '@/components/Flag'
import { BonusTipsSection } from '@/components/BonusTipsSection'
import { RandomizeOverlay } from '@/components/RandomizeOverlay'
import { format, isPast } from 'date-fns'
import { sv } from 'date-fns/locale'
import Link from 'next/link'
import { Lock, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Loader2, Dices, Trash2, GitBranch } from 'lucide-react'

interface Props {
  profile: Profile
  matches: Match[]
  predictions: Prediction[]
  settings: Settings
  teams: Team[]
  userId: string
  bonus: BonusPrediction | null
  bonusResults: BonusResults | null
  pool: Pool | null
}

const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final']

export function TipsClient({ profile, matches, predictions, settings, teams, userId, bonus, bonusResults, pool }: Props) {
  // Spelform och globalt lås kommer från användarens aktiva liga.
  // Faller tillbaka på globala settings för bakåtkompatibilitet.
  const tournamentMode: TournamentMode = pool?.tournament_mode ?? settings.tournament_mode
  const globalLock: boolean = pool?.mode_a_global_lock ?? settings.mode_a_global_lock
  const supabase = createClient()

  const [preds, setPreds] = useState<Record<number, { home: string; away: string }>>(() => {
    const map: Record<number, { home: string; away: string }> = {}
    predictions.forEach(p => { map[p.match_id] = { home: String(p.pred_home), away: String(p.pred_away) } })
    return map
  })
  const [saving, setSaving] = useState<number | null>(null)
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const [locking, setLocking] = useState(false)
  const [locked, setLocked] = useState(profile.tips_locked)
  const [openStages, setOpenStages] = useState<Set<Stage>>(new Set(['group']))
  const [randomizing, setRandomizing] = useState(false)
  const [clearing, setClearing] = useState(false)

  async function handleClearAll() {
    if (locked) return
    // Två varningar för säkerhets skull
    if (!confirm('Vill du rensa ALLA dina tips och börja om? Detta går inte att ångra.')) return
    if (!confirm('Är du HELT säker? Alla dina ifyllda resultat tas bort permanent.')) return

    setClearing(true)
    // Radera bara olåsta tips (låsta/inlämnade rörs inte)
    await supabase
      .from('predictions')
      .delete()
      .eq('user_id', userId)
      .eq('locked', false)

    // Töm lokala fält för matcher som inte är låsta
    const lockedMatchIds = new Set(
      predictions.filter(p => p.locked).map(p => p.match_id)
    )
    setPreds(prev => {
      const next: Record<number, { home: string; away: string }> = {}
      for (const [k, v] of Object.entries(prev)) {
        if (lockedMatchIds.has(Number(k))) next[Number(k)] = v
      }
      return next
    })
    setClearing(false)
    fetch('/api/backup?reason=user-clear-tips', { method: 'POST' }).catch(() => {})
  }

  // Globala slumpinställningar från admin
  const randomizeDuration = settings.randomize_duration ?? 15
  const customPhrases = [
    settings.randomize_phrase_1 ?? '',
    settings.randomize_phrase_2 ?? '',
    settings.randomize_phrase_3 ?? '',
  ].filter(p => p.trim() !== '')

  // Slumpa fram ett enskilt mål (viktad fördelning – vanligare med 0-2 mål)
  function randomGoals(): number {
    const r = Math.random()
    if (r < 0.25) return 0
    if (r < 0.55) return 1
    if (r < 0.77) return 2
    if (r < 0.89) return 3
    if (r < 0.95) return 4
    if (r < 0.98) return 5
    if (r < 0.995) return 6
    return 7
  }

  // Slumpa en matchs resultat – följer regler:
  // • Max 7 mål per lag
  // • Max 5-5 vid oavgjort
  // • Slutspel får inte sluta oavgjort (måste finnas vinnare)
  function randomScore(allowDraw: boolean): [number, number] {
    let home = randomGoals()
    let away = randomGoals()
    if (home === away && home > 5) { home = 5; away = 5 }
    if (!allowDraw && home === away) {
      if (Math.random() < 0.5) home = Math.min(home + 1, 7)
      else away = Math.min(away + 1, 7)
      // Om båda var 7 → sänk en
      if (home === away) home > 0 ? home-- : away++
    }
    return [home, away]
  }

  // ─── Standings ──────────────────────────────────────────────────────────────
  const groupMatches = useMemo(() => matches.filter(m => m.stage === 'group'), [matches])

  const standings = useMemo(
    () => calcAllGroupStandings(teams, groupMatches, preds),
    [teams, groupMatches, preds]
  )

  const best8Third = useMemo(() => getBest8Third(standings), [standings])
  const best8ThirdIds = useMemo(() => new Set(best8Third.map(r => r.team.id)), [best8Third])

  // ─── Sorterade slutspelsmatcher ─────────────────────────────────────────────
  const r32Matches = useMemo(() => matches.filter(m => m.stage === 'r32').sort((a, b) => a.match_number - b.match_number), [matches])
  const r16Matches = useMemo(() => matches.filter(m => m.stage === 'r16').sort((a, b) => a.match_number - b.match_number), [matches])
  const qfMatches  = useMemo(() => matches.filter(m => m.stage === 'qf' ).sort((a, b) => a.match_number - b.match_number), [matches])
  const sfMatches  = useMemo(() => matches.filter(m => m.stage === 'sf' ).sort((a, b) => a.match_number - b.match_number), [matches])
  const finalMatch = useMemo(() => matches.find(m => m.stage === 'final'), [matches])
  const thirdMatch = useMemo(() => matches.find(m => m.stage === '3rd'),   [matches])

  // ─── Bracket-upplösning ──────────────────────────────────────────────────────
  // Vilken Team sitter i en grupp-slot ('1A', '2B', 'T3_3' …)?
  const r32Teams = useMemo((): [Team | null, Team | null][] => {
    const rSlot = (slot: string): Team | null => {
      if (slot.startsWith('T3_')) return best8Third[parseInt(slot.substring(3)) - 1]?.team ?? null
      const pos = parseInt(slot[0]) - 1
      return standings[slot[1]]?.[pos]?.team ?? null
    }
    return r32Matches.map((_, i) => {
      const [hs, as_] = R32_BRACKET[i] ?? ['', '']
      return [rSlot(hs), rSlot(as_)]
    })
  }, [standings, best8Third, r32Matches])

  // Vinnaren av en given match (baserat på tippad/bekräftad)
  const winner = useCallback((matchId: number, homeT: Team | null, awayT: Team | null): Team | null => {
    const m = matches.find(x => x.id === matchId)
    let hg: number, ag: number
    if (m?.result_confirmed && m.home_score != null && m.away_score != null) {
      hg = m.home_score; ag = m.away_score
    } else {
      const p = preds[matchId]
      if (!p || p.home === '' || p.away === '') return null
      hg = parseInt(p.home); ag = parseInt(p.away)
      if (isNaN(hg) || isNaN(ag)) return null
    }
    return hg >= ag ? homeT : awayT
  }, [matches, preds])

  const loser = useCallback((matchId: number, homeT: Team | null, awayT: Team | null): Team | null => {
    const w = winner(matchId, homeT, awayT)
    if (!w) return null
    return w === homeT ? awayT : homeT
  }, [winner])

  const r16Teams = useMemo((): [Team | null, Team | null][] =>
    r16Matches.map((_, i) => {
      const [hi, ai] = R16_BRACKET[i] ?? [0, 0]
      return [
        r32Matches[hi] ? winner(r32Matches[hi].id, r32Teams[hi]?.[0], r32Teams[hi]?.[1]) : null,
        r32Matches[ai] ? winner(r32Matches[ai].id, r32Teams[ai]?.[0], r32Teams[ai]?.[1]) : null,
      ]
    }),
  [r16Matches, r32Matches, r32Teams, winner])

  const qfTeams = useMemo((): [Team | null, Team | null][] =>
    qfMatches.map((_, i) => {
      const [hi, ai] = QF_BRACKET[i] ?? [0, 0]
      return [
        r16Matches[hi] ? winner(r16Matches[hi].id, r16Teams[hi]?.[0], r16Teams[hi]?.[1]) : null,
        r16Matches[ai] ? winner(r16Matches[ai].id, r16Teams[ai]?.[0], r16Teams[ai]?.[1]) : null,
      ]
    }),
  [qfMatches, r16Matches, r16Teams, winner])

  const sfTeams = useMemo((): [Team | null, Team | null][] =>
    sfMatches.map((_, i) => {
      const [hi, ai] = SF_BRACKET[i] ?? [0, 0]
      return [
        qfMatches[hi] ? winner(qfMatches[hi].id, qfTeams[hi]?.[0], qfTeams[hi]?.[1]) : null,
        qfMatches[ai] ? winner(qfMatches[ai].id, qfTeams[ai]?.[0], qfTeams[ai]?.[1]) : null,
      ]
    }),
  [sfMatches, qfMatches, qfTeams, winner])

  const finalTeams = useMemo((): [Team | null, Team | null] => [
    sfMatches[0] ? winner(sfMatches[0].id, sfTeams[0]?.[0], sfTeams[0]?.[1]) : null,
    sfMatches[1] ? winner(sfMatches[1].id, sfTeams[1]?.[0], sfTeams[1]?.[1]) : null,
  ], [sfMatches, sfTeams, winner])

  const thirdTeams = useMemo((): [Team | null, Team | null] => [
    sfMatches[0] ? loser(sfMatches[0].id, sfTeams[0]?.[0], sfTeams[0]?.[1]) : null,
    sfMatches[1] ? loser(sfMatches[1].id, sfTeams[1]?.[0], sfTeams[1]?.[1]) : null,
  ], [sfMatches, sfTeams, loser])

  // Slå upp resolved teams per match-id
  const resolvedMap = useMemo(() => {
    const map: Record<number, [Team | null, Team | null]> = {}
    r32Matches.forEach((m, i) => { map[m.id] = r32Teams[i] })
    r16Matches.forEach((m, i) => { map[m.id] = r16Teams[i] })
    qfMatches.forEach((m, i)  => { map[m.id] = qfTeams[i] })
    sfMatches.forEach((m, i)  => { map[m.id] = sfTeams[i] })
    if (finalMatch) map[finalMatch.id] = finalTeams
    if (thirdMatch) map[thirdMatch.id] = thirdTeams
    return map
  }, [r32Matches, r16Matches, qfMatches, sfMatches, r32Teams, r16Teams, qfTeams, sfTeams, finalTeams, thirdTeams, finalMatch, thirdMatch])

  // I läge C beter sig gruppspel som A och slutspel som B.
  const isAStyleMatch = (match: Match): boolean =>
    tournamentMode === 'A' || (tournamentMode === 'C' && match.stage === 'group')
  const isBStyleMatch = (match: Match): boolean =>
    tournamentMode === 'B' || (tournamentMode === 'C' && match.stage !== 'group')

  // ─── Hjälpfunktioner ─────────────────────────────────────────────────────────
  const isLocked = (match: Match): boolean => {
    if (isAStyleMatch(match)) {
      if (locked) return true
      if (globalLock) return true
      return predictions.find(p => p.match_id === match.id)?.locked ?? false
    }
    if (isBStyleMatch(match)) {
      return isPast(new Date(match.kickoff_at))
    }
    return predictions.find(p => p.match_id === match.id)?.locked ?? false
  }

  const savePrediction = useCallback(async (matchId: number) => {
    const val = preds[matchId]
    if (!val || val.home === '' || val.away === '') return
    const predHome = parseInt(val.home), predAway = parseInt(val.away)
    if (isNaN(predHome) || isNaN(predAway)) return
    // Slutspel kan inte sluta oavgjort – blockera save tills användaren rättar
    const match = matches.find(m => m.id === matchId)
    if (match && match.stage !== 'group' && predHome === predAway) return
    setSaving(matchId)
    await supabase.from('predictions').upsert(
      { user_id: userId, match_id: matchId, pred_home: predHome, pred_away: predAway },
      { onConflict: 'user_id,match_id' }
    )
    setSaving(null)
    setSaved(prev => new Set(prev).add(matchId))
    setTimeout(() => setSaved(prev => { const s = new Set(prev); s.delete(matchId); return s }), 2000)
    fetch('/api/backup?reason=user-tip-save', { method: 'POST' }).catch(() => {})
  }, [preds, matches, supabase, userId])

  async function handleRandomizeAll(overwrite: boolean) {
    if (locked) return
    setRandomizing(true)

    const updates: { match_id: number; home: number; away: number }[] = []

    for (const match of matches) {
      if (isLocked(match)) continue

      const current = preds[match.id]
      const alreadyTipped = current?.home !== '' && current?.away !== '' && current?.home !== undefined
      if (alreadyTipped && !overwrite) continue

      // Bara om laget är känt (direktlag, placeholder eller upplöst via bracket)
      const hasTeams =
        !!match.home_team_id ||
        !!match.home_placeholder ||
        !!resolvedMap[match.id]?.[0]
      if (!hasTeams) continue

      const allowDraw = match.stage === 'group'
      const [h, a] = randomScore(allowDraw)
      updates.push({ match_id: match.id, home: h, away: a })
    }

    if (updates.length === 0) {
      setRandomizing(false)
      return
    }

    // Kör save i bakgrunden parallellt med 15 sek "spänningsanimation"
    const rows = updates.map(u => ({
      user_id: userId, match_id: u.match_id, pred_home: u.home, pred_away: u.away,
    }))

    const savePromise = supabase.from('predictions').upsert(rows, { onConflict: 'user_id,match_id' })
    const minDelay = new Promise(resolve => setTimeout(resolve, randomizeDuration * 1000))

    await Promise.all([savePromise, minDelay])
    fetch('/api/backup?reason=user-randomize-save', { method: 'POST' }).catch(() => {})

    // Avslöja resultaten samtidigt som overlayen försvinner
    setPreds(prev => {
      const next = { ...prev }
      for (const u of updates) next[u.match_id] = { home: String(u.home), away: String(u.away) }
      return next
    })

    setRandomizing(false)
  }

  async function handleLockAll() {
    setLocking(true)
    // I läge C låser användaren bara sina gruppspels-tips här. Slutspelet låses per match.
    const onlyGroup = tournamentMode === 'C'
    const { error } = await supabase.rpc('lock_user_tips', {
      p_user_id: userId,
      p_only_group: onlyGroup,
    })
    if (!error && !onlyGroup) setLocked(true)
    setLocking(false)
  }

  function toggleStage(stage: Stage) {
    setOpenStages(prev => {
      const s = new Set(prev)
      s.has(stage) ? s.delete(stage) : s.add(stage)
      return s
    })
  }

  // ─── Progress ────────────────────────────────────────────────────────────────
  // Räknar alla matcher man kan tippa: gruppspel + slutspels-bracket via placeholders.
  // Filtrerar inte på home_team_id eftersom slutspelsmatcher har placeholders innan
  // gruppspelet är spelat — det är fortfarande tippningsbara via bracket-resolvern.
  const totalLockableMatches = matches.length
  const tippedMatches = Object.keys(preds).filter(id => {
    const v = preds[parseInt(id)]; return v?.home !== '' && v?.away !== ''
  }).length
  const progressPct = totalLockableMatches > 0 ? Math.round((tippedMatches / totalLockableMatches) * 100) : 0

  // Progress för läge C – bara gruppspel räknas mot "lämna in"-knappen
  const lockableGroupMatches = groupMatches.filter(m => m.home_team_id && m.away_team_id)
  const totalGroupMatches = lockableGroupMatches.length
  const tippedInGroupStage = lockableGroupMatches.filter(m => {
    const v = preds[m.id]; return v?.home !== '' && v?.away !== ''
  }).length
  const groupProgressPct =
    totalGroupMatches > 0 ? Math.round((tippedInGroupStage / totalGroupMatches) * 100) : 0

  const byStage = STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = matches.filter(m => m.stage === stage)
    return acc
  }, {} as Record<Stage, Match[]>)

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Spänningsanimation vid slumpning */}
      {randomizing && (
        <RandomizeOverlay
          duration={randomizeDuration * 1000}
          customPhrases={customPhrases}
          displayName={profile.display_name}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Mina tips</h1>
          <p className="text-gray-400 text-sm mt-1">
            {tournamentMode === 'A'
              ? 'Tippa alla matcher och lämna in när du är klar.'
              : tournamentMode === 'C'
              ? 'Tippa hela gruppspelet och lämna in. Slutspelet tippas löpande och låses vid avspark.'
              : 'Tippa inför varje match. Tips låses automatiskt vid avspark.'}
          </p>
        </div>
          {pool?.image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={pool.image_url}
              alt={pool.name}
              className="h-12 sm:h-14 w-auto rounded-lg shrink-0"
              style={{ border: '1px solid #1f2937', maxWidth: '160px', objectFit: 'contain' }}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-start">
          <Link
            href="/slutspel"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-rose-300 transition-all hover:bg-rose-400/10"
            style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.3)' }}
            title="Se ditt slutspels-träd baserat på dina tips"
          >
            <GitBranch size={16} />
            Mitt slutspel
          </Link>
        </div>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleRandomizeAll(false)}
              disabled={randomizing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 hover:bg-white/5"
              style={{ background: '#1f2937', border: '1px solid #374151' }}
              title="Fyller bara matcher som inte är tippade än"
            >
              {randomizing ? <Loader2 size={16} className="animate-spin" /> : <Dices size={16} />}
              Slumpa otippade
            </button>
            <button
              onClick={() => {
                if (confirm('Detta skriver över ALLA dina nuvarande tips med slumpade resultat. Fortsätta?')) {
                  handleRandomizeAll(true)
                }
              }}
              disabled={randomizing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-gray-300 transition-all disabled:opacity-40 hover:text-white hover:bg-white/5"
              style={{ background: 'transparent', border: '1px solid #374151' }}
              title="Skriver över alla tips"
            >
              <Dices size={16} />
              Slumpa allt
            </button>
            <button
              onClick={handleClearAll}
              disabled={randomizing || clearing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
              title="Tar bort alla dina ifyllda tips och börjar om"
            >
              {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Rensa / börja om
            </button>
          </div>
        )}
      </div>

      {/* Progress – Läge A (allt) och C (gruppspel) */}
      {(tournamentMode === 'A' || tournamentMode === 'C') && (
        <div className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          {locked && tournamentMode === 'A' ? (
            <div className="flex items-center gap-3 text-green-400">
              <CheckCircle size={20} />
              <div>
                <div className="font-semibold">Tips inlämnade!</div>
                <div className="text-sm text-gray-400">Lycka till!</div>
              </div>
            </div>
          ) : (() => {
            const isC = tournamentMode === 'C'
            const tipped = isC ? tippedInGroupStage : tippedMatches
            const total = isC ? totalGroupMatches : totalLockableMatches
            const pct = isC ? groupProgressPct : progressPct
            const groupLockedForUser = isC && globalLock
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-300">
                    <span className="text-white">{tipped}</span>
                    <span className="text-gray-500">
                      {' / '}{total} {isC ? 'gruppspels-matcher tippade' : 'matcher tippade'}
                    </span>
                  </div>
                  <span className="text-emerald-400 font-bold">{pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 mb-4">
                  <div className="h-2 rounded-full transition-all gold-gradient" style={{ width: `${pct}%` }} />
                </div>
                {groupLockedForUser ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle size={16} />
                    Gruppspels-tips låsta. Slutspelet tippas löpande.
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleLockAll}
                      disabled={locking || tipped === 0}
                      className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-black transition-all disabled:opacity-40 gold-gradient"
                    >
                      {locking ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                      {isC ? 'Lås mina gruppspels-tips' : 'Lämna in mina tips'}
                    </button>
                    {!isC && tippedMatches < totalLockableMatches && (
                      <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Du kan lämna in med ofyllda matcher – de ger 0 poäng.
                      </p>
                    )}
                    {isC && (
                      <p className="mt-2 text-xs text-gray-500">
                        Slutspelets matcher dyker upp för tippning efter att gruppspelet är klart.
                      </p>
                    )}
                  </>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── Gruppspelstips ── */}
      {renderStage('group')}

      {/* ── Grupptabeller ── */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <GroupStandingsGrid standings={standings} best8ThirdIds={best8ThirdIds} />
      </div>

      {/* ── Slutspel ── */}
      {STAGE_ORDER.filter(s => s !== 'group').map(stage => renderStage(stage))}

      {/* ── Bonustips ── */}
      <BonusTipsSection
        userId={userId}
        teams={teams}
        bonus={bonus}
        bonusResults={bonusResults}
        locked={(locked && tournamentMode !== 'B') || globalLock}
        predictions={predictions}
      />
    </div>
  )

  // ─── Renderar en stage-sektion ────────────────────────────────────────────
  function renderStage(stage: Stage) {
    const stageMatches = byStage[stage]
    if (!stageMatches?.length) return null
    const isOpen = openStages.has(stage)

    const tippedInStage = stageMatches.filter(m => {
      const v = preds[m.id]; return v?.home !== '' && v?.away !== ''
    }).length
    const availableInStage = stageMatches.filter(m =>
      m.home_team_id || m.home_placeholder || resolvedMap[m.id]?.[0]
    ).length

    return (
      <div key={stage} className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
        <button
          onClick={() => toggleStage(stage)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
          style={{ background: '#111827' }}
        >
          <div className="flex items-center gap-3">
            <span className="font-bold text-white">{STAGE_LABELS[stage]}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1f2937', color: '#9ca3af' }}>
              {tippedInStage}/{stageMatches.length}
            </span>
          </div>
          {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {isOpen && (
          <div className="divide-y" style={{ borderColor: '#1f2937' }}>
            {stage === 'group'
              ? renderGroupStage(stageMatches)
              : stageMatches.map(match => {
                  const [rHome, rAway] = resolvedMap[match.id] ?? [null, null]
                  return (
                    <MatchRow
                      key={match.id}
                      match={match}
                      value={preds[match.id] ?? { home: '', away: '' }}
                      locked={isLocked(match)}
                      saving={saving === match.id}
                      justSaved={saved.has(match.id)}
                      resolvedHome={rHome}
                      resolvedAway={rAway}
                      onChange={(home, away) => setPreds(p => ({ ...p, [match.id]: { home, away } }))}
                      onBlur={() => savePrediction(match.id)}
                    />
                  )
                })
            }
          </div>
        )}
      </div>
    )
  }

  function renderGroupStage(gMatches: Match[]) {
    const groups: Record<string, Match[]> = {}
    gMatches.forEach(m => {
      const g = m.group_name ?? 'Övrigt'
      if (!groups[g]) groups[g] = []
      groups[g].push(m)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([group, ms]) => (
      <div key={group}>
        <div className="px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider"
          style={{ background: '#0f172a' }}>
          Grupp {group}
        </div>
        {ms.map(match => (
          <MatchRow
            key={match.id}
            match={match}
            value={preds[match.id] ?? { home: '', away: '' }}
            locked={isLocked(match)}
            saving={saving === match.id}
            justSaved={saved.has(match.id)}
            onChange={(home, away) => setPreds(p => ({ ...p, [match.id]: { home, away } }))}
            onBlur={() => savePrediction(match.id)}
          />
        ))}
      </div>
    ))
  }
}

// ─── MatchRow ────────────────────────────────────────────────────────────────
function MatchRow({
  match, value, locked, saving, justSaved, onChange, onBlur, resolvedHome, resolvedAway,
}: {
  match: Match
  value: { home: string; away: string }
  locked: boolean
  saving: boolean
  justSaved: boolean
  resolvedHome?: Team | null
  resolvedAway?: Team | null
  onChange: (home: string, away: string) => void
  onBlur: () => void
}) {
  const homeName = resolvedHome?.name ?? match.home_team?.name ?? match.home_placeholder ?? '?'
  const awayName = resolvedAway?.name ?? match.away_team?.name ?? match.away_placeholder ?? '?'
  const homeFlag = resolvedHome?.flag ?? match.home_team?.flag ?? ''
  const awayFlag = resolvedAway?.flag ?? match.away_team?.flag ?? ''

  // Okänt lag = ingen flag + grå text
  const isHomeUnknown = !resolvedHome && !match.home_team
  const isAwayUnknown = !resolvedAway && !match.away_team

  const kickoff = format(new Date(match.kickoff_at), 'd MMM HH:mm', { locale: sv })

  const result = match.result_confirmed
    ? calcPredictionResult(
        { pred_home: parseInt(value.home || '-1'), pred_away: parseInt(value.away || '-1') },
        match
      )
    : 'pending'

  // Slutspel kan inte sluta oavgjort – flagga om bägge fyllda och lika
  const isKnockout = match.stage !== 'group'
  const isForbiddenDraw =
    isKnockout && value.home !== '' && value.away !== '' && value.home === value.away

  const resultBg: Record<string, string> = {
    exact: 'rgba(16,185,129,0.06)',
    correct: 'rgba(34,197,94,0.05)',
    wrong: 'rgba(239,68,68,0.04)',
    pending: 'transparent',
  }

  return (
    <div className="px-5 py-3.5" style={{ background: resultBg[result] }}>
      <div className="flex items-center gap-3">
      {/* Datum */}
      <div className="text-xs text-gray-500 w-20 shrink-0 hidden sm:block">{kickoff}</div>

      {/* Hemmalag */}
      <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
        <span className={`text-sm font-medium truncate text-right ${isHomeUnknown ? 'text-gray-500 italic' : 'text-white'}`}>
          {homeName}
        </span>
        {homeFlag && <Flag emoji={homeFlag} name={homeName} width={22} height={16} className="shrink-0" />}
      </div>

      {/* Inmatning / resultat */}
      <div className="flex items-center gap-1.5 shrink-0">
        {locked ? (
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
              style={{ background: '#1f2937', color: value.home !== '' ? '#f9fafb' : '#6b7280' }}>
              {value.home !== '' ? value.home : '–'}
            </div>
            <span className="text-gray-600 font-bold">–</span>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
              style={{ background: '#1f2937', color: value.away !== '' ? '#f9fafb' : '#6b7280' }}>
              {value.away !== '' ? value.away : '–'}
            </div>
            {match.result_confirmed && (
              <div className="ml-2 text-xs font-medium px-2 py-0.5 rounded"
                style={{ background: '#1f2937', color: '#9ca3af' }}>
                {match.home_score}–{match.away_score}
              </div>
            )}
          </div>
        ) : (
          <>
            <input
              type="number" min="0" max="99"
              value={value.home}
              onChange={e => onChange(e.target.value, value.away)}
              onBlur={onBlur}
              disabled={isHomeUnknown && isAwayUnknown}
              placeholder="–"
              aria-invalid={isForbiddenDraw}
              className="w-10 h-10 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all disabled:opacity-30"
              style={{
                background: '#1f2937',
                border: `1px solid ${isForbiddenDraw ? '#ef4444' : '#374151'}`,
                color: '#f9fafb',
              }}
            />
            <span className="text-gray-600 font-bold">–</span>
            <input
              type="number" min="0" max="99"
              value={value.away}
              onChange={e => onChange(value.home, e.target.value)}
              onBlur={onBlur}
              disabled={isHomeUnknown && isAwayUnknown}
              placeholder="–"
              aria-invalid={isForbiddenDraw}
              className="w-10 h-10 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all disabled:opacity-30"
              style={{
                background: '#1f2937',
                border: `1px solid ${isForbiddenDraw ? '#ef4444' : '#374151'}`,
                color: '#f9fafb',
              }}
            />
          </>
        )}

        {/* Spara-indikator – grön check kvarstår så länge tipset är ifyllt */}
        <div className="w-5 shrink-0">
          {saving ? (
            <Loader2 size={14} className="animate-spin text-emerald-400" />
          ) : value.home !== '' && value.away !== '' ? (
            <CheckCircle size={14} className="text-green-400" />
          ) : locked ? (
            <Lock size={12} className="text-gray-600" />
          ) : null}
        </div>
      </div>

      {/* Bortalag */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {awayFlag && <Flag emoji={awayFlag} name={awayName} width={22} height={16} className="shrink-0" />}
        <span className={`text-sm font-medium truncate ${isAwayUnknown ? 'text-gray-500 italic' : 'text-white'}`}>
          {awayName}
        </span>
      </div>

      {/* Resultatindikator */}
      {result !== 'pending' && (
        <div className="shrink-0 hidden sm:block">
          {result === 'exact'   && <span className="text-xs font-semibold text-emerald-400">⭐ Exakt</span>}
          {result === 'correct' && <span className="text-xs font-semibold text-green-400">✓ Rätt</span>}
          {result === 'wrong'   && <span className="text-xs font-semibold text-red-400">✗ Fel</span>}
        </div>
      )}
      </div>

      {/* Varning för oavgjort i slutspel – knockout kan inte sluta lika */}
      {isForbiddenDraw && !locked && (
        <div className="mt-1.5 text-[11px] text-red-400 text-center sm:text-right sm:pr-7">
          Slutspelsmatcher kan inte sluta oavgjort – ändra resultatet för att kunna spara.
        </div>
      )}
    </div>
  )
}
