import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { GitBranch, AlertTriangle, CheckCircle2, Users, ArrowRight } from 'lucide-react'
import { calcAllGroupStandings, getBest8Third, type StandingsRow } from '@/lib/standings'
import type { Match, Team } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Skuggkopia av nuvarande R32_BRACKET (src/lib/standings.ts rad 94–99).
// OBS: denna sida läser bara, importerar inte standings.ts för att
// undvika att en ändring där råkar slå igenom här innan vi är klara.
const CURRENT_R32_BRACKET: [string, string][] = [
  ['1A', '2B'], ['1C', '2D'], ['1E', '2F'], ['1G', '2H'],
  ['1I', '2J'], ['1K', '2L'], ['1B', '2A'], ['1D', '2C'],
  ['1F', '2E'], ['1H', '2G'], ['1J', '2I'], ['1L', '2K'],
  ['T3_1', 'T3_5'], ['T3_2', 'T3_6'], ['T3_3', 'T3_7'], ['T3_4', 'T3_8'],
]

// Föreslagen FIFA-2026-korrekt R32-mappning enligt placeholders som redan
// finns i databasen (matches.home_placeholder/away_placeholder, seed_complete.sql
// rad 160–175). Notation: '1X' = vinnare grupp X, '2X' = tvåa, '3X|Y|Z' = trea
// från en av grupperna X, Y eller Z (FIFA-seedningens lookup avgör vilken
// av de tre faktiska treorna som hamnar där när 8 av 12 grupper kvalat).
const PROPOSED_R32_BRACKET: [string, string][] = [
  ['1A', '3B|C|D'], // Match 73
  ['1C', '3A|B|E'], // Match 74
  ['1B', '3C|D|F'], // Match 75
  ['1D', '3A|E|G'], // Match 76
  ['1E', '3B|F|H'], // Match 77
  ['1G', '3C|I|J'], // Match 78
  ['1F', '3D|G|K'], // Match 79
  ['1H', '3E|F|L'], // Match 80
  ['1I', '2J'],     // Match 81
  ['1K', '2L'],     // Match 82
  ['1J', '2I'],     // Match 83
  ['1L', '2K'],     // Match 84
  ['2A', '2B'],     // Match 85
  ['2C', '2D'],     // Match 86
  ['2E', '2F'],     // Match 87
  ['2G', '2H'],     // Match 88
]

interface MatchRow {
  id: number
  match_number: number
  home_placeholder: string | null
  away_placeholder: string | null
}

interface PredRow {
  match_id: number
  user_id: string
  pred_home: number
  pred_away: number
}

interface ProfileRow {
  id: string
  display_name: string
  pool_id: number | null
}

interface PoolRow {
  id: number
  name: string
}

// ─── Simulering: vilka lag hamnar i R32 enligt gammal vs ny mappning ───────

// Slår upp '1A' / '2B' / 'T3_N' mot en deltagares tippade tabeller.
function resolveCurrentSlot(
  slot: string,
  standings: Record<string, StandingsRow[]>,
  best8: StandingsRow[]
): Team | null {
  if (slot.startsWith('T3_')) return best8[parseInt(slot.slice(3)) - 1]?.team ?? null
  const pos = parseInt(slot[0]) - 1
  return standings[slot[1]]?.[pos]?.team ?? null
}

// Tilldelar de 8 bästa treorna till treorslots ('3B|C|D') girigt:
// bäst rankad trea vars grupp är tillåten och inte redan använd.
// Faller tillbaka på bästa otilldelade trea om ingen passar (markeras).
// OBS: FIFA:s riktiga allokering använder en officiell tabell – det här är
// en nära approximation för jämförelsen.
function allocateThirds(
  best8: StandingsRow[],
  thirdSlots: { matchIdx: number; allowed: string[] }[]
): Map<number, { team: Team; fallback: boolean } | null> {
  const used = new Set<string>()
  const result = new Map<number, { team: Team; fallback: boolean } | null>()
  for (const slot of thirdSlots) {
    const exact = best8.find(s => !used.has(s.group) && slot.allowed.includes(s.group))
    if (exact) {
      used.add(exact.group)
      result.set(slot.matchIdx, { team: exact.team, fallback: false })
      continue
    }
    const fallback = best8.find(s => !used.has(s.group))
    if (fallback) {
      used.add(fallback.group)
      result.set(slot.matchIdx, { team: fallback.team, fallback: true })
    } else {
      result.set(slot.matchIdx, null)
    }
  }
  return result
}

function resolveProposedSlots(
  standings: Record<string, StandingsRow[]>,
  best8: StandingsRow[]
): (Team | null)[][] {
  const thirdSlots = PROPOSED_R32_BRACKET
    .flatMap(([h, a], matchIdx) =>
      [h, a]
        .filter(s => s.startsWith('3'))
        .map(s => ({ matchIdx, allowed: s.slice(1).split('|') }))
    )
  const thirds = allocateThirds(best8, thirdSlots)

  return PROPOSED_R32_BRACKET.map(([h, a], matchIdx) =>
    [h, a].map(slot => {
      if (slot.startsWith('3')) return thirds.get(matchIdx)?.team ?? null
      const pos = parseInt(slot[0]) - 1
      return standings[slot[1]]?.[pos]?.team ?? null
    })
  )
}

export default async function BracketTestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Layout-trickset skyddar redan, men en extra check skadar inte.
  const { data: meProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!meProfile?.is_admin) redirect('/')

  const admin = createAdminClient()

  const [
    { data: allMatchesRaw },
    { data: teamsRaw },
    { data: predsRaw },
    { data: profilesRaw },
    { data: poolsRaw },
  ] = await Promise.all([
    admin
      .from('matches')
      .select('*')
      .order('match_number'),
    admin.from('teams').select('*'),
    admin.from('predictions').select('match_id, user_id, pred_home, pred_away'),
    admin.from('profiles').select('id, display_name, pool_id'),
    admin.from('pools').select('id, name').is('deleted_at', null),
  ])

  const allMatches = (allMatchesRaw ?? []) as Match[]
  const teams = (teamsRaw ?? []) as Team[]
  const groupMatches = allMatches.filter(m => m.stage === 'group')
  const matches: MatchRow[] = allMatches
    .filter(m => m.stage === 'r32')
    .sort((a, b) => a.match_number - b.match_number)
    .slice(0, 16)
    .map(m => ({
      id: m.id,
      match_number: m.match_number,
      home_placeholder: m.home_placeholder,
      away_placeholder: m.away_placeholder,
    }))
  const allPreds = (predsRaw ?? []) as PredRow[]
  const profiles = (profilesRaw ?? []) as ProfileRow[]
  const pools = (poolsRaw ?? []) as PoolRow[]

  const profileById = new Map(profiles.map(p => [p.id, p]))
  const poolNameById = new Map(pools.map(p => [p.id, p.name]))

  // ── Per-deltagare-simulering: gammal vs ny lagplacering i R32 ──
  const groupMatchIds = new Set(groupMatches.map(m => m.id))
  const groupPredsByUser = new Map<string, Record<number, { home: string; away: string }>>()
  for (const p of allPreds) {
    if (!groupMatchIds.has(p.match_id)) continue
    if (!groupPredsByUser.has(p.user_id)) groupPredsByUser.set(p.user_id, {})
    groupPredsByUser.get(p.user_id)![p.match_id] = {
      home: String(p.pred_home),
      away: String(p.pred_away),
    }
  }

  interface UserDiff {
    userId: string
    name: string
    poolName: string
    groupTipCount: number
    changes: {
      matchNumber: number
      oldHome: string
      oldAway: string
      newHome: string
      newAway: string
    }[]
  }

  const fmt = (t: Team | null) => (t ? `${t.flag} ${t.name}` : '?')

  const userDiffs: UserDiff[] = []
  for (const [userId, preds] of groupPredsByUser.entries()) {
    const prof = profileById.get(userId)
    if (!prof) continue
    const standings = calcAllGroupStandings(teams, groupMatches, preds)
    const best8 = getBest8Third(standings)

    const oldTeams = CURRENT_R32_BRACKET.map(([h, a]) =>
      [resolveCurrentSlot(h, standings, best8), resolveCurrentSlot(a, standings, best8)]
    )
    const newTeams = resolveProposedSlots(standings, best8)

    const changes: UserDiff['changes'] = []
    for (let i = 0; i < 16; i++) {
      const [oh, oa] = oldTeams[i]
      const [nh, na] = newTeams[i]
      if (oh?.id === nh?.id && oa?.id === na?.id) continue
      changes.push({
        matchNumber: matches[i]?.match_number ?? 73 + i,
        oldHome: fmt(oh ?? null),
        oldAway: fmt(oa ?? null),
        newHome: fmt(nh ?? null),
        newAway: fmt(na ?? null),
      })
    }
    if (changes.length === 0) continue
    userDiffs.push({
      userId,
      name: prof.display_name,
      poolName: prof.pool_id != null ? poolNameById.get(prof.pool_id) ?? '–' : '–',
      groupTipCount: Object.keys(preds).length,
      changes,
    })
  }
  userDiffs.sort((a, b) =>
    a.poolName.localeCompare(b.poolName) || a.name.localeCompare(b.name)
  )
  const totalGroupMatches = groupMatches.length

  // Filtrera ner till bara tips på R32-matcher
  const r32MatchIds = new Set(matches.map(m => m.id))
  const r32Preds = allPreds.filter(p => r32MatchIds.has(p.match_id))

  const predsByMatch = new Map<number, PredRow[]>()
  for (const p of r32Preds) {
    if (!predsByMatch.has(p.match_id)) predsByMatch.set(p.match_id, [])
    predsByMatch.get(p.match_id)!.push(p)
  }

  const totalPreds = r32Preds.length
  const distinctTippers = new Set(r32Preds.map(p => p.user_id)).size

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitBranch size={22} className="text-emerald-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Slutspelsträd – jämförelse (testsida)</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Read-only. Visar nuvarande R32-mappning (i kod), föreslagen FIFA-2026-korrekt mappning
            och alla redan inlagda tips per slutspels-match. Inget på sidan ändrar något.
          </p>
        </div>
      </div>

      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
      >
        <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-100">
          <div className="font-semibold mb-1">Bugg upptäckt i R32_BRACKET</div>
          <p className="text-amber-200/80">
            De 4 sista 16-delsfinalerna parar idag treor mot treor (T3_1 vs T3_5 osv). Enligt
            placeholders i DB (och FIFA:s 2026-format) ska treorna istället möta gruppvinnare.
            Tipsen lagras per <code>match_id</code>, så när vi rättar mappningen ändras
            vilket lag som dyker upp i respektive matchslot – tippade resultat (2-1 osv)
            ligger kvar oförändrade.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Tips på R32 totalt" value={totalPreds.toLocaleString('sv-SE')} />
        <Stat label="Unika tippare" value={distinctTippers.toString()} />
        <Stat label="R32-matcher" value={`${matches.length} / 16`} />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#1f2937' }}>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">#</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
                DB-etikett (visas för deltagare)
              </th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
                Nuvarande kod
              </th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
                Föreslagen (FIFA)
              </th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
                Antal tips
              </th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m, idx) => {
              const [curH, curA] = CURRENT_R32_BRACKET[idx] ?? ['?', '?']
              const [propH, propA] = PROPOSED_R32_BRACKET[idx] ?? ['?', '?']
              const curIsThirdVsThird = curH.startsWith('T3_') && curA.startsWith('T3_')
              const changed = curH !== propH || curA !== propA
              const preds = predsByMatch.get(m.id) ?? []

              return (
                <tr
                  key={m.id}
                  className="border-t align-top"
                  style={{
                    borderColor: '#1f2937',
                    background: curIsThirdVsThird ? 'rgba(239,68,68,0.05)' : '#0b1120',
                  }}
                >
                  <td className="px-3 py-3 text-xs text-gray-500 tabular-nums">
                    {m.match_number}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-200">
                    <div>{m.home_placeholder ?? '–'}</div>
                    <div className="text-gray-500">vs</div>
                    <div>{m.away_placeholder ?? '–'}</div>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div className={curIsThirdVsThird ? 'text-red-300 font-semibold' : 'text-gray-300'}>
                      {curH}
                    </div>
                    <div className="text-gray-500">vs</div>
                    <div className={curIsThirdVsThird ? 'text-red-300 font-semibold' : 'text-gray-300'}>
                      {curA}
                    </div>
                    {curIsThirdVsThird && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-red-300">
                        <AlertTriangle size={10} /> 3:a vs 3:a
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div className={changed ? 'text-emerald-300 font-semibold' : 'text-gray-300'}>
                      {propH}
                    </div>
                    <div className="text-gray-500">vs</div>
                    <div className={changed ? 'text-emerald-300 font-semibold' : 'text-gray-300'}>
                      {propA}
                    </div>
                    {!changed && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 size={10} /> Oförändrad
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-base font-bold text-emerald-400 tabular-nums">
                      {preds.length}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <ArrowRight size={18} className="text-amber-400" />
          Simulering: så förändras lagen per deltagare
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Beräknat från varje deltagares redan inlagda gruppspelstips. Visar bara matcher där
          laguppsättningen skiljer sig mellan gammal och ny mappning. Treornas placering i nya
          mappningen är en nära approximation av FIFA:s allokeringstabell (girig tilldelning:
          bäst rankad trea till första tillåtna slot). {userDiffs.length} av{' '}
          {groupPredsByUser.size} deltagare med grupptips påverkas.
        </p>

        {userDiffs.length === 0 ? (
          <div className="rounded-xl p-6 text-center text-sm text-gray-500"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            Inga skillnader – antingen finns inga grupptips än, eller så ger båda
            mappningarna samma lag.
          </div>
        ) : (
          <div className="space-y-3">
            {userDiffs.map(d => (
              <div
                key={d.userId}
                className="rounded-xl p-4"
                style={{ background: '#111827', border: '1px solid #1f2937' }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{d.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded text-gray-400"
                      style={{ background: '#1f2937', border: '1px solid #374151' }}>
                      {d.poolName}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {d.groupTipCount}/{totalGroupMatches} grupptips ·{' '}
                    {d.changes.length} av 16 matcher ändras
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left py-1 w-14">Match</th>
                        <th className="text-left py-1">Gammal mappning (buggad)</th>
                        <th className="text-left py-1 w-6"></th>
                        <th className="text-left py-1">Ny mappning (FIFA)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.changes.map(c => (
                        <tr key={c.matchNumber} className="border-t" style={{ borderColor: '#1f2937' }}>
                          <td className="py-1.5 text-gray-500 tabular-nums">#{c.matchNumber}</td>
                          <td className="py-1.5 text-red-300/90">
                            {c.oldHome} – {c.oldAway}
                          </td>
                          <td className="py-1.5 text-gray-600">→</td>
                          <td className="py-1.5 text-emerald-300">
                            {c.newHome} – {c.newAway}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Users size={18} className="text-indigo-400" />
          Alla tips per R32-match
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Listan visar varje tippad poäng per match. Tipsens värden ligger kvar oavsett om
          mappningen ändras – det är bara <span className="text-amber-300">vilka faktiska lag</span>{' '}
          som hamnar i matchen som ändras.
        </p>
        <div className="space-y-4">
          {matches.map((m, idx) => {
            const preds = (predsByMatch.get(m.id) ?? []).slice().sort((a, b) => {
              const an = profileById.get(a.user_id)?.display_name ?? ''
              const bn = profileById.get(b.user_id)?.display_name ?? ''
              return an.localeCompare(bn)
            })
            const [curH, curA] = CURRENT_R32_BRACKET[idx] ?? ['?', '?']
            const [propH, propA] = PROPOSED_R32_BRACKET[idx] ?? ['?', '?']

            return (
              <div
                key={m.id}
                className="rounded-xl p-4"
                style={{ background: '#111827', border: '1px solid #1f2937' }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="text-sm font-bold text-white">Match {m.match_number}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      DB: <span className="text-gray-300">{m.home_placeholder} – {m.away_placeholder}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Kod nu: <span className="text-gray-300">{curH} – {curA}</span>
                      {' · '}
                      Förslag: <span className="text-emerald-400">{propH} – {propA}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {preds.length} {preds.length === 1 ? 'tips' : 'tips'}
                  </span>
                </div>

                {preds.length === 0 ? (
                  <div className="text-xs text-gray-600 italic">Inga tips ännu.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left py-1">Deltagare</th>
                          <th className="text-left py-1">Liga</th>
                          <th className="text-right py-1">Tips</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preds.map(p => {
                          const prof = profileById.get(p.user_id)
                          const poolName = prof?.pool_id != null
                            ? poolNameById.get(prof.pool_id) ?? '–'
                            : '–'
                          return (
                            <tr key={`${p.match_id}-${p.user_id}`} className="border-t" style={{ borderColor: '#1f2937' }}>
                              <td className="py-1.5 text-gray-200">{prof?.display_name ?? p.user_id.slice(0, 8)}</td>
                              <td className="py-1.5 text-gray-500">{poolName}</td>
                              <td className="py-1.5 text-right text-emerald-400 font-mono tabular-nums">
                                {p.pred_home}–{p.pred_away}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: '#111827', border: '1px solid #1f2937' }}>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
