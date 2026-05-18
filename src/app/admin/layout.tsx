import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, BarChart2, Settings, ListChecks, Star, Activity, Users } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  const adminLinks = [
    { href: '/admin', label: 'Översikt', icon: BarChart2 },
    { href: '/admin/results', label: 'Resultat', icon: ListChecks },
    { href: '/admin/bonus', label: 'Bonusfacit', icon: Star },
    { href: '/admin/squads', label: 'Trupper', icon: Users },
    { href: '/admin/audit', label: 'Audit', icon: Activity },
    { href: '/admin/settings', label: 'Inställningar', icon: Settings },
  ]

  return (
    <div>
      {/* Admin-header */}
      <div className="rounded-xl px-5 py-4 mb-6 flex items-center gap-3"
        style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <ShieldCheck size={20} className="text-indigo-400" />
        <span className="font-semibold text-indigo-300">Admin-panel</span>

        <div className="ml-auto flex gap-2">
          {adminLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {children}
    </div>
  )
}
