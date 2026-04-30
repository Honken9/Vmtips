'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TrophyLogo } from '@/components/TrophyLogo'
import { Loader2, CheckCircle } from 'lucide-react'

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message === 'User already registered'
        ? 'Den e-postadressen är redan registrerad'
        : `Fel: ${error.message}`)
      return
    }

    // Om session finns direkt → inloggad utan e-postbekräftelse
    if (data.session) {
      router.push('/tips')
      router.refresh()
      return
    }

    // Annars → e-postbekräftelse krävs
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <CheckCircle size={48} className="text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Kolla din e-post!</h2>
            <p className="text-gray-400 mb-4">
              Vi har skickat en bekräftelselänk till <span className="text-white">{email}</span>.
              Klicka på länken för att aktivera ditt konto.
            </p>
            <p className="text-sm text-gray-500">
              Vill du slippa detta?{' '}
              <a
                href="https://supabase.com/dashboard/project/jofhsqykluusfupmrkih/auth/providers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline"
              >
                Stäng av e-postbekräftelse i Supabase
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <TrophyLogo size="md" />
          </div>
          <p className="text-gray-400 text-sm">Skapa konto och börja tippa</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <h1 className="text-xl font-bold text-white mb-6">Skapa konto</h1>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Visningsnamn</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                placeholder="Ditt namn i tabellen"
                maxLength={30}
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">E-post</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="du@exempel.se"
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
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
                placeholder="Minst 6 tecken"
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
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
              Skapa konto
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Har du redan ett konto?{' '}
            <Link href="/auth/login" className="text-amber-400 hover:text-amber-300 font-medium">
              Logga in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
