-- ============================================================
-- Spara "håller på att skapas"-status för AI-profilbilden så att UI:t
-- kan visa rätt state oavsett om användaren scrollar/byter sida/refresh.
-- Kör i Supabase SQL Editor.
-- ============================================================

alter table public.profiles
  add column if not exists avatar_generating boolean not null default false;

-- Återställ ev. hängande "true" om migrationen körs efter en deploy där
-- en generering avbröts halvvägs. Inga aktiva genereringar pågår vid
-- migrationstillfället.
update public.profiles set avatar_generating = false where avatar_generating = true;
