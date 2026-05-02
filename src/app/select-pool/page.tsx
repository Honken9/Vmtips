import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SelectPoolClient } from './SelectPoolClient'

export const dynamic = 'force-dynamic'

export default async function SelectPoolPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('pool_id, display_name')
    .eq('id', user.id)
    .single()

  // Om användaren redan har en pool: skicka hem.
  if (profile?.pool_id) redirect('/')

  return <SelectPoolClient displayName={profile?.display_name ?? ''} />
}
