-- ============================================================
-- Blockera sena tips: ingen får ändra/lägga in resultat-tips på
-- matcher som redan startat.
--
-- Bakgrund: i läge A låses tipsen först när deltagaren trycker
-- "Lämna in". En deltagare som INTE lämnat in kunde därför fylla i
-- tips på redan avgjorda matcher (med facit i hand) och sedan lämna in.
-- UI:t stoppar nu detta, men predictions skrivs direkt från klienten
-- via Supabase, så spärren måste även ligga i databasen.
--
-- Viktigt undantag: UPDATE som inte rör pred_home/pred_away släpps
-- igenom – lock_user_tips() sätter locked=true på befintliga rader
-- och får inte stoppas (den kallas av "Lämna in" och rör inte siffror).
-- Service-role (backup/restore/admin-verktyg, auth.uid() is null)
-- släpps också igenom.
--
-- Idempotent. Kör i Supabase SQL Editor.
-- ============================================================

create or replace function public.prevent_late_predictions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_kickoff timestamptz;
begin
  -- Service-role (cron, backup-restore, admin-API) får alltid skriva
  if auth.uid() is null then
    return new;
  end if;

  -- UPDATE som inte ändrar tipset (t.ex. lock_user_tips sätter locked)
  -- ska inte blockeras
  if tg_op = 'UPDATE'
     and new.pred_home is not distinct from old.pred_home
     and new.pred_away is not distinct from old.pred_away
  then
    return new;
  end if;

  select kickoff_at into v_kickoff
  from public.matches
  where id = new.match_id;

  if v_kickoff is not null and v_kickoff <= now() then
    raise exception 'Matchen har redan startat – tips kan inte längre läggas eller ändras'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists predictions_block_late on public.predictions;
create trigger predictions_block_late
  before insert or update on public.predictions
  for each row execute function public.prevent_late_predictions();

-- Verifiering: triggern ska finnas
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.predictions'::regclass
  and tgname = 'predictions_block_late';
