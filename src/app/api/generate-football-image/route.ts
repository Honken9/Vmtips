import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export const maxDuration = 60 // Gemini är snabb – 1 min räcker

// Beskrivningar för varje val (måste matcha värdena i FootballAvatarUpload.tsx)
const TEAM_KITS: Record<string, string> = {
  'Sverige': 'yellow jersey with blue trim, blue shorts, yellow socks',
  'Brasilien': 'iconic yellow jersey with green trim, blue shorts, white socks',
  'Argentina': 'light blue and white striped jersey, black shorts, white socks',
  'Tyskland': 'white jersey with black trim, black shorts, white socks',
  'Frankrike': 'dark blue jersey, white shorts, red socks',
  'England': 'white jersey with three lions crest, white shorts, white socks',
  'Spanien': 'red jersey with yellow trim, blue shorts, blue socks',
  'Italien': 'azure blue jersey, white shorts, blue socks',
  'Portugal': 'red and green jersey, red shorts, red socks',
  'Nederländerna': 'orange jersey, white shorts, orange socks',
  'Belgien': 'red jersey with black and yellow trim, red shorts, red socks',
  'Kroatien': 'red and white checkered jersey, white shorts, blue socks',
  'Norge': 'red jersey with blue and white trim, white shorts, red socks',
  // Premier League
  'Manchester United': 'red jersey with white trim, white shorts, black socks',
  'Manchester City': 'sky blue jersey, white shorts, sky blue socks',
  'Liverpool': 'all-red jersey, red shorts, red socks',
  'Arsenal': 'red jersey with white sleeves, white shorts, white socks with red trim',
  'Chelsea': 'royal blue jersey, blue shorts, white socks',
  'Tottenham': 'white jersey with navy trim, navy shorts, white socks',
  'Newcastle': 'black and white striped jersey, black shorts, black socks',
  'Aston Villa': 'claret jersey with sky blue sleeves, white shorts, sky blue socks',
  'West Ham': 'claret and sky blue jersey, white shorts, white socks',
  // La Liga
  'Real Madrid': 'all-white jersey with gold trim, white shorts, white socks',
  'Barcelona': 'blue and red vertical striped jersey, blue shorts, blue socks',
  'Atlético Madrid': 'red and white striped jersey, blue shorts, red socks',
  'Sevilla': 'all-white jersey with red trim, white shorts, white socks',
  'Valencia': 'white jersey with orange trim, black shorts, white socks',
  'Athletic Bilbao': 'red and white striped jersey, black shorts, black socks',
  // Serie A
  'Juventus': 'black and white striped jersey, white shorts, black socks',
  'AC Milan': 'red and black striped jersey, white shorts, black socks',
  'Inter Milan': 'blue and black striped jersey, black shorts, black socks',
  'Roma': 'maroon jersey with orange trim, white shorts, black socks',
  'Napoli': 'sky blue jersey, white shorts, sky blue socks',
  'Lazio': 'sky blue jersey with white trim, white shorts, sky blue socks',
  // Bundesliga
  'Bayern München': 'red jersey with white details, red shorts, red socks',
  'Borussia Dortmund': 'bright yellow jersey with black trim, black shorts, yellow socks',
  'RB Leipzig': 'white jersey with red trim, white shorts, white socks',
  'Bayer Leverkusen': 'red and black striped jersey, black shorts, black socks',
  'Schalke 04': 'royal blue jersey with white trim, white shorts, blue socks',
  // Ligue 1
  'Paris Saint-Germain': 'navy blue jersey with red and white center stripe, navy shorts, navy socks',
  'Olympique Marseille': 'all-white jersey with sky blue trim, white shorts, white socks',
  'Olympique Lyon': 'white jersey with red and blue trim, white shorts, white socks',
  'Monaco': 'red and white diagonal halves jersey, white shorts, red socks',
  // Eredivisie
  'Ajax': 'white jersey with broad red center stripe, white shorts, white socks',
  'PSV Eindhoven': 'red and white striped jersey, white shorts, red socks',
  'Feyenoord': 'red and white halves jersey, black shorts, black socks',
  // Primeira Liga
  'FC Porto': 'blue and white striped jersey, white shorts, white socks',
  'Benfica': 'red jersey with white trim, white shorts, red socks',
  'Sporting CP': 'green and white horizontal hooped jersey, white shorts, green socks',
  // Allsvenskan
  'AIK': 'black jersey with yellow trim, black shorts, black socks',
  'Hammarby': 'green and white striped jersey, white shorts, green socks',
  'Djurgården': 'dark blue jersey with light blue stripes, dark blue shorts, dark blue socks',
  'IFK Göteborg': 'blue and white striped jersey, white shorts, blue socks',
  'Malmö FF': 'sky blue jersey, white shorts, blue socks',
  'IFK Norrköping': 'blue and white striped jersey, white shorts, blue socks',
  'Elfsborg': 'yellow jersey with black trim, black shorts, yellow socks',
}

const POSE_DESCRIPTIONS: Record<string, string> = {
  'celebrating': 'arms raised in victorious celebration after scoring a goal, ecstatic joyful expression',
  'shooting': 'mid-action striking a football with full power, leg extended, intense focus',
  'running': 'sprinting at full speed with the football, dynamic action pose',
  'bicycle': 'mid-air performing a spectacular bicycle kick (overhead kick), acrobatic pose',
  'header': 'jumping high to head a football, intense determined expression',
  'dribbling': 'dribbling the football past defenders, agile balanced stance',
  'penalty': 'in the act of taking a penalty kick, focused composed expression',
  'standing': 'standing confidently with the football under one arm, proud heroic pose, looking at camera',
  'sliding': 'making a dramatic sliding tackle, leg extended, grass flying',
  'trophy': 'lifting a golden trophy above head, mouth open shouting in victory, confetti falling',
  'goalkeeper': 'goalkeeper diving sideways to make a spectacular save, full stretch in mid-air, gloves outstretched',
}

const ARENA_DESCRIPTIONS: Record<string, string> = {
  'Friends Arena': 'Friends Arena in Stockholm Sweden with retractable roof and yellow-blue Swedish fans',
  'Wembley': 'iconic Wembley Stadium in London with its famous arch lit up, packed crowd',
  'Camp Nou': 'massive Camp Nou stadium in Barcelona with red and blue crowd, towering stands',
  'Bernabéu': 'modern Santiago Bernabéu stadium in Madrid with sleek architecture, white sea of fans',
  'San Siro': 'historic San Siro stadium in Milan with characteristic spiral towers, dramatic lighting',
  'Maracanã': 'legendary Maracanã stadium in Rio de Janeiro, Brazilian carnival atmosphere, yellow-green crowd',
  'Allianz Arena': 'Allianz Arena in Munich glowing red at night, futuristic exterior visible through windows',
  'Old Trafford': 'Old Trafford "Theatre of Dreams" in Manchester, red Manchester United crowd',
  'MetLife Stadium': 'huge MetLife Stadium in New Jersey USA, modern American sports venue',
  'Estadio Azteca': 'massive Estadio Azteca in Mexico City with steep stands and Mexican fans waving flags',
  'Anfield': 'electric Anfield stadium with the Kop end, red scarves held high',
  'Tele2 Arena': 'Tele2 Arena in Stockholm Sweden, modern multipurpose stadium with green pitch',
}

export async function POST(request: NextRequest) {
  // Autentisering
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin-klient för storage & DB (kringgår RLS)
  const admin = createAdminClient()

  const formData = await request.formData()
  const imageFile = formData.get('image') as File | null
  if (!imageFile) return NextResponse.json({ error: 'No image' }, { status: 400 })

  // targetUserId: admin kan generera åt en annan deltagare. Saknas/lika
  // med egen id → vanligt själv-flöde med lås + rate-limit.
  const targetUserId = (formData.get('targetUserId') as string) || user.id
  const isAdminGenerating = targetUserId !== user.id

  if (isAdminGenerating) {
    const { data: me } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (me?.is_admin !== true) {
      return NextResponse.json({ error: 'Endast admin får generera åt andra' }, { status: 403 })
    }
  } else {
    // Själv-flöde: lås + rate-limit. Admin som genererar åt andra hoppar över.
    const RATE_LIMIT_MS = 30_000
    const { data: existing } = await admin
      .from('profiles')
      .select('last_avatar_generated_at, avatar_generating, avatar_locked')
      .eq('id', user.id)
      .single()
    if (existing?.avatar_locked === true) {
      return NextResponse.json(
        { error: 'Din profilbild är låst. Kontakta admin om du vill skapa en ny.' },
        { status: 403 }
      )
    }
    if (existing?.avatar_generating === true) {
      return NextResponse.json(
        { error: 'En generering pågår redan. Vänta tills den är klar.' },
        { status: 429 }
      )
    }
    if (existing?.last_avatar_generated_at) {
      const elapsed = Date.now() - new Date(existing.last_avatar_generated_at).getTime()
      if (elapsed < RATE_LIMIT_MS) {
        const wait = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000)
        return NextResponse.json(
          { error: `Vänta ${wait} sekunder innan nästa generering.` },
          { status: 429 }
        )
      }
    }
  }

  const teamName = (formData.get('team') as string) || 'Sverige'
  const poseKey = (formData.get('pose') as string) || 'celebrating'
  const arenaKey = (formData.get('arena') as string) || 'Friends Arena'

  const teamKit = TEAM_KITS[teamName] || TEAM_KITS['Sverige']
  const poseDesc = POSE_DESCRIPTIONS[poseKey] || POSE_DESCRIPTIONS['celebrating']
  const arenaDesc = ARENA_DESCRIPTIONS[arenaKey] || ARENA_DESCRIPTIONS['Friends Arena']

  // Filstorlek max 5 MB
  if (imageFile.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Bilden är för stor (max 5 MB)' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY saknas i .env.local' }, { status: 500 })
  }

  // Markera att en generering pågår – UI:t kan visa spinner som
  // överlever sidbyte/scroll/refresh.
  await admin
    .from('profiles')
    .update({
      avatar_generating: true,
      last_avatar_generated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId)

  try {
    // Läs in bilden som base64
    const bytes = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(bytes).toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'

    // Gemini 2.5 Flash Image – behåller ansiktet, byter kläder/miljö
    const genAI = new GoogleGenAI({ apiKey })

    const prompt = `Transform this person into a professional football (soccer) player on the ${teamName} national/club team. Generate a FULL BODY shot showing the person from head to toe, wearing the ${teamName} kit: ${teamKit}, plus matching football boots. The player is ${poseDesc}. Setting: ${arenaDesc}. Keep the person's face and identity EXACTLY the same – do NOT change their facial features, skin tone, hair color, or hairstyle. Professional sports photography style, realistic, vibrant colors, dramatic stadium lighting, sharp focus on the player. The FULL BODY must be visible in the frame, from head to toe. High quality, photorealistic, magazine cover style.`

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Image } },
          ],
        },
      ],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    })

    // Plocka ut den genererade bilden från svaret
    const candidates = response.candidates
    if (!candidates || candidates.length === 0) {
      console.error('No candidates from Gemini:', JSON.stringify(response, null, 2))
      return NextResponse.json({ error: 'Gemini returnerade inget resultat' }, { status: 500 })
    }

    let generatedImageData: string | undefined
    let generatedMimeType = 'image/png'
    let textResponse = ''

    for (const part of candidates[0].content?.parts ?? []) {
      if (part.inlineData?.data) {
        generatedImageData = part.inlineData.data
        generatedMimeType = part.inlineData.mimeType || 'image/png'
      } else if (part.text) {
        textResponse += part.text
      }
    }

    if (!generatedImageData) {
      const finishReason = candidates[0].finishReason
      const safetyRatings = candidates[0].safetyRatings
      const promptFeedback = response.promptFeedback
      console.error('No image data. finishReason:', finishReason)
      console.error('safetyRatings:', JSON.stringify(safetyRatings, null, 2))
      console.error('promptFeedback:', JSON.stringify(promptFeedback, null, 2))
      console.error('text:', textResponse)
      console.error('Full candidate:', JSON.stringify(candidates[0], null, 2))

      let userMessage = 'Gemini kunde inte generera bilden'
      if (finishReason === 'IMAGE_SAFETY' || finishReason === 'SAFETY') {
        userMessage = 'Gemini blockerade bilden av säkerhetsskäl (kanske ansiktsigenkänning på riktig person). Prova en annan bild eller en bild med tydligt synligt ansikte i bra ljus.'
      } else if (finishReason === 'PROHIBITED_CONTENT') {
        userMessage = 'Gemini blockerade förfrågan (innehållspolicy). Prova en annan bild.'
      } else if (textResponse) {
        userMessage = `Gemini svarade med text: ${textResponse.slice(0, 200)}`
      } else if (finishReason) {
        userMessage = `Gemini avbröts: ${finishReason}`
      }

      return NextResponse.json({ error: userMessage }, { status: 500 })
    }

    // Konvertera base64 till buffer
    const imageBuffer = Buffer.from(generatedImageData, 'base64')

    // Spara som avatar i Supabase Storage
    const ext = generatedMimeType.includes('jpeg') ? 'jpg' : 'png'
    const avatarPath = `avatars/${targetUserId}.${ext}`
    const { error: uploadError } = await admin.storage
      .from('profile-images')
      .upload(avatarPath, imageBuffer, {
        contentType: generatedMimeType,
        upsert: true,
      })

    if (uploadError) {
      console.error('Avatar upload error:', uploadError)
      return NextResponse.json({ error: 'Kunde inte spara bilden' }, { status: 500 })
    }

    const { data: publicData } = admin.storage
      .from('profile-images')
      .getPublicUrl(avatarPath)

    const avatarUrl = publicData.publicUrl + `?t=${Date.now()}`

    // Uppdatera profilen + lås så bara en bild per användare kan skapas.
    // Admin kan låsa upp igen via admin-vyn. avatar_generating clearas i finally.
    await admin
      .from('profiles')
      .update({ avatar_url: avatarUrl, avatar_locked: true })
      .eq('id', targetUserId)

    return NextResponse.json({ avatarUrl })

  } catch (err) {
    console.error('Gemini error:', err)
    const message = err instanceof Error ? err.message : 'Okänt fel'
    return NextResponse.json({ error: `AI-generering misslyckades: ${message}` }, { status: 500 })
  } finally {
    // Säkerställer att vi alltid släpper låset, oavsett success/error/early return
    await admin
      .from('profiles')
      .update({ avatar_generating: false })
      .eq('id', targetUserId)
  }
}
