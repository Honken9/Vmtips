import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Hämtar ALLA rader från en tabell med paginering.
 *
 * PostgREST/Supabase returnerar max 1000 rader per fråga oavsett hur
 * många som finns – en vanlig .select('*') på predictions (>5000 rader)
 * trunkeras alltså tyst. Använd den här för varje tabell som kan växa
 * förbi 1000 rader.
 */
export async function fetchAllRows<T>(
  client: SupabaseClient,
  table: string,
  select = '*'
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`fetchAllRows(${table}): ${error.message}`)
    const rows = (data ?? []) as T[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}
