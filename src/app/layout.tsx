import type { Metadata, Viewport } from 'next'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { Navigation } from '@/components/Navigation'
import { MusicToggle } from '@/components/MusicToggle'
import { Profile, Pool } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'VM-Tips 2026',
  description: 'FIFA World Cup 2026 – Tipstävling',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'VM-Tips',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/vm2026-logo.avif',
    apple: '/vm2026-logo.avif',
  },
}

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      profile = data
    } else {
      // Skapa profil om triggern inte körde vid registrering
      const { data: created } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          display_name: user.email?.split('@')[0] ?? 'Användare',
          is_admin: false,
          tips_locked: false,
        })
        .select()
        .single()
      profile = created
    }
  }

  let pool: Pool | null = null
  let allLigor: Pool[] = []
  if (user) {
    // Hämta alla ligor användaren är medlem i
    const { data: memberships } = await supabase
      .from('pool_memberships')
      .select('pool:pools(*)')
      .eq('user_id', user.id)
    allLigor = ((memberships ?? [])
      .flatMap(m => {
        const p = (m as unknown as { pool: Pool | Pool[] | null }).pool
        if (!p) return []
        return Array.isArray(p) ? p : [p]
      }) as Pool[])
      .sort((a, b) => a.name.localeCompare(b.name))

    if (profile?.pool_id) {
      pool = allLigor.find(l => l.id === profile.pool_id) ?? null
      if (!pool) {
        // Profilen pekar på en liga användaren inte är medlem i längre
        const { data } = await supabase
          .from('pools')
          .select('*')
          .eq('id', profile.pool_id)
          .single()
        pool = data ?? null
      }
    }
  }

  return (
    <html lang="sv">
      <body>
        <Navigation profile={profile} pool={pool} allLigor={allLigor} />
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
          {children}
        </main>
        <MusicToggle />
      </body>
    </html>
  )
}
