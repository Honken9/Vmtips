import { createClient } from '@supabase/supabase-js'

/**
 * Admin client med service_role-nyckel.
 * Kringgår RLS – använd BARA server-side (API routes, Server Actions).
 * Behövs bl.a. för Storage-uppladdningar.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY saknas i .env.local')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
