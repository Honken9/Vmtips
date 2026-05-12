-- ============================================================
-- Per-liga taggar för medlemmar: färg + avdelning
-- Kör i Supabase SQL Editor (idempotent)
-- ============================================================
--
-- Varje (liga, medlem)-par kan ha en färg och en valfri avdelnings-text.
-- Färg är förslagsvis en av Tailwinds palette-nycklar (emerald, sky, rose...).
-- Avdelning är fritext, t.ex. "Sales", "Försäljning", "Vänner från Lund".
--
-- Synlighet:
--   - Medlemmar i samma liga kan läsa varandras taggar
--   - Liga-skaparen kan skriva på vilken medlem som helst
--   - Medlem kan skriva på sin egen rad
--   - Admin kan allt
-- ============================================================

create table if not exists public.pool_member_tags (
  pool_id    int  references public.pools(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  color      text,
  department text,
  updated_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

create index if not exists idx_pool_member_tags_pool on public.pool_member_tags(pool_id);

alter table public.pool_member_tags enable row level security;

-- Läsning: medlemmar i samma liga
drop policy if exists "Same pool can read tags" on public.pool_member_tags;
create policy "Same pool can read tags"
  on public.pool_member_tags
  for select
  using (
    pool_id = public.current_user_pool_id()
    or exists (
      select 1 from public.pool_memberships pm
      where pm.user_id = auth.uid() and pm.pool_id = pool_member_tags.pool_id
    )
    or public.is_admin()
  );

-- Skrivning: egen rad
drop policy if exists "Own tag" on public.pool_member_tags;
create policy "Own tag"
  on public.pool_member_tags
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Skrivning: liga-skaparen
drop policy if exists "Pool creator manages tags" on public.pool_member_tags;
create policy "Pool creator manages tags"
  on public.pool_member_tags
  for all
  using (
    exists (
      select 1 from public.pools p
      where p.id = pool_member_tags.pool_id and p.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pools p
      where p.id = pool_member_tags.pool_id and p.created_by = auth.uid()
    )
  );

-- Admin
drop policy if exists "Admin manages tags" on public.pool_member_tags;
create policy "Admin manages tags"
  on public.pool_member_tags
  for all
  using (public.is_admin());

-- Audit-trigger så ändringar loggas
select public.attach_audit_trigger('pool_member_tags');
