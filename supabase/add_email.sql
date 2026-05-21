-- ============================================================
-- Mailutskick: påminnelser + digest
-- Kör i Supabase SQL Editor (idempotent).
-- ============================================================
--
-- Fyra tabeller:
--   email_settings        singleton-rad med globala mail-inställningar
--   email_preferences     per-användare opt-out för reminders/digest
--   email_log             alla utskick som gjorts (för historik + debug)
--   email_reminders_sent  dedupe-tabell så vi inte mailar samma match
--                          till samma user flera gånger
-- ============================================================

create table if not exists public.email_settings (
  id int primary key default 1 check (id = 1),
  reminder_enabled boolean not null default true,
  reminder_minutes_before int not null default 60,
  reminder_subject text not null default 'Påminnelse: nästa match börjar snart',
  reminder_intro text not null default 'Glöm inte att tippa innan kickoff!',
  digest_enabled boolean not null default true,
  digest_day_of_week int not null default 1,   -- 1=mån, 7=sön
  digest_hour int not null default 9,
  last_digest_at timestamptz,
  sender_name text not null default 'VM-Tips',
  sender_email text not null default 'noreply@tippavm2026.se',
  updated_at timestamptz not null default now()
);
insert into public.email_settings (id) values (1) on conflict do nothing;

create table if not exists public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  match_reminders boolean not null default true,
  weekly_digest boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_log (
  id bigserial primary key,
  type text not null check (type in ('reminder','digest','test')),
  pool_id int references public.pools(id) on delete set null,
  subject text,
  recipient_count int not null default 0,
  sent_at timestamptz not null default now(),
  status text not null default 'sent',
  error text
);

create table if not exists public.email_reminders_sent (
  match_id int  not null references public.matches(id) on delete cascade,
  user_id  uuid not null references auth.users(id)   on delete cascade,
  sent_at  timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.email_settings       enable row level security;
alter table public.email_preferences    enable row level security;
alter table public.email_log            enable row level security;
alter table public.email_reminders_sent enable row level security;

drop policy if exists "Read email settings" on public.email_settings;
create policy "Read email settings" on public.email_settings for select using (true);
drop policy if exists "Admin write email settings" on public.email_settings;
create policy "Admin write email settings" on public.email_settings for all using (public.is_admin());

drop policy if exists "Own email prefs" on public.email_preferences;
create policy "Own email prefs" on public.email_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admin email prefs" on public.email_preferences;
create policy "Admin email prefs" on public.email_preferences for all using (public.is_admin());

drop policy if exists "Admin email log" on public.email_log;
create policy "Admin email log" on public.email_log for all using (public.is_admin());

drop policy if exists "Admin reminders sent" on public.email_reminders_sent;
create policy "Admin reminders sent" on public.email_reminders_sent for all using (public.is_admin());
