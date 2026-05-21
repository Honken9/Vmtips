-- ============================================================
-- Liga-chatt: enkel meddelande-tråd per liga
-- Kör i Supabase SQL Editor (idempotent).
-- ============================================================
--
-- En tråd per liga. Endast medlemmar kan läsa/skriva. Egen
-- användare kan radera egna meddelanden, pool-ägaren och admin
-- kan moderera (radera vad som helst i sin liga).
-- ============================================================

create table if not exists public.pool_messages (
  id         bigserial primary key,
  pool_id    int  not null references public.pools(id) on delete cascade,
  user_id    uuid not null references auth.users(id)   on delete cascade,
  text       text not null check (length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_pool_messages_pool_created
  on public.pool_messages(pool_id, created_at desc);

alter table public.pool_messages enable row level security;

-- ── Läsning: medlemmar i samma liga + admin ─────────────────
drop policy if exists "Members read pool messages" on public.pool_messages;
create policy "Members read pool messages" on public.pool_messages
  for select using (
    exists (
      select 1 from public.pool_memberships pm
      where pm.pool_id = pool_messages.pool_id and pm.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- ── Skrivning: egen rad i liga du är medlem i ───────────────
drop policy if exists "Member insert own message" on public.pool_messages;
create policy "Member insert own message" on public.pool_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pool_memberships pm
      where pm.pool_id = pool_messages.pool_id and pm.user_id = auth.uid()
    )
  );

-- ── Radera: eget meddelande, pool-ägare eller admin ─────────
drop policy if exists "Delete own or owner or admin" on public.pool_messages;
create policy "Delete own or owner or admin" on public.pool_messages
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.pools p where p.id = pool_messages.pool_id and p.created_by = auth.uid())
    or public.is_admin()
  );
