-- ============================================================
-- Match-kommentarer som integreras med liga-chatten
-- Kör i Supabase SQL Editor (idempotent).
-- ============================================================
--
-- Lägger en nullable match_id-kolumn på pool_messages. När den är satt
-- är meddelandet en kommentar om en specifik match. Annars är det en
-- vanlig liga-chatt-rad. Liga-chatten visar bägge med en match-tag på
-- de som hör till en match.
-- ============================================================

alter table public.pool_messages
  add column if not exists match_id int references public.matches(id) on delete cascade;

create index if not exists idx_pool_messages_match
  on public.pool_messages(match_id) where match_id is not null;
