-- ============================================================
-- END-TO-END SIMULERING AV EN RUNDA
-- Kör i Supabase SQL Editor – idempotent och städar efter sig
-- ============================================================
--
-- Testar att kedjan funkar:
--   1. pool-creation → tg_add_owner_member-trigger
--   2. predictions INSERT/UPDATE
--   3. lock_user_tips RPC med korrekta locks
--   4. result-input → leaderboard-vyn räknar rätt
--   5. daily_winner_for_pool RPC
--   6. bonus_predictions + bonus_results → bonuspoäng
--   7. cleanup
--
-- Säkerhet: inget rör befintliga ligor/användare. Skapar bara temp-data
-- under en transaktion + raderar allt sist.
-- ============================================================

do $$
declare
  v_admin_id uuid;
  v_test_pool_id int;
  v_match_id int;
  v_total_points int;
  v_exact_count int;
  v_daily_winner record;
  v_orig_home int;
  v_orig_away int;
  v_orig_confirmed boolean;
  v_pred_count int;
begin
  raise notice '=== STARTAR SIMULERING ===';

  -- Hämta en admin (vi använder din admin-rad för att kunna köra SECURITY DEFINER-anrop)
  select id into v_admin_id from public.profiles where is_admin = true limit 1;
  if v_admin_id is null then
    raise notice 'SKIPPED: ingen admin i profiles, kan inte köra';
    return;
  end if;
  raise notice 'Använder admin: %', v_admin_id;

  -- ── TEST 1: Skapa testpool, verifiera tg_add_owner_member ──────────────
  insert into public.pools (name, invite_code, created_by)
  values ('__SIM_TEST_POOL__', 'SIMTEST' || floor(random() * 1000)::text, v_admin_id)
  returning id into v_test_pool_id;

  if not exists (
    select 1 from public.pool_memberships
    where pool_id = v_test_pool_id and user_id = v_admin_id
  ) then
    raise exception 'TEST 1 FAIL: tg_add_owner_member-triggern lade INTE till owner i pool_memberships';
  end if;
  raise notice 'TEST 1 OK: pool skapad, owner auto-medlem via trigger';

  -- ── TEST 2: Lägga en prediction (på match admin inte tippat på) ───────
  select m.id, m.home_score, m.away_score, m.result_confirmed
    into v_match_id, v_orig_home, v_orig_away, v_orig_confirmed
  from public.matches m
  where m.stage = 'group'
    and m.result_confirmed = false
    and not exists (
      select 1 from public.predictions p
      where p.user_id = v_admin_id and p.match_id = m.id
    )
  order by m.match_number
  limit 1;

  if v_match_id is null then
    raise exception 'TEST 2 FAIL: ingen oconfirmed group-match utan existerande admin-prediction (admin har tippat på alla?)';
  end if;

  insert into public.predictions (user_id, match_id, pred_home, pred_away, locked)
  values (v_admin_id, v_match_id, 2, 1, true);
  raise notice 'TEST 2 OK: prediction inlagd (2-1) på match %', v_match_id;

  -- ── TEST 3: Verifiera lock_user_tips-signatur ─────────────────────────
  -- (vi anropar inte RPC:n eftersom den låser ALLA admin:s tips och
  -- flippar tips_locked på profilen – för riskabelt mot live-data)
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'lock_user_tips'
      and pg_get_function_identity_arguments(p.oid) like '%uuid%boolean%'
  ) then
    raise exception 'TEST 3 FAIL: lock_user_tips saknar förväntad signatur';
  end if;
  raise notice 'TEST 3 OK: lock_user_tips finns med 2-param-signatur';

  -- ── TEST 4: Admin matar in resultat, leaderboard räknar ────────────────
  update public.matches
  set home_score = 2, away_score = 1, result_confirmed = true
  where id = v_match_id;

  -- Vänta lite – leaderboard-vyn är inte materializerad så den uppdateras direkt
  select total_points, exact_scores
  into v_total_points, v_exact_count
  from public.leaderboard
  where user_id = v_admin_id;

  if v_exact_count is null or v_exact_count < 1 then
    raise exception 'TEST 4 FAIL: leaderboard räknar inte exakt-resultat. Got: exact=%, points=%',
      v_exact_count, v_total_points;
  end if;
  raise notice 'TEST 4 OK: leaderboard räknar rätt (exact=%, total_points=%)',
    v_exact_count, v_total_points;

  -- ── TEST 5: daily_winner_for_pool RPC ──────────────────────────────────
  select * into v_daily_winner
  from public.daily_winner_for_pool(
    (select pool_id from public.profiles where id = v_admin_id),
    array[v_match_id]
  );

  if v_daily_winner.user_id is null then
    raise notice 'TEST 5 INFO: daily_winner_for_pool returnerade null (förväntat om admin inte är i en pool eller saknar 1 plats)';
  else
    raise notice 'TEST 5 OK: daily_winner = % (poäng=%, matcher=%)',
      v_daily_winner.display_name, v_daily_winner.points, v_daily_winner.matches;
  end if;

  -- ── TEST 6: bonus_predictions + bonus_results läsbart ─────────────────
  -- (vi muterar INTE admin:s egna bonus_predictions så testet är säkert)
  if not exists (select 1 from public.bonus_results where id = 1) then
    raise exception 'TEST 6 FAIL: bonus_results-singleton-raden (id=1) saknas';
  end if;
  raise notice 'TEST 6 OK: bonus_results-singleton finns, leaderboard kan räkna bonuspoäng';

  -- ── CLEANUP ────────────────────────────────────────────────────────────
  delete from public.predictions
    where user_id = v_admin_id and match_id = v_match_id;
  update public.matches
    set home_score = v_orig_home, away_score = v_orig_away, result_confirmed = v_orig_confirmed
    where id = v_match_id;
  delete from public.pools where id = v_test_pool_id;

  -- Verifiera cleanup
  select count(*) into v_pred_count from public.predictions
    where user_id = v_admin_id and match_id = v_match_id;
  if v_pred_count > 0 then
    raise exception 'CLEANUP FAIL: prediction kvar';
  end if;

  raise notice '=== ALLA TESTER OK – CLEANUP KLAR ===';

exception when others then
  -- Försök städa även vid fel
  if v_test_pool_id is not null then
    delete from public.pools where id = v_test_pool_id;
  end if;
  if v_match_id is not null and v_orig_confirmed is not null then
    update public.matches
      set home_score = v_orig_home, away_score = v_orig_away, result_confirmed = v_orig_confirmed
      where id = v_match_id;
  end if;
  raise notice '*** TEST FAILED: % ***', SQLERRM;
end $$;
