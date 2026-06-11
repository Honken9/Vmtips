-- ============================================================
-- Liga-skapare måste kunna läsa alla medlemskap i sina egna ligor,
-- annars ser de tomt under "Medlemmar & betalningar" på /liga och
-- kan inte heller markera betalningar.
--
-- Befintliga policys täcker bara den egna medlemskapsraden + master
-- admin. Liga-skaparen (pool.created_by) är varken master admin
-- eller medlem av varje annans rad – så RLS filtrerar ut allt.
--
-- Idempotent. Påverkar bara läsning, inte skrivning.
-- ============================================================

drop policy if exists "Liga-skapare läser memberships" on public.pool_memberships;
create policy "Liga-skapare läser memberships" on public.pool_memberships
  for select using (
    exists (
      select 1 from public.pools p
      where p.id = pool_memberships.pool_id
        and p.created_by = auth.uid()
    )
  );

-- Samma sak för pool_payments: SELECT-policy:n krävde profiles.pool_id =
-- pool_id, så liga-skapare som har bytt aktiv liga kunde inte se sin
-- egen ligas betalningar. Bygger den på created_by istället så att
-- skaparen alltid ser sina ligor.
drop policy if exists "Liga-skapare läser betalningar" on public.pool_payments;
create policy "Liga-skapare läser betalningar" on public.pool_payments
  for select using (
    exists (
      select 1 from public.pools p
      where p.id = pool_payments.pool_id
        and p.created_by = auth.uid()
    )
  );
