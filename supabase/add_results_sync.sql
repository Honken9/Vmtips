-- ============================================================
-- Resultatsynk från football-data.org
-- Kör i Supabase SQL Editor
-- ============================================================

alter table public.matches
  add column if not exists manually_edited boolean not null default false,
  add column if not exists external_id int;

create index if not exists idx_matches_external_id
  on public.matches(external_id);

-- Backfill: matcher som redan har bekräftat resultat (admin har lagt in dem
-- innan synkfunktionen fanns) markeras som manuellt redigerade så att
-- autosynken inte skriver över dem.
update public.matches
   set manually_edited = true
 where result_confirmed = true
   and manually_edited = false;
