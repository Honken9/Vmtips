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
    .select('display_name')
    .eq('id', user.id)
    .single()

  // /select-pool är nu öppen även för användare som redan har en liga
  // (man kan vara med i flera). Användare utan medlemskap landar
  // automatiskt här via redirect från andra sidor.
  return <SelectPoolClient displayName={profile?.display_name ?? ''} />
}
