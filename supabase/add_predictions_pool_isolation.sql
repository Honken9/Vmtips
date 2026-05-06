-- ============================================================
-- Säkerhetsförbättring: predictions cross-liga isolering
-- Kör i Supabase SQL Editor
-- ============================================================
--
-- Problem som löses:
--   Tidigare RLS-policy för predictions tillät bara ägaren och admin
--   att läsa raderna. Det gjorde att appens "popular picks"-funktion
--   slutade visa något för vanliga användare (de såg bara sina egna).
--
--   Vi vill att medlemmar i samma liga ska kunna se varandras tipps
--   för aggregerade vyer (vilka tippade hemma-vinst etc), MEN inte
--   data från andra ligor.
--
-- Ny modell:
--   - Egna tipps: full access (alla operationer)
--   - Andras tipps: SELECT om både du och ägaren har samma pool_id
--   - Admin: full SELECT-access
-- ============================================================

-- Skapa eller uppdatera helper-funktionen som returnerar nuvarande
-- användares pool_id. SECURITY DEFINER så vi slipper rekursion.
create or replace function public.current_user_pool_id()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select pool_id from public.profiles where id = auth.uid();
$$;

-- Rensa gamla predictions-policies
drop policy if exists "Own predictions" on public.predictions;
drop policy if exists "Admin read predictions" on public.predictions;
drop policy if exists "Alla kan se tips" on public.predictions;
drop policy if exists "Användare kan hantera egna tips" on public.predictions;
drop policy if exists "Same pool can read predictions" on public.predictions;

-- Egna tipps: alla operationer
create policy "Own predictions"
  on public.predictions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Liga-medlemmars tipps: bara läsning, bara om samma pool
create policy "Same pool can read predictions"
  on public.predictions
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = predictions.user_id
        and p.pool_id is not null
        and p.pool_id = public.current_user_pool_id()
    )
  );

-- Admin: full läs-åtkomst
create policy "Admin read predictions"
  on public.predictions
  for select
  using (public.is_admin());

-- ============================================================
-- Samma princip för bonus_predictions så vi inte exponerar
-- skytteliga-tipset över liga-gränser.
-- ============================================================
drop policy if exists "Same pool can read bonus preds" on public.bonus_predictions;

create policy "Same pool can read bonus preds"
  on public.bonus_predictions
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = bonus_predictions.user_id
        and p.pool_id is not null
        and p.pool_id = public.current_user_pool_id()
    )
  );
