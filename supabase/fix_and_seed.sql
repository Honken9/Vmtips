-- ============================================================
-- VM-Tips 2026 – Komplett fix + seed
-- Kör detta EN gång i Supabase SQL Editor
-- ============================================================

-- 1. Rensa allt
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
drop function if exists public.is_admin cascade;
drop trigger if exists on_auth_user_created on auth.users;

-- 2. Hjälpfunktion för admin-check (löser infinite recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 3. Settings
create table public.settings (
  id int primary key default 1 check (id = 1),
  tournament_mode text not null default 'B' check (tournament_mode in ('A', 'B')),
  mode_a_global_lock boolean not null default false,
  points_correct_result int not null default 3,
  points_exact_score int not null default 5,
  points_winner int not null default 10,
  points_finalist int not null default 5,
  updated_at timestamptz default now()
);
insert into public.settings (id) values (1);

-- 4. Profiler
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin boolean not null default false,
  tips_locked boolean not null default false,
  tips_locked_at timestamptz,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Alla kan se profiler"            on public.profiles for select using (true);
create policy "Användare kan uppdatera sin profil" on public.profiles for update using (auth.uid() = id);
create policy "Användare kan skapa sin profil"  on public.profiles for insert with check (auth.uid() = id);
create policy "Admin kan hantera profiler"      on public.profiles for all using (public.is_admin());

-- 5. Lag
create table public.teams (
  id serial primary key,
  name text not null,
  code text not null unique,
  flag text default '🏴',
  group_name text
);
alter table public.teams enable row level security;
create policy "Alla kan se lag"       on public.teams for select using (true);
create policy "Admin kan hantera lag" on public.teams for all    using (public.is_admin());

-- 6. Matcher
create table public.matches (
  id serial primary key,
  match_number int not null,
  stage text not null check (stage in ('group','r32','r16','qf','sf','3rd','final')),
  group_name text,
  home_team_id int references public.teams(id),
  away_team_id int references public.teams(id),
  home_placeholder text,
  away_placeholder text,
  kickoff_at timestamptz not null,
  venue text,
  home_score int,
  away_score int,
  result_confirmed boolean not null default false
);
alter table public.matches enable row level security;
create policy "Alla kan se matcher"       on public.matches for select using (true);
create policy "Admin kan hantera matcher" on public.matches for all    using (public.is_admin());

-- 7. Tips
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
create policy "Alla kan se tips"             on public.predictions for select using (true);
create policy "Användare hanterar egna tips" on public.predictions for all    using (auth.uid() = user_id);

-- 8. Bonustips
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
create policy "Alla kan se bonustips"             on public.bonus_predictions for select using (true);
create policy "Användare hanterar egna bonustips" on public.bonus_predictions for all    using (auth.uid() = user_id);

-- 9. Leaderboard-vy
create or replace view public.leaderboard as
select
  p.id as user_id,
  p.display_name,
  p.tips_locked,
  count(pred.id) filter (where m.result_confirmed and pred.locked) as predictions_graded,
  count(pred.id) filter (where m.result_confirmed and pred.locked and (
    (pred.pred_home > pred.pred_away and m.home_score > m.away_score) or
    (pred.pred_home = pred.pred_away and m.home_score = m.away_score) or
    (pred.pred_home < pred.pred_away and m.home_score < m.away_score)
  )) as correct_results,
  count(pred.id) filter (where m.result_confirmed and pred.locked
    and pred.pred_home = m.home_score and pred.pred_away = m.away_score) as exact_scores,
  coalesce(sum(case
    when m.result_confirmed and pred.locked then
      case
        when pred.pred_home = m.home_score and pred.pred_away = m.away_score then
          (select points_exact_score from public.settings limit 1)
        when (
          (pred.pred_home > pred.pred_away and m.home_score > m.away_score) or
          (pred.pred_home = pred.pred_away and m.home_score = m.away_score) or
          (pred.pred_home < pred.pred_away and m.home_score < m.away_score)
        ) then (select points_correct_result from public.settings limit 1)
        else 0
      end
    else 0
  end), 0) as total_points
from public.profiles p
left join public.predictions pred on pred.user_id = p.id
left join public.matches m on pred.match_id = m.id
group by p.id, p.display_name, p.tips_locked
order by total_points desc, exact_scores desc, correct_results desc;

-- 10. Funktioner
create or replace function public.lock_predictions_at_kickoff()
returns void language sql security definer as $$
  update public.predictions set locked = true, locked_at = now()
  where locked = false
    and match_id in (select id from public.matches where kickoff_at <= now());
$$;

create or replace function public.lock_user_tips(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.predictions set locked = true, locked_at = now()
  where user_id = p_user_id and locked = false;
  update public.profiles set tips_locked = true, tips_locked_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger predictions_updated_at
before update on public.predictions
for each row execute function public.update_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 11. Gör befintliga användare till profiler (ifall de saknas)
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data->>'display_name', split_part(email,'@',1))
from auth.users
on conflict (id) do nothing;

-- 12. LAG (48 lag)
insert into public.teams (name, code, flag, group_name) values
('Argentina','ARG','🇦🇷','A'),('Chile','CHI','🇨🇱','A'),('Peru','PER','🇵🇪','A'),('Canada','CAN','🇨🇦','A'),
('Mexico','MEX','🇲🇽','B'),('Jamaica','JAM','🇯🇲','B'),('Venezuela','VEN','🇻🇪','B'),('Ecuador','ECU','🇪🇨','B'),
('USA','USA','🇺🇸','C'),('Panama','PAN','🇵🇦','C'),('Uruguay','URU','🇺🇾','C'),('Bolivia','BOL','🇧🇴','C'),
('Brazil','BRA','🇧🇷','D'),('Costa Rica','CRC','🇨🇷','D'),('Colombia','COL','🇨🇴','D'),('Paraguay','PAR','🇵🇾','D'),
('Spain','ESP','🇪🇸','E'),('Croatia','CRO','🇭🇷','E'),('Morocco','MAR','🇲🇦','E'),('Japan','JPN','🇯🇵','E'),
('Portugal','POR','🇵🇹','F'),('Poland','POL','🇵🇱','F'),('South Korea','KOR','🇰🇷','F'),('Algeria','ALG','🇩🇿','F'),
('France','FRA','🇫🇷','G'),('Belgium','BEL','🇧🇪','G'),('Australia','AUS','🇦🇺','G'),('Nigeria','NGA','🇳🇬','G'),
('Germany','GER','🇩🇪','H'),('Netherlands','NED','🇳🇱','H'),('Senegal','SEN','🇸🇳','H'),('New Zealand','NZL','🇳🇿','H'),
('England','ENG','🏴󠁧󠁢󠁥󠁮󠁧󠁿','I'),('Serbia','SRB','🇷🇸','I'),('Iran','IRN','🇮🇷','I'),('Cameroon','CMR','🇨🇲','I'),
('Italy','ITA','🇮🇹','J'),('Switzerland','SUI','🇨🇭','J'),('Egypt','EGY','🇪🇬','J'),('Saudi Arabia','KSA','🇸🇦','J'),
('Denmark','DEN','🇩🇰','K'),('Austria','AUT','🇦🇹','K'),('Tunisia','TUN','🇹🇳','K'),('DR Congo','COD','🇨🇩','K'),
('Turkey','TUR','🇹🇷','L'),('Ukraine','UKR','🇺🇦','L'),('Ivory Coast','CIV','🇨🇮','L'),('Honduras','HON','🇭🇳','L');

-- 13. MATCHER – Gruppspel (72 matcher)
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(1,'group','A',(select id from teams where code='ARG'),(select id from teams where code='CAN'),'2026-06-11 21:00:00+00','MetLife Stadium, New York'),
(2,'group','A',(select id from teams where code='CHI'),(select id from teams where code='PER'),'2026-06-12 00:00:00+00','SoFi Stadium, Los Angeles'),
(3,'group','A',(select id from teams where code='ARG'),(select id from teams where code='PER'),'2026-06-16 21:00:00+00','AT&T Stadium, Dallas'),
(4,'group','A',(select id from teams where code='CAN'),(select id from teams where code='CHI'),'2026-06-17 00:00:00+00','Levi''s Stadium, San Jose'),
(5,'group','A',(select id from teams where code='ARG'),(select id from teams where code='CHI'),'2026-06-21 22:00:00+00','Estadio Azteca, Mexico City'),
(6,'group','A',(select id from teams where code='CAN'),(select id from teams where code='PER'),'2026-06-21 22:00:00+00','BC Place, Vancouver'),
(7,'group','B',(select id from teams where code='MEX'),(select id from teams where code='JAM'),'2026-06-12 21:00:00+00','Estadio Azteca, Mexico City'),
(8,'group','B',(select id from teams where code='ECU'),(select id from teams where code='VEN'),'2026-06-13 00:00:00+00','NRG Stadium, Houston'),
(9,'group','B',(select id from teams where code='MEX'),(select id from teams where code='VEN'),'2026-06-17 21:00:00+00','Estadio Guadalajara, Guadalajara'),
(10,'group','B',(select id from teams where code='JAM'),(select id from teams where code='ECU'),'2026-06-18 00:00:00+00','Hard Rock Stadium, Miami'),
(11,'group','B',(select id from teams where code='MEX'),(select id from teams where code='ECU'),'2026-06-22 22:00:00+00','Estadio Azteca, Mexico City'),
(12,'group','B',(select id from teams where code='VEN'),(select id from teams where code='JAM'),'2026-06-22 22:00:00+00','Allegiant Stadium, Las Vegas'),
(13,'group','C',(select id from teams where code='USA'),(select id from teams where code='URU'),'2026-06-13 21:00:00+00','MetLife Stadium, New York'),
(14,'group','C',(select id from teams where code='PAN'),(select id from teams where code='BOL'),'2026-06-14 00:00:00+00','SoFi Stadium, Los Angeles'),
(15,'group','C',(select id from teams where code='USA'),(select id from teams where code='BOL'),'2026-06-18 21:00:00+00','AT&T Stadium, Dallas'),
(16,'group','C',(select id from teams where code='URU'),(select id from teams where code='PAN'),'2026-06-19 00:00:00+00','Arrowhead Stadium, Kansas City'),
(17,'group','C',(select id from teams where code='USA'),(select id from teams where code='PAN'),'2026-06-23 22:00:00+00','Lumen Field, Seattle'),
(18,'group','C',(select id from teams where code='URU'),(select id from teams where code='BOL'),'2026-06-23 22:00:00+00','Hard Rock Stadium, Miami'),
(19,'group','D',(select id from teams where code='BRA'),(select id from teams where code='CRC'),'2026-06-14 21:00:00+00','MetLife Stadium, New York'),
(20,'group','D',(select id from teams where code='COL'),(select id from teams where code='PAR'),'2026-06-15 00:00:00+00','NRG Stadium, Houston'),
(21,'group','D',(select id from teams where code='BRA'),(select id from teams where code='PAR'),'2026-06-19 21:00:00+00','SoFi Stadium, Los Angeles'),
(22,'group','D',(select id from teams where code='CRC'),(select id from teams where code='COL'),'2026-06-20 00:00:00+00','AT&T Stadium, Dallas'),
(23,'group','D',(select id from teams where code='BRA'),(select id from teams where code='COL'),'2026-06-24 22:00:00+00','MetLife Stadium, New York'),
(24,'group','D',(select id from teams where code='PAR'),(select id from teams where code='CRC'),'2026-06-24 22:00:00+00','Estadio Guadalajara, Guadalajara'),
(25,'group','E',(select id from teams where code='ESP'),(select id from teams where code='MAR'),'2026-06-15 21:00:00+00','Hard Rock Stadium, Miami'),
(26,'group','E',(select id from teams where code='CRO'),(select id from teams where code='JPN'),'2026-06-16 00:00:00+00','Levi''s Stadium, San Jose'),
(27,'group','E',(select id from teams where code='ESP'),(select id from teams where code='JPN'),'2026-06-20 21:00:00+00','MetLife Stadium, New York'),
(28,'group','E',(select id from teams where code='MAR'),(select id from teams where code='CRO'),'2026-06-21 00:00:00+00','NRG Stadium, Houston'),
(29,'group','E',(select id from teams where code='ESP'),(select id from teams where code='CRO'),'2026-06-25 22:00:00+00','AT&T Stadium, Dallas'),
(30,'group','E',(select id from teams where code='JPN'),(select id from teams where code='MAR'),'2026-06-25 22:00:00+00','BC Place, Vancouver'),
(31,'group','F',(select id from teams where code='POR'),(select id from teams where code='ALG'),'2026-06-16 21:00:00+00','SoFi Stadium, Los Angeles'),
(32,'group','F',(select id from teams where code='POL'),(select id from teams where code='KOR'),'2026-06-17 00:00:00+00','Allegiant Stadium, Las Vegas'),
(33,'group','F',(select id from teams where code='POR'),(select id from teams where code='KOR'),'2026-06-21 21:00:00+00','Hard Rock Stadium, Miami'),
(34,'group','F',(select id from teams where code='ALG'),(select id from teams where code='POL'),'2026-06-22 00:00:00+00','Lumen Field, Seattle'),
(35,'group','F',(select id from teams where code='POR'),(select id from teams where code='POL'),'2026-06-26 22:00:00+00','MetLife Stadium, New York'),
(36,'group','F',(select id from teams where code='KOR'),(select id from teams where code='ALG'),'2026-06-26 22:00:00+00','Arrowhead Stadium, Kansas City'),
(37,'group','G',(select id from teams where code='FRA'),(select id from teams where code='NGA'),'2026-06-17 21:00:00+00','AT&T Stadium, Dallas'),
(38,'group','G',(select id from teams where code='BEL'),(select id from teams where code='AUS'),'2026-06-18 00:00:00+00','SoFi Stadium, Los Angeles'),
(39,'group','G',(select id from teams where code='FRA'),(select id from teams where code='AUS'),'2026-06-22 21:00:00+00','Levi''s Stadium, San Jose'),
(40,'group','G',(select id from teams where code='NGA'),(select id from teams where code='BEL'),'2026-06-23 00:00:00+00','MetLife Stadium, New York'),
(41,'group','G',(select id from teams where code='FRA'),(select id from teams where code='BEL'),'2026-06-27 22:00:00+00','Hard Rock Stadium, Miami'),
(42,'group','G',(select id from teams where code='AUS'),(select id from teams where code='NGA'),'2026-06-27 22:00:00+00','NRG Stadium, Houston'),
(43,'group','H',(select id from teams where code='GER'),(select id from teams where code='SEN'),'2026-06-18 21:00:00+00','MetLife Stadium, New York'),
(44,'group','H',(select id from teams where code='NED'),(select id from teams where code='NZL'),'2026-06-19 00:00:00+00','Allegiant Stadium, Las Vegas'),
(45,'group','H',(select id from teams where code='GER'),(select id from teams where code='NZL'),'2026-06-23 21:00:00+00','AT&T Stadium, Dallas'),
(46,'group','H',(select id from teams where code='SEN'),(select id from teams where code='NED'),'2026-06-24 00:00:00+00','SoFi Stadium, Los Angeles'),
(47,'group','H',(select id from teams where code='GER'),(select id from teams where code='NED'),'2026-06-28 22:00:00+00','MetLife Stadium, New York'),
(48,'group','H',(select id from teams where code='NZL'),(select id from teams where code='SEN'),'2026-06-28 22:00:00+00','BC Place, Vancouver'),
(49,'group','I',(select id from teams where code='ENG'),(select id from teams where code='IRN'),'2026-06-19 21:00:00+00','Lumen Field, Seattle'),
(50,'group','I',(select id from teams where code='SRB'),(select id from teams where code='CMR'),'2026-06-20 00:00:00+00','Hard Rock Stadium, Miami'),
(51,'group','I',(select id from teams where code='ENG'),(select id from teams where code='CMR'),'2026-06-24 21:00:00+00','NRG Stadium, Houston'),
(52,'group','I',(select id from teams where code='IRN'),(select id from teams where code='SRB'),'2026-06-25 00:00:00+00','AT&T Stadium, Dallas'),
(53,'group','I',(select id from teams where code='ENG'),(select id from teams where code='SRB'),'2026-06-29 22:00:00+00','MetLife Stadium, New York'),
(54,'group','I',(select id from teams where code='CMR'),(select id from teams where code='IRN'),'2026-06-29 22:00:00+00','Estadio Azteca, Mexico City'),
(55,'group','J',(select id from teams where code='ITA'),(select id from teams where code='KSA'),'2026-06-20 21:00:00+00','SoFi Stadium, Los Angeles'),
(56,'group','J',(select id from teams where code='SUI'),(select id from teams where code='EGY'),'2026-06-21 00:00:00+00','Levi''s Stadium, San Jose'),
(57,'group','J',(select id from teams where code='ITA'),(select id from teams where code='EGY'),'2026-06-25 21:00:00+00','Allegiant Stadium, Las Vegas'),
(58,'group','J',(select id from teams where code='KSA'),(select id from teams where code='SUI'),'2026-06-26 00:00:00+00','BC Place, Vancouver'),
(59,'group','J',(select id from teams where code='ITA'),(select id from teams where code='SUI'),'2026-06-30 22:00:00+00','MetLife Stadium, New York'),
(60,'group','J',(select id from teams where code='EGY'),(select id from teams where code='KSA'),'2026-06-30 22:00:00+00','NRG Stadium, Houston'),
(61,'group','K',(select id from teams where code='DEN'),(select id from teams where code='TUN'),'2026-06-21 21:00:00+00','Hard Rock Stadium, Miami'),
(62,'group','K',(select id from teams where code='AUT'),(select id from teams where code='COD'),'2026-06-22 00:00:00+00','Arrowhead Stadium, Kansas City'),
(63,'group','K',(select id from teams where code='DEN'),(select id from teams where code='COD'),'2026-06-26 21:00:00+00','AT&T Stadium, Dallas'),
(64,'group','K',(select id from teams where code='TUN'),(select id from teams where code='AUT'),'2026-06-27 00:00:00+00','SoFi Stadium, Los Angeles'),
(65,'group','K',(select id from teams where code='DEN'),(select id from teams where code='AUT'),'2026-07-01 22:00:00+00','MetLife Stadium, New York'),
(66,'group','K',(select id from teams where code='COD'),(select id from teams where code='TUN'),'2026-07-01 22:00:00+00','Lumen Field, Seattle'),
(67,'group','L',(select id from teams where code='TUR'),(select id from teams where code='HON'),'2026-06-22 21:00:00+00','NRG Stadium, Houston'),
(68,'group','L',(select id from teams where code='UKR'),(select id from teams where code='CIV'),'2026-06-23 00:00:00+00','BC Place, Vancouver'),
(69,'group','L',(select id from teams where code='TUR'),(select id from teams where code='CIV'),'2026-06-27 21:00:00+00','Allegiant Stadium, Las Vegas'),
(70,'group','L',(select id from teams where code='HON'),(select id from teams where code='UKR'),'2026-06-28 00:00:00+00','Estadio Azteca, Mexico City'),
(71,'group','L',(select id from teams where code='TUR'),(select id from teams where code='UKR'),'2026-07-02 22:00:00+00','MetLife Stadium, New York'),
(72,'group','L',(select id from teams where code='CIV'),(select id from teams where code='HON'),'2026-07-02 22:00:00+00','AT&T Stadium, Dallas');

-- Slutspel
insert into public.matches (match_number,stage,home_placeholder,away_placeholder,kickoff_at,venue) values
(73,'r32','Vinnare grupp A','3:a plats B/C/D','2026-07-04 19:00:00+00','TBD'),
(74,'r32','Vinnare grupp C','3:a plats A/B/E','2026-07-04 22:00:00+00','TBD'),
(75,'r32','Vinnare grupp B','3:a plats C/D/F','2026-07-05 19:00:00+00','TBD'),
(76,'r32','Vinnare grupp D','3:a plats A/E/G','2026-07-05 22:00:00+00','TBD'),
(77,'r32','Vinnare grupp E','3:a plats B/F/H','2026-07-06 19:00:00+00','TBD'),
(78,'r32','Vinnare grupp G','3:a plats C/I/J','2026-07-06 22:00:00+00','TBD'),
(79,'r32','Vinnare grupp F','3:a plats D/G/K','2026-07-07 19:00:00+00','TBD'),
(80,'r32','Vinnare grupp H','3:a plats E/F/L','2026-07-07 22:00:00+00','TBD'),
(81,'r32','Vinnare grupp I','Tvåa grupp J','2026-07-08 19:00:00+00','TBD'),
(82,'r32','Vinnare grupp K','Tvåa grupp L','2026-07-08 22:00:00+00','TBD'),
(83,'r32','Vinnare grupp J','Tvåa grupp I','2026-07-09 19:00:00+00','TBD'),
(84,'r32','Vinnare grupp L','Tvåa grupp K','2026-07-09 22:00:00+00','TBD'),
(85,'r32','Tvåa grupp A','Tvåa grupp B','2026-07-10 19:00:00+00','TBD'),
(86,'r32','Tvåa grupp C','Tvåa grupp D','2026-07-10 22:00:00+00','TBD'),
(87,'r32','Tvåa grupp E','Tvåa grupp F','2026-07-11 19:00:00+00','TBD'),
(88,'r32','Tvåa grupp G','Tvåa grupp H','2026-07-11 22:00:00+00','TBD'),
(89,'r16','Vinnare M73','Vinnare M74','2026-07-14 19:00:00+00','TBD'),
(90,'r16','Vinnare M75','Vinnare M76','2026-07-14 22:00:00+00','TBD'),
(91,'r16','Vinnare M77','Vinnare M78','2026-07-15 19:00:00+00','TBD'),
(92,'r16','Vinnare M79','Vinnare M80','2026-07-15 22:00:00+00','TBD'),
(93,'r16','Vinnare M81','Vinnare M82','2026-07-16 19:00:00+00','TBD'),
(94,'r16','Vinnare M83','Vinnare M84','2026-07-16 22:00:00+00','TBD'),
(95,'r16','Vinnare M85','Vinnare M86','2026-07-17 19:00:00+00','TBD'),
(96,'r16','Vinnare M87','Vinnare M88','2026-07-17 22:00:00+00','TBD'),
(97,'qf','Vinnare M89','Vinnare M90','2026-07-22 19:00:00+00','TBD'),
(98,'qf','Vinnare M91','Vinnare M92','2026-07-22 22:00:00+00','TBD'),
(99,'qf','Vinnare M93','Vinnare M94','2026-07-23 19:00:00+00','TBD'),
(100,'qf','Vinnare M95','Vinnare M96','2026-07-23 22:00:00+00','TBD'),
(101,'sf','Vinnare M97','Vinnare M98','2026-07-26 22:00:00+00','MetLife Stadium, New York'),
(102,'sf','Vinnare M99','Vinnare M100','2026-07-27 22:00:00+00','AT&T Stadium, Dallas'),
(103,'3rd','Förlorare SF1','Förlorare SF2','2026-07-30 19:00:00+00','Hard Rock Stadium, Miami'),
(104,'final','Vinnare SF1','Vinnare SF2','2026-08-02 20:00:00+00','MetLife Stadium, New York');

-- 14. Sätt admin på befintlig användare
update public.profiles set is_admin = true
where id = (select id from auth.users order by created_at limit 1);
