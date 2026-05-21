-- ============================================================
-- En AI-bild per användare – med admin-override
-- Kör i Supabase SQL Editor (idempotent).
-- ============================================================
--
-- Efter första lyckade genereringen sätts avatar_locked = true.
-- API:n /api/generate-football-image vägrar då nya genereringar
-- tills en admin sätter tillbaka flaggan till false via admin-vyn.
-- Existerande användare med en avatar låses i samma drag så ingen
-- kan smita igenom med en kvarvarande generering.
-- ============================================================

alter table public.profiles
  add column if not exists avatar_locked boolean not null default false;

-- Lås alla som redan har genererat en bild
update public.profiles
   set avatar_locked = true
 where avatar_url is not null and avatar_locked = false;
