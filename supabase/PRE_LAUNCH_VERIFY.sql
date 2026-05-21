-- ============================================================
-- PRE-LAUNCH-VERIFIERING – kör en gång i Supabase SQL Editor
-- Ska returnera EN rad där alla _exists-kolumner är true
-- ============================================================

select
  -- Funktioner (alla ska vara true)
  exists (select 1 from pg_proc where proname = 'join_pool_by_code')              as f_join_pool,
  exists (select 1 from pg_proc where proname = 'lock_user_tips')                  as f_lock_tips,
  exists (select 1 from pg_proc where proname = 'lock_predictions_at_kickoff')     as f_lock_kickoff,
  exists (select 1 from pg_proc where proname = 'is_admin')                        as f_is_admin,
  exists (select 1 from pg_proc where proname = 'remove_pool_member')              as f_remove_member,
  exists (select 1 from pg_proc where proname = 'daily_winner_for_pool')           as f_daily_winner,
  -- Triggers (alla ska vara true)
  exists (select 1 from pg_trigger where tgname = 'profiles_block_admin_self_grant') as t_admin_grant,
  exists (select 1 from pg_trigger where tgname = 'profiles_block_avatar_unlock')    as t_avatar,
  exists (select 1 from pg_trigger where tgname = 'profiles_block_pool_id_jump')     as t_pool_id,
  exists (select 1 from pg_trigger where tgname = 'pools_add_owner_member')          as t_owner_member,
  -- Kolumner (alla ska vara true)
  exists (select 1 from information_schema.columns where table_name='profiles' and column_name='avatar_locked')       as c_avatar_locked,
  exists (select 1 from information_schema.columns where table_name='pools' and column_name='deleted_at')             as c_pool_deleted,
  exists (select 1 from information_schema.columns where table_name='pools' and column_name='points_total_goals')      as c_pool_ptg,
  exists (select 1 from information_schema.columns where table_name='team_squad_overrides' and column_name='locked')   as c_squad_lock,
  -- Authenticated ska INTE kunna INSERTa i pool_memberships
  has_table_privilege('authenticated', 'public.pool_memberships', 'INSERT')         as auth_can_insert_membership,
  -- Antal rader i kritiska tabeller (sanity-check)
  (select count(*) from public.teams)    as n_teams,
  (select count(*) from public.matches)  as n_matches,
  (select count(*) from public.settings) as n_settings,
  (select count(*) from public.profiles) as n_profiles;

-- Förväntat resultat:
--   alla f_* och t_* och c_* = true
--   auth_can_insert_membership = false  ← VIKTIGT
--   n_teams = 48 (alla VM-länder)
--   n_matches >= 64 (alla VM-matcher)
--   n_settings = 1
--   n_profiles = antal registrerade
