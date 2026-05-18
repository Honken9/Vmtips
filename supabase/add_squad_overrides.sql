-- ============================================================
-- Officiella trupp-overrides: admin kan spika exakt trupp per land
-- Kör i Supabase SQL Editor (idempotent)
-- ============================================================
--
-- När en rad finns här används den FÖRE football-data.org och vår
-- hårdkodade fallback. players = jsonb-array:
--   [{ "name": "...", "position": "Goalkeeper|Defender|Midfielder|Forward",
--      "club": "...", "marketValueM": 12 }, ...]
-- ============================================================

create table if not exists public.team_squad_overrides (
  team_code  text primary key,
  players    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.team_squad_overrides enable row level security;

drop policy if exists "Public read squad overrides" on public.team_squad_overrides;
create policy "Public read squad overrides"
  on public.team_squad_overrides for select using (true);

drop policy if exists "Admin write squad overrides" on public.team_squad_overrides;
create policy "Admin write squad overrides"
  on public.team_squad_overrides for all using (public.is_admin());

select public.attach_audit_trigger('team_squad_overrides');
