-- ============================================================
-- Slumpinställningar är nu globala (admin sätter dem) istället för
-- per-användare i localStorage. Lägg till kolumner i settings.
-- Kör i Supabase SQL Editor.
-- ============================================================

alter table public.settings
  add column if not exists randomize_duration int not null default 15,
  add column if not exists randomize_phrase_1 text default '',
  add column if not exists randomize_phrase_2 text default '',
  add column if not exists randomize_phrase_3 text default '';
