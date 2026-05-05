-- ============================================================
-- Spelform per liga + Läge C (hybrid).
-- Kör i Supabase SQL Editor.
-- ============================================================

-- 1) Lägg till tournament_mode och mode_a_global_lock per liga (pool)
alter table public.pools
  add column if not exists tournament_mode text not null default 'B'
    check (tournament_mode in ('A', 'B', 'C')),
  add column if not exists mode_a_global_lock boolean not null default false;

-- 2) Migrera nuvarande globala mode in i alla befintliga ligor
update public.pools
set tournament_mode = coalesce((select tournament_mode from public.settings where id = 1), 'B'),
    mode_a_global_lock = coalesce((select mode_a_global_lock from public.settings where id = 1), false)
where true;

-- 3) Tillåt 'C' även i den globala settings-tabellen (bakåtkompatibel default)
alter table public.settings
  drop constraint if exists settings_tournament_mode_check;
alter table public.settings
  add constraint settings_tournament_mode_check
  check (tournament_mode in ('A', 'B', 'C'));

-- 4) Uppdatera lock_user_tips så den kan låsa bara gruppspel (för Läge C)
create or replace function public.lock_user_tips(p_user_id uuid, p_only_group boolean default false)
returns void
language plpgsql
security definer
as $$
begin
  if p_only_group then
    update public.predictions
    set locked = true, locked_at = now()
    from public.matches m
    where public.predictions.match_id = m.id
      and public.predictions.user_id = p_user_id
      and public.predictions.locked = false
      and m.stage = 'group';
  else
    update public.predictions
    set locked = true, locked_at = now()
    where user_id = p_user_id and locked = false;
  end if;

  -- I läge C ska tips_locked-flaggan bara sättas när allt är låst (alla rundor)
  -- så vi sätter den bara om vi inte filtrerade på enbart gruppspel.
  if not p_only_group then
    update public.profiles
    set tips_locked = true, tips_locked_at = now()
    where id = p_user_id;
  end if;
end;
$$;
