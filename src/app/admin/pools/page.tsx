import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Pool, Profile } from '@/lib/types'
import { AdminPoolsClient } from './AdminPoolsClient'

export const dynamic = 'force-dynamic'

export default async function AdminPoolsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) redirect('/')

  const [{ data: poolsRaw }, { data: profilesRaw }] = await Promise.all([
    supabase.from('pools').select('*').order('id'),
    supabase.from('profiles').select('id, display_name, is_admin, pool_id'),
  ])

  return (
    <AdminPoolsClient
      meUserId={user.id}
      initialPools={(poolsRaw ?? []) as Pool[]}
      initialProfiles={
        (profilesRaw ?? []) as Pick<Profile, 'id' | 'display_name' | 'is_admin' | 'pool_id'>[]
      }
    />
  )
}
