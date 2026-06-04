-- ============================================================
-- Avatar-historik: spara ALLA genererade bilder, inte bara senaste
-- Kör i Supabase SQL Editor (idempotent, säker med live-data).
-- ============================================================
--
-- Befintliga profiles.avatar_url-värden rörs INTE.
-- En backfill längst ner kopierar nuvarande bilder in i historiken
-- så de visas i admin-collaget.
-- ============================================================

create table if not exists public.avatar_history (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  url          text not null,
  team         text,
  pose         text,
  arena        text,
  custom_words text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_avatar_history_user
  on public.avatar_history(user_id, created_at desc);

alter table public.avatar_history enable row level security;

drop policy if exists "Admin read avatar history" on public.avatar_history;
create policy "Admin read avatar history" on public.avatar_history
  for select using (public.is_admin());

drop policy if exists "Admin write avatar history" on public.avatar_history;
create policy "Admin write avatar history" on public.avatar_history
  for all using (public.is_admin());

-- Backfill: kopiera in nuvarande avatar_url för varje profil så att
-- befintliga bilder syns i collaget. Bara om historik-raden saknas.
insert into public.avatar_history (user_id, url, created_at)
select p.id, p.avatar_url, coalesce(p.created_at, now())
from public.profiles p
where p.avatar_url is not null
  and not exists (
    select 1 from public.avatar_history h
    where h.user_id = p.id and h.url = p.avatar_url
  );
