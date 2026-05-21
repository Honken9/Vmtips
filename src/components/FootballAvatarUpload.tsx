'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Sparkles, CheckCircle, AlertCircle, Camera, Shirt, Activity, MapPin, X, Lock } from 'lucide-react'
import Image from 'next/image'

interface Props {
  currentAvatar: string | null
  displayName: string
  userId: string
  initialGenerating: boolean
  locked: boolean
  onAvatarChange?: (url: string) => void
}

const TEAMS = [
  { value: 'Sverige', label: '🇸🇪 Sverige', kit: 'yellow jersey with blue trim, blue shorts, yellow socks' },
  { value: 'Brasilien', label: '🇧🇷 Brasilien', kit: 'iconic yellow jersey with green trim, blue shorts, white socks' },
  { value: 'Argentina', label: '🇦🇷 Argentina', kit: 'light blue and white striped jersey, black shorts, white socks' },
  { value: 'Tyskland', label: '🇩🇪 Tyskland', kit: 'white jersey with black trim, black shorts, white socks' },
  { value: 'Frankrike', label: '🇫🇷 Frankrike', kit: 'dark blue jersey, white shorts, red socks' },
  { value: 'England', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', kit: 'white jersey with three lions crest, white shorts, white socks' },
  { value: 'Spanien', label: '🇪🇸 Spanien', kit: 'red jersey with yellow trim, blue shorts, blue socks' },
  { value: 'Italien', label: '🇮🇹 Italien', kit: 'azure blue jersey, white shorts, blue socks' },
  { value: 'Portugal', label: '🇵🇹 Portugal', kit: 'red and green jersey, red shorts, red socks' },
  { value: 'Nederländerna', label: '🇳🇱 Nederländerna', kit: 'orange jersey, white shorts, orange socks' },
  { value: 'Belgien', label: '🇧🇪 Belgien', kit: 'red jersey with black and yellow trim, red shorts, red socks' },
  { value: 'Kroatien', label: '🇭🇷 Kroatien', kit: 'red and white checkered jersey, white shorts, blue socks' },
  { value: 'Norge', label: '🇳🇴 Norge', kit: 'red jersey with blue and white trim, white shorts, red socks' },
  // ── Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿 ──
  { value: 'Manchester United', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Manchester United', kit: 'red jersey with white trim, white shorts, black socks' },
  { value: 'Manchester City', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Manchester City', kit: 'sky blue jersey, white shorts, sky blue socks' },
  { value: 'Liverpool', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Liverpool', kit: 'all-red jersey, red shorts, red socks' },
  { value: 'Arsenal', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Arsenal', kit: 'red jersey with white sleeves, white shorts, white socks with red trim' },
  { value: 'Chelsea', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Chelsea', kit: 'royal blue jersey, blue shorts, white socks' },
  { value: 'Tottenham', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Tottenham Hotspur', kit: 'white jersey with navy trim, navy shorts, white socks' },
  { value: 'Newcastle', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Newcastle United', kit: 'black and white striped jersey, black shorts, black socks' },
  { value: 'Aston Villa', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Aston Villa', kit: 'claret jersey with sky blue sleeves, white shorts, sky blue socks' },
  { value: 'West Ham', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 West Ham United', kit: 'claret and sky blue jersey, white shorts, white socks' },

  // ── La Liga 🇪🇸 ──
  { value: 'Real Madrid', label: '🇪🇸 Real Madrid', kit: 'all-white jersey with gold trim, white shorts, white socks' },
  { value: 'Barcelona', label: '🇪🇸 FC Barcelona', kit: 'blue and red vertical striped jersey, blue shorts, blue socks' },
  { value: 'Atlético Madrid', label: '🇪🇸 Atlético Madrid', kit: 'red and white striped jersey, blue shorts, red socks' },
  { value: 'Sevilla', label: '🇪🇸 Sevilla', kit: 'all-white jersey with red trim, white shorts, white socks' },
  { value: 'Valencia', label: '🇪🇸 Valencia', kit: 'white jersey with orange trim, black shorts, white socks' },
  { value: 'Athletic Bilbao', label: '🇪🇸 Athletic Bilbao', kit: 'red and white striped jersey, black shorts, black socks' },

  // ── Serie A 🇮🇹 ──
  { value: 'Juventus', label: '🇮🇹 Juventus', kit: 'black and white striped jersey, white shorts, black socks' },
  { value: 'AC Milan', label: '🇮🇹 AC Milan', kit: 'red and black striped jersey, white shorts, black socks' },
  { value: 'Inter Milan', label: '🇮🇹 Inter Milan', kit: 'blue and black striped jersey, black shorts, black socks' },
  { value: 'Roma', label: '🇮🇹 AS Roma', kit: 'maroon jersey with orange trim, white shorts, black socks' },
  { value: 'Napoli', label: '🇮🇹 Napoli', kit: 'sky blue jersey, white shorts, sky blue socks' },
  { value: 'Lazio', label: '🇮🇹 Lazio', kit: 'sky blue jersey with white trim, white shorts, sky blue socks' },

  // ── Bundesliga 🇩🇪 ──
  { value: 'Bayern München', label: '🇩🇪 Bayern München', kit: 'red jersey with white details, red shorts, red socks' },
  { value: 'Borussia Dortmund', label: '🇩🇪 Borussia Dortmund', kit: 'bright yellow jersey with black trim, black shorts, yellow socks' },
  { value: 'RB Leipzig', label: '🇩🇪 RB Leipzig', kit: 'white jersey with red trim, white shorts, white socks' },
  { value: 'Bayer Leverkusen', label: '🇩🇪 Bayer Leverkusen', kit: 'red and black striped jersey, black shorts, black socks' },
  { value: 'Schalke 04', label: '🇩🇪 Schalke 04', kit: 'royal blue jersey with white trim, white shorts, blue socks' },

  // ── Ligue 1 🇫🇷 ──
  { value: 'Paris Saint-Germain', label: '🇫🇷 Paris Saint-Germain', kit: 'navy blue jersey with red and white center stripe, navy shorts, navy socks' },
  { value: 'Olympique Marseille', label: '🇫🇷 Olympique Marseille', kit: 'all-white jersey with sky blue trim, white shorts, white socks' },
  { value: 'Olympique Lyon', label: '🇫🇷 Olympique Lyon', kit: 'white jersey with red and blue trim, white shorts, white socks' },
  { value: 'Monaco', label: '🇫🇷 AS Monaco', kit: 'red and white diagonal halves jersey, white shorts, red socks' },

  // ── Eredivisie 🇳🇱 ──
  { value: 'Ajax', label: '🇳🇱 Ajax Amsterdam', kit: 'white jersey with broad red center stripe, white shorts, white socks' },
  { value: 'PSV Eindhoven', label: '🇳🇱 PSV Eindhoven', kit: 'red and white striped jersey, white shorts, red socks' },
  { value: 'Feyenoord', label: '🇳🇱 Feyenoord', kit: 'red and white halves jersey, black shorts, black socks' },

  // ── Primeira Liga 🇵🇹 ──
  { value: 'FC Porto', label: '🇵🇹 FC Porto', kit: 'blue and white striped jersey, white shorts, white socks' },
  { value: 'Benfica', label: '🇵🇹 Benfica', kit: 'red jersey with white trim, white shorts, red socks' },
  { value: 'Sporting CP', label: '🇵🇹 Sporting CP', kit: 'green and white horizontal hooped jersey, white shorts, green socks' },

  // ── Allsvenskan 🇸🇪 ──
  { value: 'AIK', label: '🇸🇪 AIK', kit: 'black jersey with yellow trim, black shorts, black socks' },
  { value: 'Hammarby', label: '🇸🇪 Hammarby', kit: 'green and white striped jersey, white shorts, green socks' },
  { value: 'Djurgården', label: '🇸🇪 Djurgården', kit: 'dark blue jersey with light blue stripes, dark blue shorts, dark blue socks' },
  { value: 'IFK Göteborg', label: '🇸🇪 IFK Göteborg', kit: 'blue and white striped jersey, white shorts, blue socks' },
  { value: 'Malmö FF', label: '🇸🇪 Malmö FF', kit: 'sky blue jersey, white shorts, blue socks' },
  { value: 'IFK Norrköping', label: '🇸🇪 IFK Norrköping', kit: 'blue and white striped jersey, white shorts, blue socks' },
  { value: 'Elfsborg', label: '🇸🇪 IF Elfsborg', kit: 'yellow jersey with black trim, black shorts, yellow socks' },
]

const POSES = [
  { value: 'celebrating', label: '🎉 Firar mål', desc: 'arms raised in victorious celebration after scoring a goal, ecstatic joyful expression' },
  { value: 'shooting', label: '⚽ Skjuter på mål', desc: 'mid-action striking a football with full power, leg extended, intense focus' },
  { value: 'running', label: '🏃 Springer med bollen', desc: 'sprinting at full speed with the football, dynamic action pose, hair blowing' },
  { value: 'bicycle', label: '🤸 Cykelspark', desc: 'mid-air performing a spectacular bicycle kick (overhead kick), acrobatic pose' },
  { value: 'header', label: '🤯 Nickar boll', desc: 'jumping high to head a football, intense determined expression' },
  { value: 'dribbling', label: '🪄 Driblar', desc: 'dribbling the football past defenders, agile balanced stance' },
  { value: 'penalty', label: '🎯 Sparkar straff', desc: 'in the act of taking a penalty kick, focused composed expression' },
  { value: 'standing', label: '🦁 Står stolt', desc: 'standing confidently with the football under one arm, proud heroic pose, looking at camera' },
  { value: 'sliding', label: '🦵 Glidtackling', desc: 'making a dramatic sliding tackle, leg extended, grass flying' },
  { value: 'trophy', label: '🏆 Lyfter pokalen', desc: 'lifting a golden trophy above head, mouth open shouting in victory, confetti falling' },
  { value: 'goalkeeper', label: '🧤 Målvakts­räddning', desc: 'goalkeeper diving sideways to make a spectacular save, full stretch in mid-air, gloves outstretched' },
]

const ARENAS = [
  { value: 'Friends Arena', label: '🇸🇪 Friends Arena (Stockholm)', desc: 'Friends Arena in Stockholm, Sweden, with retractable roof and yellow-blue Swedish fans' },
  { value: 'Wembley', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Wembley Stadium (London)', desc: 'iconic Wembley Stadium in London with its famous arch lit up, packed crowd' },
  { value: 'Camp Nou', label: '🇪🇸 Camp Nou (Barcelona)', desc: 'massive Camp Nou stadium in Barcelona with red and blue crowd, towering stands' },
  { value: 'Bernabéu', label: '🇪🇸 Santiago Bernabéu (Madrid)', desc: 'modern Santiago Bernabéu stadium in Madrid with sleek architecture, white sea of fans' },
  { value: 'San Siro', label: '🇮🇹 San Siro (Milano)', desc: 'historic San Siro stadium in Milan with characteristic spiral towers, dramatic lighting' },
  { value: 'Maracanã', label: '🇧🇷 Maracanã (Rio de Janeiro)', desc: 'legendary Maracanã stadium in Rio de Janeiro, Brazilian carnival atmosphere, yellow-green crowd' },
  { value: 'Allianz Arena', label: '🇩🇪 Allianz Arena (München)', desc: 'Allianz Arena in Munich glowing red at night, futuristic exterior visible through windows' },
  { value: 'Old Trafford', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Old Trafford (Manchester)', desc: 'Old Trafford "Theatre of Dreams" in Manchester, red Manchester United crowd' },
  { value: 'MetLife Stadium', label: '🇺🇸 MetLife Stadium (USA)', desc: 'huge MetLife Stadium in New Jersey USA, modern American sports venue' },
  { value: 'Estadio Azteca', label: '🇲🇽 Estadio Azteca (Mexico City)', desc: 'massive Estadio Azteca in Mexico City with steep stands and Mexican fans waving flags' },
  { value: 'Anfield', label: '🇬🇧 Anfield (Liverpool)', desc: 'electric Anfield stadium with the Kop end singing You Will Never Walk Alone, red scarves' },
  { value: 'Tele2 Arena', label: '🇸🇪 Tele2 Arena (Stockholm)', desc: 'Tele2 Arena in Stockholm Sweden, modern multipurpose stadium with green pitch' },
]

export function FootballAvatarUpload({ currentAvatar, displayName, userId, initialGenerating, locked, onAvatarChange }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [preview, setPreview] = useState<string | null>(null)
  const [generating, setGenerating] = useState(initialGenerating)
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(currentAvatar)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState(false)
  const [success, setSuccess] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [team, setTeam] = useState(TEAMS[0].value)
  const [pose, setPose] = useState(POSES[0].value)
  const [arena, setArena] = useState(ARENAS[0].value)
  const [countdown, setCountdown] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 3-2-1-räknare → skicka till startsidan så användaren inte fastnar och
  // väntar på Gemini. Genereringen fortsätter på servern.
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      router.push('/')
      return
    }
    const t = setTimeout(() => setCountdown(c => (c == null ? null : c - 1)), 1000)
    return () => clearTimeout(t)
  }, [countdown, router])

  // Pollar profilen var 4:e sek när en generering pågår – när
  // avatar_generating flippar till false visas den nya bilden direkt.
  // Timeout-skydd: om servern inte svarat på 3 min, behandla som krasch
  // och nollställ flaggan så användaren kan försöka igen.
  useEffect(() => {
    if (!generating) return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, avatar_generating, last_avatar_generated_at')
        .eq('id', userId)
        .single()
      if (!data) return

      // Klart!
      if (data.avatar_generating === false) {
        setGenerating(false)
        if (data.avatar_url && data.avatar_url !== generatedAvatar) {
          setGeneratedAvatar(data.avatar_url)
          setSuccess(true)
          onAvatarChange?.(data.avatar_url)
          setTimeout(() => setSuccess(false), 4000)
        }
        router.refresh()
        return
      }

      // Timeout-skydd: om generering startade > 3 min sen, anta krasch
      if (data.last_avatar_generated_at) {
        const elapsedMs = Date.now() - new Date(data.last_avatar_generated_at).getTime()
        if (elapsedMs > 3 * 60 * 1000) {
          await supabase
            .from('profiles')
            .update({ avatar_generating: false })
            .eq('id', userId)
          setGenerating(false)
          setError('Det tog för lång tid. Försök igen, eller prova en annan bild.')
        }
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [generating, userId, supabase, generatedAvatar, onAvatarChange, router])

  async function cancelGeneration() {
    await supabase
      .from('profiles')
      .update({ avatar_generating: false })
      .eq('id', userId)
    setGenerating(false)
    setError(null)
  }

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Välj en bildfil (JPG, PNG etc.)')
      return
    }
    setError(null)
    setSuccess(false)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  // Mild komprimering: behåller originalets dimensioner och kodar som
  // JPEG med 90%-kvalitet. Ger ~10% mindre filstorlek utan synlig kvalitets-
  // förlust på ansikten — minskar risken för 504-timeout vid Gemini-anrop.
  async function compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context saknas'))
          return
        }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Komprimering misslyckades'))
              return
            }
            const baseName = file.name.replace(/\.[^.]+$/, '')
            resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }))
          },
          'image/jpeg',
          0.9
        )
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Kunde inte läsa bilden'))
      }
      img.src = url
    })
  }

  async function handleGenerate() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setError(null)
    setGenerating(true)

    let uploadFile = file
    try {
      uploadFile = await compressImage(file)
    } catch {
      // Om komprimering failar, fall tillbaka på originalet
    }

    const form = new FormData()
    form.append('image', uploadFile)
    form.append('team', team)
    form.append('pose', pose)
    form.append('arena', arena)

    // Starta 3-2-1-räkning som skickar användaren till startsidan –
    // genereringen fortsätter på servern och bilden dyker upp senare.
    setCountdown(3)

    // Fire-and-forget: servern fortsätter köra även om vi navigerar
    // bort eller stänger fliken. Status pollas via avatar_generating.
    fetch('/api/generate-football-image', { method: 'POST', body: form })
      .then(async res => {
        if (res.ok) return
        // 504/502 = Vercels gateway timeout. Servern KAN fortfarande
        // slutföra Gemini-anropet i bakgrunden — låt pollingen avgöra.
        // (avatar_generating-flaggan rensas av routens finally-block om
        // servern hinner, eller av polling-timeouten på 3 min.)
        if (res.status === 504 || res.status === 502) return

        // Andra fel: rensa state och visa tydligt felmeddelande.
        const data = await res.json().catch(() => ({}))
        await supabase
          .from('profiles')
          .update({ avatar_generating: false })
          .eq('id', userId)
        setGenerating(false)
        setError(data.error || `Generering misslyckades (${res.status})`)
      })
      .catch(async () => {
        // Nätverksfel eller fetch-abort – pollingen brukar fixa det
        // men vi väntar 30 sek innan vi släpper. Om servern faktiskt
        // hängt hjälper det inte att rensa här direkt eftersom servern
        // kan vara i mitten av en lyckad körning.
      })
  }

  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ background: '#1f2937' }}>
        <Sparkles size={18} className="text-emerald-400" />
        <span className="font-bold text-white">AI-profilbild</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#111827', color: '#9ca3af' }}>
          fotbollsproffs
        </span>
      </div>

      <div className="p-5 space-y-5" style={{ background: '#0f172a' }}>
        {/* Nuvarande avatar – stor helkropps-vy */}
        <div className="flex flex-col items-center gap-3">
          {generatedAvatar ? (
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="relative w-full max-w-xs aspect-[3/4] rounded-2xl overflow-hidden cursor-zoom-in group"
              style={{ border: '2px solid #374151', background: '#111827' }}
              aria-label="Visa större bild"
            >
              <Image
                src={generatedAvatar}
                alt={displayName}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, 400px"
                priority
              />
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.6)' }}>
                Klicka för stor
              </div>
            </button>
          ) : (
            <div className="relative w-full max-w-xs aspect-[3/4] rounded-2xl overflow-hidden"
              style={{ border: '2px solid #374151', background: '#111827' }}>
              <div className="w-full h-full flex items-center justify-center text-6xl font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {initials}
              </div>
            </div>
          )}
          <div className="text-center">
            <div className="text-base font-semibold text-white">{displayName}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {generatedAvatar ? 'AI-genererad bild aktiv' : 'Ingen bild ännu'}
            </div>
          </div>
        </div>

        {/* "Skapar bilden..."-overlay – ersätter hela upload-blocket
            tills servern är klar. Pollar var 4:e sek så användaren kan
            scrolla, byta sida eller refreshna utan att förlora status.
            Om något fastnar > 3 min auto-rensar pollingen. */}
        {generating && (
          <div
            className="rounded-xl flex flex-col items-center justify-center gap-4 py-10 px-5 text-center"
            style={{
              border: '2px dashed rgba(16,185,129,0.4)',
              background: 'rgba(16,185,129,0.06)',
            }}
          >
            <div className="relative">
              <Loader2 size={36} className="animate-spin text-emerald-400" />
              <Sparkles size={14} className="absolute -top-1 -right-1 text-amber-400 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Bilden skapas…</p>
              <p className="text-xs text-gray-400 mt-1">
                Tar ungefär 30–60 sekunder. Du kan scrolla runt eller byta sida –
                bilden dyker upp här när den är klar.
              </p>
            </div>
            <button
              onClick={cancelGeneration}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors underline"
            >
              Avbryt och försök med annan bild
            </button>
          </div>
        )}

        {/* Lås-vy: en bild per användare. Admin kan låsa upp via admin-vyn. */}
        {locked && !generating && (
          <div
            className="rounded-xl flex flex-col items-center gap-3 py-8 px-5 text-center"
            style={{
              border: '1px solid rgba(245,158,11,0.3)',
              background: 'rgba(245,158,11,0.06)',
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.15)' }}
            >
              <Lock size={22} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Bilden är låst</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                En profilbild per användare. Vill du skapa en ny – kontakta admin
                så låser de upp åt dig.
              </p>
            </div>
          </div>
        )}

        {/* Upload-zon (visas inte under pågående generering eller när låst) */}
        {!generating && !locked && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-xl flex flex-col items-center justify-center gap-3 py-8 transition-all"
          style={{
            border: `2px dashed ${dragOver ? '#10b981' : preview ? '#6366f1' : '#374151'}`,
            background: dragOver ? 'rgba(16,185,129,0.05)' : preview ? 'rgba(99,102,241,0.05)' : '#111827',
          }}
        >
          {preview ? (
            <>
              <div className="relative w-24 h-24 rounded-xl overflow-hidden"
                style={{ border: '2px solid #6366f1' }}>
                <Image src={preview} alt="Förhandsgranskning" fill className="object-cover" />
              </div>
              <p className="text-sm text-indigo-400">Bild vald – klicka för att byta</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: '#1f2937' }}>
                <Camera size={22} className="text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">Ladda upp ett foto av dig</p>
                <p className="text-xs text-gray-500 mt-1">Klicka eller dra hit · JPG, PNG · max 5 MB</p>
              </div>
            </>
          )}
        </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {/* Anpassa-sektion: lag, pose, arena */}
        {preview && !generating && !locked && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                <Shirt size={12} className="text-emerald-400" />
                Favoritlag
              </label>
              <select
                value={team}
                onChange={e => setTeam(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              >
                {TEAMS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                <Activity size={12} className="text-emerald-400" />
                Rörelse
              </label>
              <select
                value={pose}
                onChange={e => setPose(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              >
                {POSES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                <MapPin size={12} className="text-emerald-400" />
                Arena
              </label>
              <select
                value={arena}
                onChange={e => setArena(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              >
                {ARENAS.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Generera-knapp */}
        {preview && !generating && !locked && (
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: 'linear-gradient(135deg, #10b981, #ef4444)',
              color: '#000',
            }}
          >
            <Sparkles size={16} />
            Gör mig till fotbollsproffs!
          </button>
        )}

        {/* Feedback */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-green-400 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(34,197,94,0.1)' }}>
            <CheckCircle size={14} />
            Profilbild uppdaterad!
          </div>
        )}

        <p className="text-xs text-gray-600 text-center">
          AI bevarar ditt ansikte och klär dig i en fotbollsdräkt. Tar 30–60 sekunder.
        </p>
      </div>

      {/* Räknar-modal: visas direkt när generering startar och skickar
          till startsidan på 0 så användaren slipper sitta och vänta. */}
      {countdown !== null && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-w-md w-full rounded-2xl p-8 text-center space-y-5"
            style={{
              background: 'linear-gradient(135deg, #0c2823 0%, #14202e 50%, #0a3d2a 100%)',
              border: '1px solid rgba(16,185,129,0.3)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex justify-center">
              <div className="relative">
                <Loader2 size={48} className="animate-spin text-emerald-400" />
                <Sparkles size={18} className="absolute -top-1 -right-1 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Du görs till ett fotbollsproffs!</h2>
              <p className="text-sm text-gray-300 mt-2 leading-relaxed">
                Bilden skapas i bakgrunden. Du skickas till startsidan – bilden dyker upp där så fort den är klar.
              </p>
            </div>
            <div className="pt-2">
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full text-4xl font-black"
                style={{
                  background: 'rgba(16,185,129,0.15)',
                  border: '2px solid rgba(16,185,129,0.5)',
                  color: '#10b981',
                }}
              >
                {countdown > 0 ? countdown : 'Klart'}
              </div>
              <p className="text-xs text-gray-500 mt-3">Skickar till startsidan…</p>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox – fullskärms-vy vid klick */}
      {lightbox && generatedAvatar && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 cursor-zoom-out"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Stäng"
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <X size={20} />
          </button>
          <div className="relative max-h-[95vh] max-w-[95vw] aspect-[3/4]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={generatedAvatar}
              alt={displayName}
              className="max-h-[95vh] max-w-[95vw] object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}
