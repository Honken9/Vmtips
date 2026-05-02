-- ============================================================
-- Säkerhetsfixar
-- Kör i Supabase SQL Editor
-- ============================================================

-- 1) Blockera privilege escalation:
--    Stoppa att en vanlig inloggad användare sätter is_admin = true på sin egen rad.
--    Trigger kör som postgres (security definer) och slår bara till för
--    autentiserade users som inte redan är admin. service_role (bakom våra
--    admin-routes) har auth.uid() = null och passerar.
create or replace function public.prevent_self_admin_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_admin is distinct from new.is_admin then
    if auth.uid() is not null
       and not exists (
         select 1 from public.profiles
         where id = auth.uid() and is_admin = true
       )
    then
      raise exception 'Endast admin får ändra is_admin' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_admin_self_grant on public.profiles;
create trigger profiles_block_admin_self_grant
  before update on public.profiles
  for each row
  execute function public.prevent_self_admin_grant();

-- 2) Rate-limit för AI-bildgenereringen
--    Sparar tidsstämpeln för senaste generationen per användare så routen
--    kan blockera spam.
alter table public.profiles
  add column if not exists last_avatar_generated_at timestamptz;
