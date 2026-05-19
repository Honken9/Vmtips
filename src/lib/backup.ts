import { createAdminClient } from './supabase/admin'

const BUCKET = 'backups'
const PREFIX = 'snapshots/'
const RATE_LIMIT_MS = 10 * 60 * 1000 // 10 min mellan automatiska backups
const RETENTION = 150

export interface BackupData {
  version: 1 | 2
  created_at: string
  reason: string
  profiles: unknown[]
  predictions: unknown[]
  bonus_predictions: unknown[]
  bonus_results: unknown[]
  matches: unknown[]
  teams: unknown[]
  settings: unknown[]
  // v2 – liga-strukturer (saknas i äldre snapshots → behandlas som [])
  pools?: unknown[]
  pool_memberships?: unknown[]
  pool_payments?: unknown[]
  pool_member_tags?: unknown[]
  team_squad_overrides?: unknown[]
}

export interface SnapshotInfo {
  key: string
  created_at: string
  size: number
}

export async function gatherBackupData(reason: string): Promise<BackupData> {
  const admin = createAdminClient()
  const [
    profiles, predictions, bonusPreds, bonusResults, matches, teams, settings,
    pools, memberships, payments, memberTags, squadOverrides,
  ] = await Promise.all([
    admin.from('profiles').select('*'),
    admin.from('predictions').select('*'),
    admin.from('bonus_predictions').select('*'),
    admin.from('bonus_results').select('*'),
    admin.from('matches').select('*'),
    admin.from('teams').select('*'),
    admin.from('settings').select('*'),
    admin.from('pools').select('*'),
    admin.from('pool_memberships').select('*'),
    admin.from('pool_payments').select('*'),
    admin.from('pool_member_tags').select('*'),
    admin.from('team_squad_overrides').select('*'),
  ])
  return {
    version: 2,
    created_at: new Date().toISOString(),
    reason,
    profiles: profiles.data ?? [],
    predictions: predictions.data ?? [],
    bonus_predictions: bonusPreds.data ?? [],
    bonus_results: bonusResults.data ?? [],
    matches: matches.data ?? [],
    teams: teams.data ?? [],
    settings: settings.data ?? [],
    pools: pools.data ?? [],
    pool_memberships: memberships.data ?? [],
    pool_payments: payments.data ?? [],
    pool_member_tags: memberTags.data ?? [],
    team_squad_overrides: squadOverrides.data ?? [],
  }
}

export async function createSnapshot(
  reason: string,
  force = false
): Promise<{ key?: string; skipped: boolean; message: string }> {
  const admin = createAdminClient()

  if (!force) {
    const { data: recent } = await admin.storage.from(BUCKET).list(PREFIX, {
      limit: 1,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (recent && recent.length > 0 && recent[0].created_at) {
      const last = new Date(recent[0].created_at).getTime()
      if (Date.now() - last < RATE_LIMIT_MS) {
        return { skipped: true, message: 'Backup hoppades över (senaste < 10 min)' }
      }
    }
  }

  const data = await gatherBackupData(reason)
  const ts = data.created_at.replace(/[:.]/g, '-')
  const key = `${PREFIX}backup-${ts}.json`
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(key, JSON.stringify(data, null, 2), { contentType: 'application/json' })
  if (error) {
    return { skipped: true, message: `Kunde inte spara: ${error.message}` }
  }

  void pruneOldSnapshots()

  return { key, skipped: false, message: 'Backup skapad' }
}

async function pruneOldSnapshots() {
  const admin = createAdminClient()
  const { data: list } = await admin.storage.from(BUCKET).list(PREFIX, {
    limit: 1000,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (!list || list.length <= RETENTION) return
  const toDelete = list.slice(RETENTION).map(f => `${PREFIX}${f.name}`)
  if (toDelete.length > 0) {
    await admin.storage.from(BUCKET).remove(toDelete)
  }
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const admin = createAdminClient()
  const { data: list } = await admin.storage.from(BUCKET).list(PREFIX, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (!list) return []
  return list.map(f => ({
    key: `${PREFIX}${f.name}`,
    created_at: f.created_at ?? '',
    size: (f.metadata?.size as number | undefined) ?? 0,
  }))
}

export async function downloadSnapshot(key: string): Promise<BackupData | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).download(key)
  if (error || !data) return null
  const text = await data.text()
  try {
    return JSON.parse(text) as BackupData
  } catch {
    return null
  }
}

export async function restoreFromSnapshot(
  key: string
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  // Pre-restore backup först (force ignorerar rate limit)
  await createSnapshot('pre-restore', true)

  const data = await downloadSnapshot(key)
  if (!data) return { success: false, message: 'Snapshot kunde inte läsas' }

  try {
    if (data.settings.length > 0) {
      const { error } = await admin.from('settings').upsert(data.settings, { onConflict: 'id' })
      if (error) throw error
    }
    if (data.teams.length > 0) {
      const { error } = await admin.from('teams').upsert(data.teams, { onConflict: 'id' })
      if (error) throw error
    }
    if (data.profiles.length > 0) {
      const { error } = await admin.from('profiles').upsert(data.profiles, { onConflict: 'id' })
      if (error) throw error
    }
    if (data.matches.length > 0) {
      const { error } = await admin.from('matches').upsert(data.matches, { onConflict: 'id' })
      if (error) throw error
    }

    // Liga-strukturer (v2). Ordning viktig pga FK:
    // pools före memberships/payments/tags (de FK:ar pool_id).
    if (data.pools && data.pools.length > 0) {
      const { error } = await admin.from('pools').upsert(data.pools, { onConflict: 'id' })
      if (error) throw error
    }
    if (data.pool_memberships && data.pool_memberships.length > 0) {
      const { error } = await admin
        .from('pool_memberships')
        .upsert(data.pool_memberships, { onConflict: 'pool_id,user_id' })
      if (error) throw error
    }
    if (data.pool_payments && data.pool_payments.length > 0) {
      const { error } = await admin
        .from('pool_payments')
        .upsert(data.pool_payments, { onConflict: 'pool_id,user_id' })
      if (error) throw error
    }
    if (data.pool_member_tags && data.pool_member_tags.length > 0) {
      const { error } = await admin
        .from('pool_member_tags')
        .upsert(data.pool_member_tags, { onConflict: 'pool_id,user_id' })
      if (error) throw error
    }
    if (data.team_squad_overrides && data.team_squad_overrides.length > 0) {
      const { error } = await admin
        .from('team_squad_overrides')
        .upsert(data.team_squad_overrides, { onConflict: 'team_code' })
      if (error) throw error
    }

    // Predictions: nuke och insert (id är serial – upsert kan kollidera)
    {
      const { error: delErr } = await admin.from('predictions').delete().neq('id', -1)
      if (delErr) throw delErr
      if (data.predictions.length > 0) {
        const { error: insErr } = await admin.from('predictions').insert(data.predictions)
        if (insErr) throw insErr
      }
    }

    if (data.bonus_predictions.length > 0) {
      const { error } = await admin
        .from('bonus_predictions')
        .upsert(data.bonus_predictions, { onConflict: 'user_id' })
      if (error) throw error
    }
    if (data.bonus_results.length > 0) {
      const { error } = await admin
        .from('bonus_results')
        .upsert(data.bonus_results, { onConflict: 'id' })
      if (error) throw error
    }

    return { success: true, message: 'Återställning klar' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Restore-fel: ${msg}` }
  }
}

export async function createSignedDownloadUrl(key: string, expiresIn = 600): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(key, expiresIn)
  return data?.signedUrl ?? null
}
