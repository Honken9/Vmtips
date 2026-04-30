-- ============================================================
-- VM-Tips 2026 – Supabase Schema
-- Kör detta i Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Rensa eventuella tidigare tabeller (säkert att köra flera gånger)
drop table if exists public.bonus_predictions cascade;
drop table if exists public.predictions cascade;
drop table if exists public.matches cascade;
drop table if exists public.teams cascade;
drop table if exists public.profiles cascade;
drop table if exists public.settings cascade;
drop view if exists public.leaderboard cascade;
drop function if exists public.lock_predictions_at_kickoff cascade;
drop function if exists public.lock_user_tips cascade;
drop function if exists public.update_updated_at cascade;
drop function if exists public.handle_new_user cascade;

-- Settings (singleton-rad)
create table public.settings (
  id int primary key default 1 check (id = 1),
  tournament_mode text not null default 'B' check (tournament_mode in ('A', 'B')),
  mode_a_global_lock boolean not null default false,  -- Admin låser allt i läge A
  points_correct_result int not null default 3,
  points_exact_score int not null default 5,
  points_winner int not null default 10,
  points_finalist int not null default 5,
  updated_at timestamptz default now()
);
insert into public.settings (id) values (1);

-- Profiler (utökar Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin boolean not null default false,
  tips_locked boolean not null default false,  -- Läge A: användaren har låst sina tips
  tips_locked_at timestamptz,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Alla kan se profiler" on public.profiles for select using (true);
create policy "Användare kan uppdatera sin profil" on public.profiles for update using (auth.uid() = id);
create policy "Användare kan skapa sin profil" on public.profiles for insert with check (auth.uid() = id);
create policy "Admin kan hantera profiler" on public.profiles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- Lag
create table public.teams (
  id serial primary key,
  name text not null,
  code text not null unique,
  flag text default '🏴',
  group_name text
);

alter table public.teams enable row level security;
create policy "Alla kan se lag" on public.teams for select using (true);
create policy "Admin kan hantera lag" on public.teams for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- Matcher
create table public.matches (
  id serial primary key,
  match_number int not null,
  stage text not null check (stage in ('group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final')),
  group_name text,
  home_team_id int references public.teams(id),
  away_team_id int references public.teams(id),
  home_placeholder text,   -- t.ex. "Vinnare grupp A" för slutspel
  away_placeholder text,
  kickoff_at timestamptz not null,
  venue text,
  home_score int,
  away_score int,
  result_confirmed boolean not null default false
);

alter table public.matches enable row level security;
create policy "Alla kan se matcher" on public.matches for select using (true);
create policy "Admin kan hantera matcher" on public.matches for all using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- Tips (prediktioner)
create table public.predictions (
  id serial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id int not null references public.matches(id) on delete cascade,
  pred_home int not null check (pred_home >= 0),
  pred_away int not null check (pred_away >= 0),
  locked boolean not null default false,
  locked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, match_id)
);

alter table public.predictions enable row level security;
create policy "Alla kan se tips" on public.predictions for select using (true);
create policy "Användare kan hantera egna tips" on public.predictions
  for all using (auth.uid() = user_id);

-- Bonustips
create table public.bonus_predictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  winner_team_id int references public.teams(id),
  top_scorer text,
  finalist_1_id int references public.teams(id),
  finalist_2_id int references public.teams(id),
  locked boolean not null default false,
  locked_at timestamptz,
  created_at timestamptz default now()
);

alter table public.bonus_predictions enable row level security;
create policy "Alla kan se bonustips" on public.bonus_predictions for select using (true);
create policy "Användare kan hantera egna bonustips" on public.bonus_predictions
  for all using (auth.uid() = user_id);

-- ============================================================
-- Poängberäkning som VIEW (uppdateras automatiskt)
-- ============================================================
create or replace view public.leaderboard as
select
  p.id as user_id,
  p.display_name,
  p.tips_locked,
  count(pred.id) filter (
    where m.result_confirmed = true and pred.locked = true
  ) as predictions_graded,
  count(pred.id) filter (
    where m.result_confirmed = true and pred.locked = true
    and (
      (pred.pred_home > pred.pred_away and m.home_score > m.away_score) or
      (pred.pred_home = pred.pred_away and m.home_score = m.away_score) or
      (pred.pred_home < pred.pred_away and m.home_score < m.away_score)
    )
  ) as correct_results,
  count(pred.id) filter (
    where m.result_confirmed = true and pred.locked = true
    and pred.pred_home = m.home_score and pred.pred_away = m.away_score
  ) as exact_scores,
  coalesce(
    sum(
      case
        when m.result_confirmed = true and pred.locked = true then
          case
            when pred.pred_home = m.home_score and pred.pred_away = m.away_score then
              (select points_exact_score from public.settings limit 1)
            when (
              (pred.pred_home > pred.pred_away and m.home_score > m.away_score) or
              (pred.pred_home = pred.pred_away and m.home_score = m.away_score) or
              (pred.pred_home < pred.pred_away and m.home_score < m.away_score)
            ) then
              (select points_correct_result from public.settings limit 1)
            else 0
          end
        else 0
      end
    ),
  0) as total_points
from public.profiles p
left join public.predictions pred on pred.user_id = p.id
left join public.matches m on pred.match_id = m.id
group by p.id, p.display_name, p.tips_locked
order by total_points desc, exact_scores desc, correct_results desc;

-- ============================================================
-- Lås automatiskt tips vid avspark (kallas av cron eller admin)
-- ============================================================
create or replace function public.lock_predictions_at_kickoff()
returns void
language sql
security definer
as $$
  update public.predictions
  set locked = true, locked_at = now()
  where locked = false
    and match_id in (
      select id from public.matches where kickoff_at <= now()
    );
$$;

-- ============================================================
-- Lås alla tips för en användare (Läge A – "Skicka in")
-- ============================================================
create or replace function public.lock_user_tips(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.predictions
  set locked = true, locked_at = now()
  where user_id = p_user_id and locked = false;

  update public.profiles
  set tips_locked = true, tips_locked_at = now()
  where id = p_user_id;
end;
$$;

-- ============================================================
-- Uppdatera updated_at automatiskt
-- ============================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger predictions_updated_at
before update on public.predictions
for each row execute function public.update_updated_at();

-- ============================================================
-- Skapa profil automatiskt när ny användare registreras
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
