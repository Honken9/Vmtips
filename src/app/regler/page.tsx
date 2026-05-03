import { createClient } from '@/lib/supabase/server'
import type { Settings } from '@/lib/types'
import { BookOpen, Target, Trophy, Star, Lock, Zap, Users, Dices } from 'lucide-react'

export const revalidate = 60

export default async function ReglerPage() {
  const supabase = await createClient()
  const { data: settings } = await supabase.from('settings').select('*').single()
  const s = (settings as Settings | null) ?? {
    id: 1,
    tournament_mode: 'B' as const,
    mode_a_global_lock: false,
    points_correct_result: 3,
    points_exact_score: 5,
    points_winner: 10,
    points_finalist: 5,
    updated_at: new Date().toISOString(),
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen size={22} className="text-emerald-400" />
          Regler & så funkar det
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Kort guide till poäng, lägen och funktioner.
        </p>
      </div>

      {/* Poängsystem */}
      <Section icon={<Trophy size={18} />} title="Poängsystem">
        <div className="grid sm:grid-cols-2 gap-3">
          <PointBox
            label="Rätt tecken (1/X/2)"
            value={`${s.points_correct_result} p`}
            description="Du har tippat rätt vinnare eller rätt på oavgjort, men inte exakt resultat. T.ex. tippat 1–0 men matchen slutade 2–1 → samma tecken (1) → 3p."
          />
          <PointBox
            label="Exakt resultat"
            value={`${s.points_exact_score} p`}
            description="Du har tippat exakta antalet mål för båda lagen. T.ex. tippat 2–1 och matchen slutade 2–1."
            gold
          />
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Exakt resultat ger bara den högre poängen – ingen dubbelräkning.
        </p>
      </Section>

      {/* Bonustips */}
      <Section icon={<Star size={18} />} title="Bonustips">
        <p className="text-sm text-gray-300 mb-3">
          På sidan <strong>Mina tips</strong> kan du också tippa tre bonusfrågor som
          poängbedöms när VM är slut:
        </p>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">⚽</span>
            <span><strong>Skytteligavinnare</strong> – vilken spelare gör flest mål? Rätt namn = 5p.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">🟨</span>
            <span><strong>Flest gula kort</strong> – vilket lag samlar på sig flest gula? Rätt lag = 5p.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">🥅</span>
            <span><strong>Totalt antal mål</strong> – hur många mål görs i hela turneringen? Exakt rätt = 5p.</span>
          </li>
        </ul>
      </Section>

      {/* Lägen */}
      <Section icon={<Zap size={18} />} title="Två sätt att tippa">
        <div className="grid sm:grid-cols-2 gap-3">
          <ModeBox
            label="Läge A – Tippa allt på en gång"
            active={s.tournament_mode === 'A'}
            description="Alla 104 matchresultat tippas innan turneringen drar igång. Sedan låses alla dina tips samtidigt med en knapptryckning. Mer skill-fokus – du måste förutspå hela turneringen i förväg."
          />
          <ModeBox
            label="Läge B – Per match"
            active={s.tournament_mode === 'B'}
            description="Du kan tippa när du vill, ända fram till matchens avspark. Vid avspark låses tipset automatiskt och kan inte ändras. Mer flexibelt – du kan justera baserat på lagens form, skador osv."
          />
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Aktivt läge just nu: <strong className="text-white">{s.tournament_mode}</strong>.
          Admin kan byta mellan lägena i Inställningar.
        </p>
      </Section>

      {/* Pools */}
      <Section icon={<Users size={18} />} title="Pools (tipsligor)">
        <p className="text-sm text-gray-300 mb-3">
          Varje deltagare tävlar i en pool – du tävlar bara mot andra i samma pool.
        </p>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">→</span>
            <span>Skapa egen pool och få en 6-tecken invite-kod att dela med kompisar.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">→</span>
            <span>Eller gå med i en befintlig pool genom att klistra in koden vid registrering.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">→</span>
            <span>Du kan byta pool när som helst på <strong>Min profil</strong>.</span>
          </li>
        </ul>
      </Section>

      {/* Slumpa */}
      <Section icon={<Dices size={18} />} title="Slumpa fram tips">
        <p className="text-sm text-gray-300">
          På <strong>Mina tips</strong> finns en knapp för att slumpa fram resultat på
          alla otippade matcher. Slumpningen följer realistiska målfördelningar:
          0–2 mål är vanligast, max 7 mål per lag, slutspelsmatcher får alltid en
          vinnare. Praktiskt om du vill ha något inlagt på alla matcher men inte
          orkar tippa alla själv.
        </p>
      </Section>

      {/* Låsning */}
      <Section icon={<Lock size={18} />} title="När låses tipsen?">
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex gap-3">
            <Lock size={14} className="text-emerald-400 shrink-0 mt-1" />
            <p>
              <strong>Läge A:</strong> När du klickar &quot;Skicka in&quot; – då sparas
              alla 104 tips och du kan inte ändra fler. Innan dess kan du redigera
              fritt.
            </p>
          </div>
          <div className="flex gap-3">
            <Lock size={14} className="text-emerald-400 shrink-0 mt-1" />
            <p>
              <strong>Läge B:</strong> Automatiskt vid varje matchs avspark. Tips på
              matcher som ännu inte börjat kan fortfarande ändras.
            </p>
          </div>
          <div className="flex gap-3">
            <Target size={14} className="text-amber-400 shrink-0 mt-1" />
            <p>
              <strong>OBS:</strong> Bara <strong>låsta</strong> tips räknas på
              tabellen. Otippade eller olåsta tips ger 0p.
            </p>
          </div>
        </div>
      </Section>

      {/* Övrigt */}
      <Section icon={<BookOpen size={18} />} title="Bra att veta">
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">•</span>
            <span>Tabellen sorteras på poäng → exakta resultat → rätt tecken → namn vid lika poäng.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">•</span>
            <span>Klicka på ett namn i tabellen för att se den spelarens alla tips och statistik.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">•</span>
            <span>Resultat hämtas automatiskt från football-data.org under turneringens gång – admin kan korrigera manuellt vid behov.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">•</span>
            <span>Sidan är installerbar på mobilen – &quot;Lägg till på hemskärmen&quot; i webbläsaren.</span>
          </li>
        </ul>
      </Section>
    </div>
  )
}

function Section({
  icon, title, children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <span className="text-emerald-400">{icon}</span>
        {title}
      </h2>
      <div
        className="rounded-xl p-5"
        style={{ background: '#111827', border: '1px solid #1f2937' }}
      >
        {children}
      </div>
    </section>
  )
}

function PointBox({
  label, value, description, gold,
}: {
  label: string
  value: string
  description: string
  gold?: boolean
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: gold ? 'rgba(245,158,11,0.06)' : '#1f2937',
        border: `1px solid ${gold ? 'rgba(245,158,11,0.25)' : '#374151'}`,
      }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-gray-400">{label}</span>
        <span className={`text-xl font-bold ${gold ? 'text-amber-400' : 'text-emerald-400'}`}>
          {value}
        </span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
    </div>
  )
}

function ModeBox({
  label, active, description,
}: {
  label: string
  active: boolean
  description: string
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: active ? 'rgba(16,185,129,0.05)' : '#1f2937',
        border: `1px solid ${active ? 'rgba(16,185,129,0.3)' : '#374151'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-white">{label}</span>
        {active && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 uppercase tracking-wider">
            Aktivt
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
    </div>
  )
}
