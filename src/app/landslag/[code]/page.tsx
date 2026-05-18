import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Team } from '@/lib/types'
import { fetchCountry, fetchTeamFootball, type SquadPlayer } from '@/lib/team-data'
import { fetchPlayerInfo } from '@/lib/wiki-photos'
import { Flag } from '@/components/Flag'
import { getFacts } from '@/lib/team-facts'
import { ArrowLeft, MapPin, Users, User, Trophy, Star, Calendar, Globe2, ShieldCheck } from 'lucide-react'

export const revalidate = 300
export const dynamic = 'force-dynamic'

type PosBucket = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward'

// Robust normalisering: football-data.org returnerar detaljerade positioner
// (Centre-Back, Defensive Midfield, Left Winger, Second Striker, ...) plus
// de grova (Defence/Midfield/Offence). Mappar allt till fyra hinkar.
function normalizePosition(raw: string | null | undefined): PosBucket | null {
  const p = (raw ?? '').toLowerCase().trim()
  if (!p) return null
  if (p.includes('keeper') || p === 'gk') return 'Goalkeeper'
  if (
    p.includes('back') || p.includes('defen') || p.includes('defence') ||
    p === 'cb' || p === 'lb' || p === 'rb' || p === 'wb' || p.includes('sweeper')
  ) return 'Defender'
  if (p.includes('midfield') || p === 'cm' || p === 'dm' || p === 'am' || p === 'cdm' || p === 'cam') {
    return 'Midfielder'
  }
  if (
    p.includes('forward') || p.includes('winger') || p.includes('wing') ||
    p.includes('striker') || p.includes('offence') || p.includes('offense') ||
    p.includes('attack') || p === 'st' || p === 'cf' || p === 'lw' || p === 'rw'
  ) return 'Forward'
  return null
}

const POSITION_ORDER: Record<PosBucket, number> = {
  Goalkeeper: 0,
  Defender: 1,
  Midfielder: 2,
  Forward: 3,
}

const POSITION_LABELS: Record<PosBucket, string> = {
  Goalkeeper: 'Målvakt',
  Defender: 'Back',
  Midfielder: 'Mittfält',
  Forward: 'Anfallare',
}

function age(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return null
  const diffMs = Date.now() - birth.getTime()
  return Math.floor(diffMs / (365.25 * 24 * 3600 * 1000))
}

function nfmt(n: number | null | undefined): string {
  if (n == null) return '–'
  return n.toLocaleString('sv-SE')
}

export default async function LandslagDetail({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: rawCode } = await params
  const code = rawCode.toUpperCase()

  const supabase = await createClient()
  const { data: teamData } = await supabase
    .from('teams')
    .select('*')
    .eq('code', code)
    .maybeSingle()
  if (!teamData) notFound()
  const team = teamData as Team

  const [country, football] = await Promise.all([
    fetchCountry(team.code),
    fetchTeamFootball(team.code),
  ])
  const facts = getFacts(team.code)

  const rawSquad = football?.squad ?? []

  // Hämta foto + aktuell klubb från Wikipedia för alla spelare i en batch
  const wikiInfo =
    rawSquad.length > 0
      ? await fetchPlayerInfo(rawSquad.map(p => p.name))
      : new Map<string, { photoUrl?: string; currentClub?: string }>()

  // Anrika med Wikipedia-klubb när vår fallback saknar + default-värde per position
  const groupedSquad = rawSquad
    .map(p => {
      const info = wikiInfo.get(p.name)
      return {
        ...p,
        club: p.club ?? info?.currentClub ?? null,
        marketValueM:
          p.marketValueM ??
          ((np => np === 'Forward' ? 4
            : np === 'Midfielder' ? 3
            : np === 'Defender' ? 2.5
            : np === 'Goalkeeper' ? 1.5
            : 2)(normalizePosition(p.position))),
      }
    })
    .sort((a, b) => {
      const pa = POSITION_ORDER[normalizePosition(a.position) ?? 'Forward'] ?? 99
      const pb = POSITION_ORDER[normalizePosition(b.position) ?? 'Forward'] ?? 99
      if (pa !== pb) return pa - pb
      if ((a.shirtNumber ?? 99) !== (b.shirtNumber ?? 99)) {
        return (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99)
      }
      return a.name.localeCompare(b.name)
    })

  const photos = new Map<string, string>()
  for (const [name, info] of wikiInfo) {
    if (info.photoUrl) photos.set(name, info.photoUrl)
  }

  return (
    <div className="space-y-6">
      <Link
        href="/landslag"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-emerald-400 transition-colors"
      >
        <ArrowLeft size={14} />
        Alla landslag
      </Link>

      {/* Hero */}
      <div
        className="rounded-2xl p-5 sm:p-6 flex items-center gap-4 sm:gap-6"
        style={{
          background: 'linear-gradient(135deg, #0c2823 0%, #14202e 50%, #0a3d2a 100%)',
          border: '1px solid #1f2937',
        }}
      >
        <div className="shrink-0">
          <Flag emoji={team.flag} name={team.name} width={80} height={56} className="rounded shadow-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">{team.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            {team.group_name && (
              <span className="px-2 py-1 rounded-full bg-emerald-400/15 text-emerald-400 font-medium">
                Grupp {team.group_name}
              </span>
            )}
            <span className="px-2 py-1 rounded-full bg-gray-700/50 text-gray-300 font-mono">
              {team.code}
            </span>
            {facts?.nickname && (
              <span className="px-2 py-1 rounded-full bg-indigo-500/15 text-indigo-300">
                &ldquo;{facts.nickname}&rdquo;
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Statistik-rad */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatBox
          icon={<Trophy size={18} />}
          label="VM-titlar"
          value={facts?.worldCupTitles != null ? String(facts.worldCupTitles) : '–'}
          color="gold"
        />
        <StatBox
          icon={<Star size={18} />}
          label="Bästa VM-resultat"
          value={
            facts?.worldCupTitles
              ? `Vinnare ${facts.worldCupYears?.[facts.worldCupYears.length - 1] ?? ''}`.trim()
              : facts?.bestResult ?? '–'
          }
          color="blue"
          small
        />
        <StatBox
          icon={<Users size={18} />}
          label="Trupp"
          value={
            football && football.squad.length > 0 ? `${football.squad.length} spelare` : 'Ej publicerad'
          }
          color="green"
          small
        />
        <StatBox
          icon={<ShieldCheck size={18} />}
          label="Förbundskapten"
          value={football?.coachName ?? '–'}
          color="purple"
          small
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Landsfakta */}
        <section>
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Globe2 size={18} className="text-emerald-400" />
            Om landet
          </h2>
          {country ? (
            <div className="rounded-xl p-5 space-y-3" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <Row icon={<MapPin size={14} />} label="Huvudstad" value={country.capital ?? '–'} />
              <Row icon={<Users size={14} />} label="Befolkning" value={nfmt(country.population)} />
              <Row
                icon={<Globe2 size={14} />}
                label="Region"
                value={[country.region, country.subregion].filter(Boolean).join(' · ') || '–'}
              />
              <Row
                icon={<Star size={14} />}
                label="Yta"
                value={country.area != null ? `${nfmt(country.area)} km²` : '–'}
              />
              <Row
                icon={<User size={14} />}
                label="Språk"
                value={country.languages.length > 0 ? country.languages.join(', ') : '–'}
              />
              <Row icon={<Trophy size={14} />} label="Valuta" value={country.currency ?? '–'} />
            </div>
          ) : (
            <div className="rounded-xl p-5 text-sm text-gray-500"
              style={{ background: '#111827', border: '1px solid #1f2937' }}>
              Kunde inte hämta landsfakta just nu.
            </div>
          )}
        </section>

        {/* Roliga fakta */}
        <section>
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Star size={18} className="text-emerald-400" />
            Visste du att…
          </h2>
          <div className="rounded-xl p-5 space-y-3 text-sm text-gray-300"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            {facts?.facts && facts.facts.length > 0 ? (
              <ul className="space-y-2 list-none">
                {facts.facts.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-400 shrink-0">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">Inga särskilda fakta tillagda för {team.name} än.</p>
            )}
            {facts?.worldCupYears && facts.worldCupYears.length > 0 && (
              <div className="pt-3 border-t" style={{ borderColor: '#1f2937' }}>
                <div className="text-xs text-gray-500 mb-1">VM-titlar</div>
                <div className="flex flex-wrap gap-1.5">
                  {facts.worldCupYears.map(y => (
                    <span
                      key={y}
                      className="px-2 py-0.5 rounded text-xs font-bold bg-amber-400/15 text-amber-400"
                    >
                      {y}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Trupp */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users size={18} className="text-emerald-400" />
            Trupp
            {football && football.squad.length > 0 && (
              <span className="text-xs text-gray-500 font-normal">
                ({football.squad.length} spelare
                {football.squadIsProvisional ? ', provisorisk' : ''})
              </span>
            )}
          </h2>
          {(() => {
            const totalValue = groupedSquad.reduce((sum, p) => sum + (p.marketValueM ?? 0), 0)
            const playersWithValue = groupedSquad.filter(p => (p.marketValueM ?? 0) > 0).length
            if (totalValue === 0) return null
            return (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                }}
                title={`Summa marknadsvärde för ${playersWithValue} av ${groupedSquad.length} spelare i truppen.`}
              >
                <span className="text-gray-400 text-xs">Truppvärde:</span>
                <span className="font-bold text-emerald-400">
                  €{totalValue >= 1000 ? `${(totalValue / 1000).toFixed(2)}B` : `${totalValue.toFixed(0)}M`}
                </span>
              </div>
            )
          })()}
        </div>
        {!football || football.squad.length === 0 ? (
          <div className="rounded-xl p-6 text-sm text-gray-500"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            Truppen är inte publicerad än. VM-trupperna offentliggörs vanligtvis ett par veckor
            innan turneringen startar.
          </div>
        ) : (
          <div className="space-y-4">
            {football.squadIsProvisional && (
              <div
                className="rounded-xl px-4 py-3 text-xs flex items-start gap-2"
                style={{
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.25)',
                  color: '#fbbf24',
                }}
              >
                <Star size={14} className="mt-0.5 shrink-0" />
                <span>
                  Preliminär lista – stjärnspelare och senaste landslagsuttagningar. Ersätts
                  automatiskt när den officiella VM-truppen är spikad.
                </span>
              </div>
            )}
            {(['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] as const).map(posKey => {
              const players = groupedSquad.filter(
                p => normalizePosition(p.position) === posKey
              )
              if (players.length === 0) return null
              return (
                <div
                  key={posKey}
                  className="rounded-xl overflow-hidden"
                  style={{ background: '#111827', border: '1px solid #1f2937' }}
                >
                  <div
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-400"
                    style={{ background: '#1a2233' }}
                  >
                    {POSITION_LABELS[posKey]} ({players.length})
                  </div>
                  <div className="divide-y" style={{ borderColor: '#1f2937' }}>
                    {players.map(p => (
                      <PlayerRow key={p.id} p={p} photoUrl={photos.get(p.name) ?? null} />
                    ))}
                  </div>
                </div>
              )
            })}
            {/* Ej kategoriserade – endast om position helt saknas/okänd */}
            {groupedSquad.filter(p => normalizePosition(p.position) === null).length > 0 && (
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: '#111827', border: '1px solid #1f2937' }}
              >
                <div
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400"
                  style={{ background: '#1a2233' }}
                >
                  Övriga
                </div>
                <div className="divide-y" style={{ borderColor: '#1f2937' }}>
                  {groupedSquad
                    .filter(p => normalizePosition(p.position) === null)
                    .map(p => (
                      <PlayerRow key={p.id} p={p} photoUrl={photos.get(p.name) ?? null} />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function StatBox({
  icon,
  label,
  value,
  color,
  small,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: 'gold' | 'blue' | 'green' | 'purple'
  small?: boolean
}) {
  const colors = {
    gold: 'text-amber-400 bg-amber-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-emerald-400 bg-emerald-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
  }
  return (
    <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
      <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-3`}>{icon}</div>
      <div className={`font-bold text-white truncate ${small ? 'text-base' : 'text-2xl'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm gap-3">
      <span className="text-gray-500 flex items-center gap-2 shrink-0">
        {icon}
        {label}
      </span>
      <span className="text-white text-right truncate">{value}</span>
    </div>
  )
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function PlayerRow({ p, photoUrl }: { p: SquadPlayer; photoUrl: string | null }) {
  const a = age(p.dateOfBirth)
  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-white/5 transition-colors">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
        style={{ background: '#1f2937', color: '#10b981' }}>
        {p.shirtNumber ?? '–'}
      </div>
      <div
        className="relative w-10 h-10 rounded-full overflow-hidden shrink-0"
        style={{ background: '#1f2937', border: '1px solid #374151' }}
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={p.name}
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {initialsOf(p.name)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{p.name}</div>
        <div className="text-xs text-gray-500 truncate">
          {a != null && <span>{a} år · </span>}
          <span className={p.club ? 'text-gray-300' : 'text-gray-600 italic'}>
            {p.club ?? 'Klubb okänd'}
          </span>
        </div>
        {p.youthClub && (
          <div className="text-[11px] text-gray-600 truncate">
            Moderklubb: <span className="text-gray-400">{p.youthClub}</span>
          </div>
        )}
      </div>
      {p.marketValueM != null && (
        <span
          className="text-xs font-semibold shrink-0 px-2 py-0.5 rounded"
          title="Bedömt marknadsvärde"
          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}
        >
          {p.marketValueM >= 1 ? `€${p.marketValueM}M` : `€${(p.marketValueM * 1000).toFixed(0)}k`}
        </span>
      )}
      {p.dateOfBirth && (
        <>
          <Calendar size={12} className="text-gray-600 shrink-0" />
          <span className="text-xs text-gray-500 shrink-0 hidden sm:inline">
            {p.dateOfBirth.slice(0, 10)}
          </span>
        </>
      )}
    </div>
  )
}
