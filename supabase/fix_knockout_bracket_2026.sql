-- ============================================================
-- VM 2026 – byggom slutspelsträd enligt FIFA:s officiella format
--
-- Backup MÅSTE vara taget innan denna körs.
--
-- Vad gör scriptet:
--   1) Uppdaterar matches 73–104 med korrekta placeholders och kickoff_at
--      enligt FIFA. match_number och id rörs INTE – grupptipsen (match 1–72)
--      ligger orörda eftersom de är lagrade per match_id.
--   2) Raderar predictions på slutspelsmatcherna 73–104. De tippades mot
--      ett felaktigt träd och bör tippas om.
--   3) Släpper profiles.tips_locked för alla. Grupptipsens per-rad-lås
--      (predictions.locked=true) BEHÅLLS – så A-läge-deltagare kan INTE
--      ändra sina grupptips, men KAN tippa slutspelet på nytt.
--   4) Bonus-tips rörs inte alls.
--
-- Idempotent. Allt i en transaktion. Vid fel: rollback.
-- ============================================================
begin;

-- ── 1) R32: match 73–88 ───────────────────────────────────────
update public.matches set
  home_placeholder = 'Tvåa grupp A',  away_placeholder = 'Tvåa grupp B',
  kickoff_at = '2026-06-28 19:00:00+00'  where match_number = 73;
update public.matches set
  home_placeholder = 'Vinnare grupp E', away_placeholder = '3:a (A/B/C/D/F)',
  kickoff_at = '2026-06-29 20:30:00+00'  where match_number = 74;
update public.matches set
  home_placeholder = 'Vinnare grupp F', away_placeholder = 'Tvåa grupp C',
  kickoff_at = '2026-06-30 01:00:00+00'  where match_number = 75;
update public.matches set
  home_placeholder = 'Vinnare grupp C', away_placeholder = 'Tvåa grupp F',
  kickoff_at = '2026-06-29 17:00:00+00'  where match_number = 76;
update public.matches set
  home_placeholder = 'Vinnare grupp I', away_placeholder = '3:a (C/D/F/G/H)',
  kickoff_at = '2026-06-30 17:00:00+00'  where match_number = 77;
update public.matches set
  home_placeholder = 'Tvåa grupp E',    away_placeholder = 'Tvåa grupp I',
  kickoff_at = '2026-06-30 19:00:00+00' where match_number = 78;
update public.matches set
  home_placeholder = 'Vinnare grupp A', away_placeholder = '3:a (C/E/F/H/I)',
  kickoff_at = '2026-07-01 01:00:00+00'  where match_number = 79;
update public.matches set
  home_placeholder = 'Vinnare grupp L', away_placeholder = '3:a (E/H/I/J/K)',
  kickoff_at = '2026-07-01 17:00:00+00'  where match_number = 80;
update public.matches set
  home_placeholder = 'Vinnare grupp D', away_placeholder = '3:a (B/E/F/I/J)',
  kickoff_at = '2026-07-02 01:00:00+00'  where match_number = 81;
update public.matches set
  home_placeholder = 'Vinnare grupp G', away_placeholder = '3:a (A/E/H/I/J)',
  kickoff_at = '2026-07-02 04:00:00+00'  where match_number = 82;
update public.matches set
  home_placeholder = 'Tvåa grupp K',    away_placeholder = 'Tvåa grupp L',
  kickoff_at = '2026-07-02 20:00:00+00'  where match_number = 83;
update public.matches set
  home_placeholder = 'Vinnare grupp H', away_placeholder = 'Tvåa grupp J',
  kickoff_at = '2026-07-02 22:00:00+00'  where match_number = 84;
update public.matches set
  home_placeholder = 'Vinnare grupp B', away_placeholder = '3:a (E/F/G/I/J)',
  kickoff_at = '2026-07-03 02:00:00+00'  where match_number = 85;
update public.matches set
  home_placeholder = 'Vinnare grupp J', away_placeholder = 'Tvåa grupp H',
  kickoff_at = '2026-07-03 21:00:00+00' where match_number = 86;
update public.matches set
  home_placeholder = 'Vinnare grupp K', away_placeholder = '3:a (D/E/I/J/L)',
  kickoff_at = '2026-07-04 00:00:00+00'  where match_number = 87;
update public.matches set
  home_placeholder = 'Tvåa grupp D',    away_placeholder = 'Tvåa grupp G',
  kickoff_at = '2026-07-04 02:00:00+00'  where match_number = 88;

-- ── 2) R16: match 89–96 ───────────────────────────────────────
update public.matches set
  home_placeholder = 'Vinnare match 74', away_placeholder = 'Vinnare match 77',
  kickoff_at = '2026-07-04 22:00:00+00' where match_number = 89;
update public.matches set
  home_placeholder = 'Vinnare match 73', away_placeholder = 'Vinnare match 75',
  kickoff_at = '2026-07-04 19:00:00+00' where match_number = 90;
update public.matches set
  home_placeholder = 'Vinnare match 76', away_placeholder = 'Vinnare match 78',
  kickoff_at = '2026-07-05 01:00:00+00' where match_number = 91;
update public.matches set
  home_placeholder = 'Vinnare match 79', away_placeholder = 'Vinnare match 80',
  kickoff_at = '2026-07-05 19:00:00+00' where match_number = 92;
update public.matches set
  home_placeholder = 'Vinnare match 83', away_placeholder = 'Vinnare match 84',
  kickoff_at = '2026-07-06 00:00:00+00' where match_number = 93;
update public.matches set
  home_placeholder = 'Vinnare match 81', away_placeholder = 'Vinnare match 82',
  kickoff_at = '2026-07-06 02:00:00+00' where match_number = 94;
update public.matches set
  home_placeholder = 'Vinnare match 86', away_placeholder = 'Vinnare match 88',
  kickoff_at = '2026-07-07 21:00:00+00' where match_number = 95;
update public.matches set
  home_placeholder = 'Vinnare match 85', away_placeholder = 'Vinnare match 87',
  kickoff_at = '2026-07-08 01:00:00+00' where match_number = 96;

-- ── 3) Kvartsfinaler: match 97–100 ────────────────────────────
update public.matches set
  home_placeholder = 'Vinnare match 89', away_placeholder = 'Vinnare match 90',
  kickoff_at = '2026-07-09 20:00:00+00' where match_number = 97;
update public.matches set
  home_placeholder = 'Vinnare match 93', away_placeholder = 'Vinnare match 94',
  kickoff_at = '2026-07-10 19:00:00+00' where match_number = 98;
update public.matches set
  home_placeholder = 'Vinnare match 91', away_placeholder = 'Vinnare match 92',
  kickoff_at = '2026-07-11 21:00:00+00' where match_number = 99;
update public.matches set
  home_placeholder = 'Vinnare match 95', away_placeholder = 'Vinnare match 96',
  kickoff_at = '2026-07-12 00:00:00+00' where match_number = 100;

-- ── 4) Semifinaler: match 101–102 ─────────────────────────────
update public.matches set
  home_placeholder = 'Vinnare match 97', away_placeholder = 'Vinnare match 98',
  kickoff_at = '2026-07-14 19:00:00+00', venue = 'AT&T Stadium, Dallas' where match_number = 101;
update public.matches set
  home_placeholder = 'Vinnare match 99', away_placeholder = 'Vinnare match 100',
  kickoff_at = '2026-07-15 19:00:00+00', venue = 'Mercedes-Benz Stadium, Atlanta' where match_number = 102;

-- ── 5) Bronsmatch + Final ─────────────────────────────────────
update public.matches set
  home_placeholder = 'Förlorare SF1', away_placeholder = 'Förlorare SF2',
  kickoff_at = '2026-07-18 19:00:00+00' where match_number = 103;
update public.matches set
  home_placeholder = 'Vinnare SF1', away_placeholder = 'Vinnare SF2',
  kickoff_at = '2026-07-19 18:00:00+00', venue = 'MetLife Stadium, New York' where match_number = 104;

-- ── 6) Säkerhetskontroll: ska finnas exakt 32 slutspelsmatcher ─
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.matches
  where stage in ('r32','r16','qf','sf','3rd','final');
  if v_count <> 32 then
    raise exception 'Förväntade 32 slutspelsmatcher, fick %', v_count;
  end if;
end $$;

-- ── 7) Radera slutspels-predictions (tippades mot fel träd) ───
delete from public.predictions
where match_id in (
  select id from public.matches
  where stage in ('r32','r16','qf','sf','3rd','final')
);

-- ── 8) Släpp profiles.tips_locked för alla ────────────────────
-- Per-match-lås på grupptips (predictions.locked=true) behålls så
-- A-läges-deltagare INTE kan ändra sina gruppspels-tips.
update public.profiles
set tips_locked = false,
    tips_locked_at = null
where tips_locked = true;

-- ── 9) Sammanfattning för admin (synligt i SQL Editor) ────────
select
  (select count(*) from public.matches
    where stage in ('r32','r16','qf','sf','3rd','final')) as knockout_matches_total,
  (select count(*) from public.predictions p
    join public.matches m on m.id = p.match_id
    where m.stage in ('r32','r16','qf','sf','3rd','final')) as knockout_predictions_remaining,
  (select count(*) from public.profiles where tips_locked = true) as profiles_still_locked;

commit;
