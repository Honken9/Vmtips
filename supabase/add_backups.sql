-- ============================================================
-- Backup-bucket för adminens automatiska + manuella snapshots
-- Kör i Supabase SQL Editor
-- ============================================================

-- Privat bucket (ingen offentlig åtkomst – bara service_role kommer åt)
insert into storage.buckets (id, name, public)
  values ('backups', 'backups', false)
  on conflict (id) do nothing;
