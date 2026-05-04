'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { TrophyLogo } from './TrophyLogo'
import { createClient } from '@/lib/supabase/client'
import { Profile, Pool } from '@/lib/types'
import { LigaSwitcher } from './LigaSwitcher'
import { LogOut, LayoutDashboard, Target, Trophy, ShieldCheck, Menu, X, Home, Globe, BarChart3, BookOpen, Wallet } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

interface Props {
  profile: Profile | null
  pool?: Pool | null
  allLigor?: Pool[]
}

export function Navigation({ profile, pool, allLigor = [] }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const links = [
    { href: '/', label: 'Hem', icon: Home },
    { href: '/tabell', label: 'Tabell', icon: Trophy },
    { href: '/statistik', label: 'Statistik', icon: BarChart3 },
    { href: '/matches', label: 'Matcher', icon: LayoutDashboard },
    { href: '/landslag', label: 'Landslag', icon: Globe },
    ...(profile ? [{ href: '/tips', label: 'Mina tips', icon: Target }] : []),
    ...(profile ? [{ href: '/liga', label: 'Min liga', icon: Wallet }] : []),
    { href: '/regler', label: 'Regler', icon: BookOpen },
    ...(profile?.is_admin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
  ]

  const initials = profile?.display_name?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: '#0a0e1a',
        borderColor: '#1f2937',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <TrophyLogo size="sm" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Höger: användarinfo */}
          <div className="hidden md:flex items-center gap-3">
            {profile ? (
              <>
                <LigaSwitcher
                  activePool={pool ?? null}
                  allLigor={allLigor}
                  userId={profile.id}
                />
                <Link
                  href="/profil"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  {/* Avatar */}
                  <div className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                    style={{ border: '1.5px solid #374151' }}>
                    {profile.avatar_url ? (
                      <Image src={profile.avatar_url} alt={profile.display_name} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', fontSize: '10px' }}>
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="text-sm">
                    <span className="text-white font-medium group-hover:text-emerald-400 transition-colors">
                      {profile.display_name}
                    </span>
                    {profile.tips_locked && (
                      <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                        Tips inlämnade
                      </span>
                    )}
                  </div>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <LogOut size={16} />
                  Logga ut
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="text-sm font-medium px-4 py-2 rounded-lg gold-gradient text-black"
              >
                Logga in
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-white/5 pt-4 space-y-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              )
            })}
            {profile ? (
              <>
                <Link
                  href="/profil"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname === '/profil' ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="relative w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                    {profile.avatar_url ? (
                      <Image src={profile.avatar_url} alt={profile.display_name} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', fontSize: '8px' }}>
                        {initials}
                      </div>
                    )}
                  </div>
                  Min profil
                </Link>
                <button
                  onClick={() => { handleSignOut(); setMobileOpen(false) }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-400 hover:text-white w-full"
                >
                  <LogOut size={18} />
                  Logga ut
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-emerald-400"
              >
                Logga in
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
