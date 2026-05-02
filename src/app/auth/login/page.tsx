'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TrophyLogo } from '@/components/TrophyLogo'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Fel e-post eller lösenord')
      setLoading(false)
      return
    }

    router.push('/tips')
    router.refresh()
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <TrophyLogo size="md" />
          </div>
          <p className="text-gray-400 text-sm">Logga in för att tippa VM</p>
        </div>

        {/* Kort */}
        <div className="rounded-2xl p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <h1 className="text-xl font-bold text-white mb-6">Logga in</h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">E-post</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="du@exempel.se"
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Lösenord</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-black transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 gold-gradient"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Logga in
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Inget konto?{' '}
            <Link href="/auth/register" className="text-emerald-400 hover:text-emerald-300 font-medium">
              Registrera dig
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
