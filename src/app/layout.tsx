import type { Metadata, Viewport } from 'next'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { Navigation } from '@/components/Navigation'
import { MusicToggle } from '@/components/MusicToggle'
import { Profile } from '@/lib/types'

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

  return (
    <html lang="sv">
      <body>
        <Navigation profile={profile} />
        <main className="max-w-[1400px] mx-auto px-3 sm:px-6 py-5 sm:py-8">
          {children}
        </main>
        <MusicToggle />
      </body>
    </html>
  )
}
