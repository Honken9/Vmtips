'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { TrophyLogo } from './TrophyLogo'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'
import { LogOut, LayoutDashboard, Target, Trophy, ShieldCheck, Menu, X, Home, Globe, BarChart3, BookOpen, Wallet, GitBranch } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

interface Props {
  profile: Profile | null
}

export function Navigation({ profile }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    // Full reload så root-layout SSR:as om utan auth-cookie och
    // navigationen visar utloggat tillstånd direkt.
    window.location.href = '/auth/login'
  }

  const links = [
    { href: '/',          label: 'Hem',       icon: Home,            color: '#10b981' }, // emerald
    { href: '/tabell',    label: 'Tabell',    icon: Trophy,          color: '#f59e0b' }, // gold
    { href: '/statistik', label: 'Statistik', icon: BarChart3,       color: '#60a5fa' }, // blue
    { href: '/matches',   label: 'Matcher',   icon: LayoutDashboard, color: '#22d3ee' }, // cyan
    { href: '/landslag',  label: 'Landslag',  icon: Globe,           color: '#a78bfa' }, // violet
    ...(profile ? [{ href: '/tips', label: 'Mina tips', icon: Target, color: '#f472b6' }] : []), // pink
    ...(profile ? [{ href: '/slutspel', label: 'Slutspel', icon: GitBranch, color: '#fb7185' }] : []), // rose
    ...(profile ? [{ href: '/liga', label: 'Min liga', icon: Wallet, color: '#34d399' }] : []), // emerald-light
    { href: '/regler', label: 'Regler', icon: BookOpen, color: '#fbbf24' }, // amber-light
    ...(profile?.is_admin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck, color: '#ef4444' }] : []), // red
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
      <div className="max-w-[1400px] mx-auto px-3 sm:px-5">
        <div className="flex items-center justify-between gap-2 h-16">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <TrophyLogo size="sm" />
          </Link>

          {/* Desktop nav – ikoner med text på xl+, ikoner-bara på md/lg */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center min-w-0">
            {links.map(({ href, label, icon: Icon, color }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`flex items-center gap-1.5 px-2 xl:px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'text-white bg-white/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} style={{ color }} />
                  <span className="hidden xl:inline">{label}</span>
                </Link>
              )
            })}
          </div>

          {/* Höger: användarinfo */}
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {profile ? (
              <>
                <Link
                  href="/profil"
                  title={profile.display_name}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                >
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
                </Link>
                <button
                  onClick={handleSignOut}
                  title="Logga ut"
                  className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="text-sm font-medium px-3 py-2 rounded-lg gold-gradient text-black whitespace-nowrap"
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
            {links.map(({ href, label, icon: Icon, color }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'text-white bg-white/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} style={{ color }} />
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
