import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { GitBranch, AlertTriangle, CheckCircle2, Users } from 'lucide-react'

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

  const [{ data: matchesRaw }, { data: predsRaw }, { data: profilesRaw }, { data: poolsRaw }] =
    await Promise.all([
      admin
        .from('matches')
        .select('id, match_number, home_placeholder, away_placeholder, stage')
        .eq('stage', 'r32')
        .order('match_number'),
      admin.from('predictions').select('match_id, user_id, pred_home, pred_away'),
      admin.from('profiles').select('id, display_name, pool_id'),
      admin.from('pools').select('id, name').is('deleted_at', null),
    ])

  const matches = ((matchesRaw ?? []) as MatchRow[]).slice(0, 16)
  const allPreds = (predsRaw ?? []) as PredRow[]
  const profiles = (profilesRaw ?? []) as ProfileRow[]
  const pools = (poolsRaw ?? []) as PoolRow[]

  const profileById = new Map(profiles.map(p => [p.id, p]))
  const poolNameById = new Map(pools.map(p => [p.id, p.name]))

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
