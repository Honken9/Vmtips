-- ============================================================
-- Lås för officiella trupper (team_squad_overrides)
-- Kör i Supabase SQL Editor (idempotent).
-- ============================================================
--
-- När locked = true ignoreras football-data.org-svaret helt för
-- spelarlistan. Override:n är binding. Coach/förbundskapten hämtas
-- fortfarande från fallback-listan (curated). Crest/grundat-år
-- får komma från football-data om de finns – det rör inte truppen.
-- ============================================================

alter table public.team_squad_overrides
  add column if not exists locked boolean not null default false;
