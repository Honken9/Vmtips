-- ============================================================
-- Likes på kommentarer i pool_messages
-- Kör i Supabase SQL Editor (idempotent, säker med live-data).
-- ============================================================

create table if not exists public.pool_message_likes (
  message_id bigint not null references public.pool_messages(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists idx_pool_message_likes_message
  on public.pool_message_likes(message_id);

alter table public.pool_message_likes enable row level security;

-- Läsning: alla som kan se message:n (= pool-medlemmar) får se likes
drop policy if exists "Read message likes" on public.pool_message_likes;
create policy "Read message likes" on public.pool_message_likes
  for select using (
    exists (
      select 1 from public.pool_messages pm
      join public.pool_memberships mb on mb.pool_id = pm.pool_id
      where pm.id = pool_message_likes.message_id
        and mb.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- Insert/delete: bara på egen rad, och bara om man får se message:n
drop policy if exists "Toggle own like" on public.pool_message_likes;
create policy "Toggle own like" on public.pool_message_likes
  for all using (
    auth.uid() = user_id
    and exists (
      select 1 from public.pool_messages pm
      join public.pool_memberships mb on mb.pool_id = pm.pool_id
      where pm.id = pool_message_likes.message_id
        and mb.user_id = auth.uid()
    )
  ) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pool_messages pm
      join public.pool_memberships mb on mb.pool_id = pm.pool_id
      where pm.id = pool_message_likes.message_id
        and mb.user_id = auth.uid()
    )
  );
