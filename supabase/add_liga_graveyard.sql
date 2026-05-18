-- ============================================================
-- Liga-kyrkogård (soft delete) + ägaröverlämning
-- Kör i Supabase SQL Editor (idempotent)
-- ============================================================

-- Soft-delete-kolumner på pools
alter table public.pools
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists idx_pools_deleted
  on public.pools(deleted_at)
  where deleted_at is not null;

-- RLS: skaparen + admin ska kunna se sina raderade ligor (kyrkogården).
-- Befintlig "Alla kan se pools"-policy täcker redan select, men för
-- säkerhets skull säkerställer vi att raderade ligor inte läcker till
-- icke-medlemmar via en uppdaterad läs-policy.
drop policy if exists "Alla kan se pools" on public.pools;
create policy "Alla kan se pools" on public.pools
  for select using (
    deleted_at is null
    or created_by = auth.uid()
    or public.is_admin()
  );

-- ============================================================
-- Permanent rensning: raderar ligor som legat i kyrkogården > 14 dagar.
-- Kör manuellt vid behov, eller schemalägg via pg_cron.
-- ============================================================
create or replace function public.purge_old_deleted_pools()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with del as (
    delete from public.pools
    where deleted_at is not null
      and deleted_at < now() - interval '14 days'
    returning id
  )
  select count(*) into n from del;
  return n;
end;
$$;

-- Valfritt: schemalägg daglig rensning (kräver pg_cron-extension).
-- select cron.schedule('purge-deleted-pools', '0 3 * * *',
--   $$ select public.purge_old_deleted_pools(); $$);
