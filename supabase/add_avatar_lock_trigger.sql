-- ============================================================
-- Avatar-lås: server-side enforcement
-- Kör i Supabase SQL Editor (idempotent). Komplement till add_avatar_locked.sql.
-- ============================================================
--
-- RLS på profiles tillåter "Egen profil-uppdatering" för auth.uid() = id,
-- vilket betyder att en användare själv kan flippa avatar_locked → false
-- via supabase-js från devtools och kringgå API-låset. Den här triggern
-- blockerar det: bara admin (eller systemets service-role som hoppar
-- över triggern) får ändra avatar_locked.
-- ============================================================

create or replace function public.prevent_self_avatar_unlock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Om kolumnen ändras OCH den som kör inte är admin → blockera
  if old.avatar_locked is distinct from new.avatar_locked then
    if auth.uid() is not null
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    then
      raise exception 'Endast admin får ändra avatar_locked' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_avatar_unlock on public.profiles;
create trigger profiles_block_avatar_unlock
  before update on public.profiles
  for each row execute function public.prevent_self_avatar_unlock();
