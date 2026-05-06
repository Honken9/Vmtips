-- ============================================================
-- Audit-log: spårar alla ändringar i datan
-- Kör i Supabase SQL Editor (idempotent)
-- ============================================================
--
-- Triggers fångar INSERT/UPDATE/DELETE på alla viktiga tabeller och
-- skriver en rad till public.audit_log med:
--   - vem (auth.uid())
--   - när (timestamp)
--   - vad (tabell + record_id)
--   - hur (insert/update/delete + diff)
--
-- Endast admin kan läsa loggen via RLS.
-- ============================================================

-- ─── Tabell ────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  user_id     uuid,                       -- auth.uid() (null = system/admin via service_role)
  action      text not null,              -- 'insert' | 'update' | 'delete'
  table_name  text not null,
  record_id   text,                       -- primärnyckel som text
  changes     jsonb                       -- INSERT: hela raden; UPDATE: {field:{old,new}}; DELETE: hela raden
);

create index if not exists idx_audit_occurred on public.audit_log(occurred_at desc);
create index if not exists idx_audit_user on public.audit_log(user_id, occurred_at desc);
create index if not exists idx_audit_table on public.audit_log(table_name, occurred_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "Admin read audit" on public.audit_log;
create policy "Admin read audit"
  on public.audit_log
  for select
  using (public.is_admin());

-- Ingen INSERT-policy för authenticated → bara service_role/triggers (security definer) skriver.

-- ─── Generic trigger-funktion ──────────────────────────────
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb;
  v_record_id text;
begin
  -- Hämta ID-fältet (de flesta tabeller har 'id', men predictions+pool_payments
  -- har komposit-nyckel så vi använder user_id där 'id' saknas)
  if tg_op = 'DELETE' then
    v_changes := to_jsonb(OLD);
    v_record_id := coalesce(
      (to_jsonb(OLD) ->> 'id'),
      (to_jsonb(OLD) ->> 'user_id'),
      ''
    );
  elsif tg_op = 'INSERT' then
    v_changes := to_jsonb(NEW);
    v_record_id := coalesce(
      (to_jsonb(NEW) ->> 'id'),
      (to_jsonb(NEW) ->> 'user_id'),
      ''
    );
  else  -- UPDATE: spara bara fält som faktiskt ändrades
    select jsonb_object_agg(
      o.key,
      jsonb_build_object('old', o.value, 'new', n.value)
    )
    into v_changes
    from jsonb_each(to_jsonb(OLD)) o
    join jsonb_each(to_jsonb(NEW)) n using (key)
    where o.value is distinct from n.value
      and o.key not in ('updated_at', 'last_avatar_generated_at'); -- tysta auto-fält

    if v_changes is null or v_changes = '{}'::jsonb then
      return NEW;  -- ingen riktig ändring, skippa log
    end if;

    v_record_id := coalesce(
      (to_jsonb(NEW) ->> 'id'),
      (to_jsonb(NEW) ->> 'user_id'),
      ''
    );
  end if;

  insert into public.audit_log (user_id, action, table_name, record_id, changes)
  values (auth.uid(), lower(tg_op), tg_table_name, v_record_id, v_changes);

  return coalesce(NEW, OLD);
end;
$$;

-- ─── Hjälpare för att fästa triggern ───────────────────────
create or replace function public.attach_audit_trigger(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists audit_%s on public.%I', p_table, p_table);
  execute format(
    'create trigger audit_%s after insert or update or delete on public.%I for each row execute function public.audit_trigger()',
    p_table, p_table
  );
end;
$$;

-- ─── Fäst triggern på alla relevanta tabeller ──────────────
select public.attach_audit_trigger('predictions');
select public.attach_audit_trigger('bonus_predictions');
select public.attach_audit_trigger('bonus_results');
select public.attach_audit_trigger('pools');
select public.attach_audit_trigger('pool_memberships');
select public.attach_audit_trigger('pool_payments');
select public.attach_audit_trigger('profiles');
select public.attach_audit_trigger('matches');
select public.attach_audit_trigger('settings');

-- ─── Hjälp-vy: läsbar audit-log med display_name + email ───
create or replace view public.audit_log_readable as
select
  a.id,
  a.occurred_at,
  a.user_id,
  p.display_name as user_name,
  a.action,
  a.table_name,
  a.record_id,
  a.changes
from public.audit_log a
left join public.profiles p on p.id = a.user_id
order by a.occurred_at desc;

-- ─── Frivilligt: rensa loggen efter 90 dagar ───────────────
-- Kör manuellt eller via pg_cron om du vill. Inte automatiskt än.
--
-- delete from public.audit_log where occurred_at < now() - interval '90 days';
