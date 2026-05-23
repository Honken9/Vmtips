-- ============================================================
-- Liga-bild: logga eller foto på gänget per pool
-- Kör i Supabase SQL Editor (idempotent, säker med live-data).
-- ============================================================
--
-- Nullable kolumn på pools. Bilden laddas upp via API som lagrar
-- den i public-bucket "profile-images" under prefixet pools/.
-- ============================================================

alter table public.pools
  add column if not exists image_url text;
