-- ============================================================
-- FIX RLS: Löser infinite recursion-buggen
-- Kör hela den här filen i Supabase SQL Editor
-- ============================================================

-- Steg 1: Skapa is_admin()-funktion med SECURITY DEFINER
-- (den kör som postgres-ägaren och undviker rekursion)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- Steg 2: Ta bort alla gamla, trasiga policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END;
$$;

-- Steg 3: Sätt på RLS på alla tabeller
ALTER TABLE matches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings   ENABLE ROW LEVEL SECURITY;

-- Steg 4: Skapa nya, korrekta policies

-- MATCHES: alla kan läsa, bara admin kan skriva
CREATE POLICY "Public read matches"  ON matches FOR SELECT USING (true);
CREATE POLICY "Admin write matches"  ON matches FOR ALL    USING (is_admin());

-- TEAMS: alla kan läsa, bara admin kan skriva
CREATE POLICY "Public read teams"    ON teams   FOR SELECT USING (true);
CREATE POLICY "Admin write teams"    ON teams   FOR ALL    USING (is_admin());

-- PROFILES: alla kan läsa, användare uppdaterar sig själva, admin kan allt
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Self update profile"  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin manage profiles" ON profiles FOR ALL   USING (is_admin());

-- PREDICTIONS: användare hanterar sina egna, admin kan läsa alla
CREATE POLICY "Own predictions"       ON predictions FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "Admin read predictions" ON predictions FOR SELECT USING (is_admin());

-- SETTINGS: alla kan läsa, bara admin kan skriva
CREATE POLICY "Public read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Admin write settings" ON settings FOR ALL    USING (is_admin());
