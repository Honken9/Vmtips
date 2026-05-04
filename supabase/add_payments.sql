-- ============================================================
-- Manuell Swish-betalning per liga
-- Kör i Supabase SQL Editor
-- ============================================================

-- 1) Konfiguration på liga-nivå
alter table public.pools
  add column if not exists entry_fee int not null default 0,
  add column if not exists swish_recipient_name text,
  add column if not exists swish_phone text,
  add column if not exists prize_distribution jsonb not null default '{"1": 1.0}'::jsonb;

-- 2) Per-användare-betalningar i en liga
create table if not exists public.pool_payments (
  pool_id int not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  paid boolean not null default false,
  paid_at timestamptz,
  marked_by_user_id uuid references auth.users(id),
  amount int,
  primary key (pool_id, user_id)
);

alter table public.pool_payments enable row level security;

-- Alla i samma liga ser betalningar (transparens)
drop policy if exists "Liga-medlemmar ser betalningar" on public.pool_payments;
create policy "Liga-medlemmar ser betalningar" on public.pool_payments
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and pool_id = pool_payments.pool_id
    )
  );

-- Bara liga-skaparen eller admin kan markera/avmarkera
drop policy if exists "Liga-skapare hanterar betalningar" on public.pool_payments;
create policy "Liga-skapare hanterar betalningar" on public.pool_payments
  for all using (
    exists (
      select 1 from public.pools p
      where p.id = pool_payments.pool_id
        and (
          p.created_by = auth.uid()
          or exists (
            select 1 from public.profiles
            where id = auth.uid() and is_admin = true
          )
        )
    )
  );

create index if not exists idx_pool_payments_pool on public.pool_payments(pool_id);
create index if not exists idx_pool_payments_user on public.pool_payments(user_id);
