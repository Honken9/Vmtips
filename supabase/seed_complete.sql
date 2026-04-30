-- ============================================================
-- VM 2026 – Komplett seed (kör EFTER schema.sql)
-- Rensar gamla matcher/lag och lägger in alla på nytt
-- ============================================================

-- Rensa befintlig data
delete from public.predictions;
delete from public.matches;
delete from public.teams;

-- Settings (se till att den finns)
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- LAG (48 lag, grupp A–L)
-- ============================================================
insert into public.teams (name, code, flag, group_name) values
('Argentina',    'ARG', '🇦🇷', 'A'), ('Chile',        'CHI', '🇨🇱', 'A'),
('Peru',         'PER', '🇵🇪', 'A'), ('Canada',       'CAN', '🇨🇦', 'A'),
('Mexico',       'MEX', '🇲🇽', 'B'), ('Jamaica',      'JAM', '🇯🇲', 'B'),
('Venezuela',    'VEN', '🇻🇪', 'B'), ('Ecuador',      'ECU', '🇪🇨', 'B'),
('USA',          'USA', '🇺🇸', 'C'), ('Panama',       'PAN', '🇵🇦', 'C'),
('Uruguay',      'URU', '🇺🇾', 'C'), ('Bolivia',      'BOL', '🇧🇴', 'C'),
('Brazil',       'BRA', '🇧🇷', 'D'), ('Costa Rica',   'CRC', '🇨🇷', 'D'),
('Colombia',     'COL', '🇨🇴', 'D'), ('Paraguay',     'PAR', '🇵🇾', 'D'),
('Spain',        'ESP', '🇪🇸', 'E'), ('Croatia',      'CRO', '🇭🇷', 'E'),
('Morocco',      'MAR', '🇲🇦', 'E'), ('Japan',        'JPN', '🇯🇵', 'E'),
('Portugal',     'POR', '🇵🇹', 'F'), ('Poland',       'POL', '🇵🇱', 'F'),
('South Korea',  'KOR', '🇰🇷', 'F'), ('Algeria',      'ALG', '🇩🇿', 'F'),
('France',       'FRA', '🇫🇷', 'G'), ('Belgium',      'BEL', '🇧🇪', 'G'),
('Australia',    'AUS', '🇦🇺', 'G'), ('Nigeria',      'NGA', '🇳🇬', 'G'),
('Germany',      'GER', '🇩🇪', 'H'), ('Netherlands',  'NED', '🇳🇱', 'H'),
('Senegal',      'SEN', '🇸🇳', 'H'), ('New Zealand',  'NZL', '🇳🇿', 'H'),
('England',      'ENG', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'I'), ('Serbia',       'SRB', '🇷🇸', 'I'),
('Iran',         'IRN', '🇮🇷', 'I'), ('Cameroon',     'CMR', '🇨🇲', 'I'),
('Italy',        'ITA', '🇮🇹', 'J'), ('Switzerland',  'SUI', '🇨🇭', 'J'),
('Egypt',        'EGY', '🇪🇬', 'J'), ('Saudi Arabia', 'KSA', '🇸🇦', 'J'),
('Denmark',      'DEN', '🇩🇰', 'K'), ('Austria',      'AUT', '🇦🇹', 'K'),
('Tunisia',      'TUN', '🇹🇳', 'K'), ('DR Congo',     'COD', '🇨🇩', 'K'),
('Turkey',       'TUR', '🇹🇷', 'L'), ('Ukraine',      'UKR', '🇺🇦', 'L'),
('Ivory Coast',  'CIV', '🇨🇮', 'L'), ('Honduras',     'HON', '🇭🇳', 'L');

-- ============================================================
-- GRUPPSPEL – 72 matcher
-- ============================================================

-- GRUPP A (MetLife NY / SoFi LA / AT&T Dallas)
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(1, 'group','A',(select id from teams where code='ARG'),(select id from teams where code='CAN'),'2026-06-11 21:00:00+00','MetLife Stadium, New York'),
(2, 'group','A',(select id from teams where code='CHI'),(select id from teams where code='PER'),'2026-06-12 00:00:00+00','SoFi Stadium, Los Angeles'),
(3, 'group','A',(select id from teams where code='ARG'),(select id from teams where code='PER'),'2026-06-16 21:00:00+00','AT&T Stadium, Dallas'),
(4, 'group','A',(select id from teams where code='CAN'),(select id from teams where code='CHI'),'2026-06-17 00:00:00+00','Levi''s Stadium, San Jose'),
(5, 'group','A',(select id from teams where code='ARG'),(select id from teams where code='CHI'),'2026-06-21 22:00:00+00','Estadio Azteca, Mexico City'),
(6, 'group','A',(select id from teams where code='CAN'),(select id from teams where code='PER'),'2026-06-21 22:00:00+00','BC Place, Vancouver');

-- GRUPP B
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(7,  'group','B',(select id from teams where code='MEX'),(select id from teams where code='JAM'),'2026-06-12 21:00:00+00','Estadio Azteca, Mexico City'),
(8,  'group','B',(select id from teams where code='ECU'),(select id from teams where code='VEN'),'2026-06-13 00:00:00+00','NRG Stadium, Houston'),
(9,  'group','B',(select id from teams where code='MEX'),(select id from teams where code='VEN'),'2026-06-17 21:00:00+00','Estadio Guadalajara, Guadalajara'),
(10, 'group','B',(select id from teams where code='JAM'),(select id from teams where code='ECU'),'2026-06-18 00:00:00+00','Hard Rock Stadium, Miami'),
(11, 'group','B',(select id from teams where code='MEX'),(select id from teams where code='ECU'),'2026-06-22 22:00:00+00','Estadio Azteca, Mexico City'),
(12, 'group','B',(select id from teams where code='VEN'),(select id from teams where code='JAM'),'2026-06-22 22:00:00+00','Allegiant Stadium, Las Vegas');

-- GRUPP C
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(13, 'group','C',(select id from teams where code='USA'),(select id from teams where code='URU'),'2026-06-13 21:00:00+00','MetLife Stadium, New York'),
(14, 'group','C',(select id from teams where code='PAN'),(select id from teams where code='BOL'),'2026-06-14 00:00:00+00','SoFi Stadium, Los Angeles'),
(15, 'group','C',(select id from teams where code='USA'),(select id from teams where code='BOL'),'2026-06-18 21:00:00+00','AT&T Stadium, Dallas'),
(16, 'group','C',(select id from teams where code='URU'),(select id from teams where code='PAN'),'2026-06-19 00:00:00+00','Arrowhead Stadium, Kansas City'),
(17, 'group','C',(select id from teams where code='USA'),(select id from teams where code='PAN'),'2026-06-23 22:00:00+00','Lumen Field, Seattle'),
(18, 'group','C',(select id from teams where code='URU'),(select id from teams where code='BOL'),'2026-06-23 22:00:00+00','Hard Rock Stadium, Miami');

-- GRUPP D
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(19, 'group','D',(select id from teams where code='BRA'),(select id from teams where code='CRC'),'2026-06-14 21:00:00+00','MetLife Stadium, New York'),
(20, 'group','D',(select id from teams where code='COL'),(select id from teams where code='PAR'),'2026-06-15 00:00:00+00','NRG Stadium, Houston'),
(21, 'group','D',(select id from teams where code='BRA'),(select id from teams where code='PAR'),'2026-06-19 21:00:00+00','SoFi Stadium, Los Angeles'),
(22, 'group','D',(select id from teams where code='CRC'),(select id from teams where code='COL'),'2026-06-20 00:00:00+00','AT&T Stadium, Dallas'),
(23, 'group','D',(select id from teams where code='BRA'),(select id from teams where code='COL'),'2026-06-24 22:00:00+00','MetLife Stadium, New York'),
(24, 'group','D',(select id from teams where code='PAR'),(select id from teams where code='CRC'),'2026-06-24 22:00:00+00','Estadio Guadalajara, Guadalajara');

-- GRUPP E
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(25, 'group','E',(select id from teams where code='ESP'),(select id from teams where code='MAR'),'2026-06-15 21:00:00+00','Hard Rock Stadium, Miami'),
(26, 'group','E',(select id from teams where code='CRO'),(select id from teams where code='JPN'),'2026-06-16 00:00:00+00','Levi''s Stadium, San Jose'),
(27, 'group','E',(select id from teams where code='ESP'),(select id from teams where code='JPN'),'2026-06-20 21:00:00+00','MetLife Stadium, New York'),
(28, 'group','E',(select id from teams where code='MAR'),(select id from teams where code='CRO'),'2026-06-21 00:00:00+00','NRG Stadium, Houston'),
(29, 'group','E',(select id from teams where code='ESP'),(select id from teams where code='CRO'),'2026-06-25 22:00:00+00','AT&T Stadium, Dallas'),
(30, 'group','E',(select id from teams where code='JPN'),(select id from teams where code='MAR'),'2026-06-25 22:00:00+00','BC Place, Vancouver');

-- GRUPP F
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(31, 'group','F',(select id from teams where code='POR'),(select id from teams where code='ALG'),'2026-06-16 21:00:00+00','SoFi Stadium, Los Angeles'),
(32, 'group','F',(select id from teams where code='POL'),(select id from teams where code='KOR'),'2026-06-17 00:00:00+00','Allegiant Stadium, Las Vegas'),
(33, 'group','F',(select id from teams where code='POR'),(select id from teams where code='KOR'),'2026-06-21 21:00:00+00','Hard Rock Stadium, Miami'),
(34, 'group','F',(select id from teams where code='ALG'),(select id from teams where code='POL'),'2026-06-22 00:00:00+00','Lumen Field, Seattle'),
(35, 'group','F',(select id from teams where code='POR'),(select id from teams where code='POL'),'2026-06-26 22:00:00+00','MetLife Stadium, New York'),
(36, 'group','F',(select id from teams where code='KOR'),(select id from teams where code='ALG'),'2026-06-26 22:00:00+00','Arrowhead Stadium, Kansas City');

-- GRUPP G
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(37, 'group','G',(select id from teams where code='FRA'),(select id from teams where code='NGA'),'2026-06-17 21:00:00+00','AT&T Stadium, Dallas'),
(38, 'group','G',(select id from teams where code='BEL'),(select id from teams where code='AUS'),'2026-06-18 00:00:00+00','SoFi Stadium, Los Angeles'),
(39, 'group','G',(select id from teams where code='FRA'),(select id from teams where code='AUS'),'2026-06-22 21:00:00+00','Levi''s Stadium, San Jose'),
(40, 'group','G',(select id from teams where code='NGA'),(select id from teams where code='BEL'),'2026-06-23 00:00:00+00','MetLife Stadium, New York'),
(41, 'group','G',(select id from teams where code='FRA'),(select id from teams where code='BEL'),'2026-06-27 22:00:00+00','Hard Rock Stadium, Miami'),
(42, 'group','G',(select id from teams where code='AUS'),(select id from teams where code='NGA'),'2026-06-27 22:00:00+00','NRG Stadium, Houston');

-- GRUPP H
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(43, 'group','H',(select id from teams where code='GER'),(select id from teams where code='SEN'),'2026-06-18 21:00:00+00','MetLife Stadium, New York'),
(44, 'group','H',(select id from teams where code='NED'),(select id from teams where code='NZL'),'2026-06-19 00:00:00+00','Allegiant Stadium, Las Vegas'),
(45, 'group','H',(select id from teams where code='GER'),(select id from teams where code='NZL'),'2026-06-23 21:00:00+00','AT&T Stadium, Dallas'),
(46, 'group','H',(select id from teams where code='SEN'),(select id from teams where code='NED'),'2026-06-24 00:00:00+00','SoFi Stadium, Los Angeles'),
(47, 'group','H',(select id from teams where code='GER'),(select id from teams where code='NED'),'2026-06-28 22:00:00+00','MetLife Stadium, New York'),
(48, 'group','H',(select id from teams where code='NZL'),(select id from teams where code='SEN'),'2026-06-28 22:00:00+00','BC Place, Vancouver');

-- GRUPP I
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(49, 'group','I',(select id from teams where code='ENG'),(select id from teams where code='IRN'),'2026-06-19 21:00:00+00','Lumi Field, Seattle'),
(50, 'group','I',(select id from teams where code='SRB'),(select id from teams where code='CMR'),'2026-06-20 00:00:00+00','Hard Rock Stadium, Miami'),
(51, 'group','I',(select id from teams where code='ENG'),(select id from teams where code='CMR'),'2026-06-24 21:00:00+00','NRG Stadium, Houston'),
(52, 'group','I',(select id from teams where code='IRN'),(select id from teams where code='SRB'),'2026-06-25 00:00:00+00','AT&T Stadium, Dallas'),
(53, 'group','I',(select id from teams where code='ENG'),(select id from teams where code='SRB'),'2026-06-29 22:00:00+00','MetLife Stadium, New York'),
(54, 'group','I',(select id from teams where code='CMR'),(select id from teams where code='IRN'),'2026-06-29 22:00:00+00','Estadio Azteca, Mexico City');

-- GRUPP J
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(55, 'group','J',(select id from teams where code='ITA'),(select id from teams where code='KSA'),'2026-06-20 21:00:00+00','SoFi Stadium, Los Angeles'),
(56, 'group','J',(select id from teams where code='SUI'),(select id from teams where code='EGY'),'2026-06-21 00:00:00+00','Levi''s Stadium, San Jose'),
(57, 'group','J',(select id from teams where code='ITA'),(select id from teams where code='EGY'),'2026-06-25 21:00:00+00','Allegiant Stadium, Las Vegas'),
(58, 'group','J',(select id from teams where code='KSA'),(select id from teams where code='SUI'),'2026-06-26 00:00:00+00','BC Place, Vancouver'),
(59, 'group','J',(select id from teams where code='ITA'),(select id from teams where code='SUI'),'2026-06-30 22:00:00+00','MetLife Stadium, New York'),
(60, 'group','J',(select id from teams where code='EGY'),(select id from teams where code='KSA'),'2026-06-30 22:00:00+00','NRG Stadium, Houston');

-- GRUPP K
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(61, 'group','K',(select id from teams where code='DEN'),(select id from teams where code='TUN'),'2026-06-21 21:00:00+00','Hard Rock Stadium, Miami'),
(62, 'group','K',(select id from teams where code='AUT'),(select id from teams where code='COD'),'2026-06-22 00:00:00+00','Arrowhead Stadium, Kansas City'),
(63, 'group','K',(select id from teams where code='DEN'),(select id from teams where code='COD'),'2026-06-26 21:00:00+00','AT&T Stadium, Dallas'),
(64, 'group','K',(select id from teams where code='TUN'),(select id from teams where code='AUT'),'2026-06-27 00:00:00+00','SoFi Stadium, Los Angeles'),
(65, 'group','K',(select id from teams where code='DEN'),(select id from teams where code='AUT'),'2026-07-01 22:00:00+00','MetLife Stadium, New York'),
(66, 'group','K',(select id from teams where code='COD'),(select id from teams where code='TUN'),'2026-07-01 22:00:00+00','Lumen Field, Seattle');

-- GRUPP L
insert into public.matches (match_number,stage,group_name,home_team_id,away_team_id,kickoff_at,venue) values
(67, 'group','L',(select id from teams where code='TUR'),(select id from teams where code='HON'),'2026-06-22 21:00:00+00','NRG Stadium, Houston'),
(68, 'group','L',(select id from teams where code='UKR'),(select id from teams where code='CIV'),'2026-06-23 00:00:00+00','BC Place, Vancouver'),
(69, 'group','L',(select id from teams where code='TUR'),(select id from teams where code='CIV'),'2026-06-27 21:00:00+00','Allegiant Stadium, Las Vegas'),
(70, 'group','L',(select id from teams where code='HON'),(select id from teams where code='UKR'),'2026-06-28 00:00:00+00','Estadio Azteca, Mexico City'),
(71, 'group','L',(select id from teams where code='TUR'),(select id from teams where code='UKR'),'2026-07-02 22:00:00+00','MetLife Stadium, New York'),
(72, 'group','L',(select id from teams where code='CIV'),(select id from teams where code='HON'),'2026-07-02 22:00:00+00','AT&T Stadium, Dallas');

-- ============================================================
-- SLUTSPEL (32 → Final, lag fylls i av admin efterhand)
-- ============================================================
insert into public.matches (match_number,stage,home_placeholder,away_placeholder,kickoff_at,venue) values
-- Rond 32
(73, 'r32','Vinnare grupp A','3:a plats B/C/D','2026-07-04 19:00:00+00','TBD'),
(74, 'r32','Vinnare grupp C','3:a plats A/B/E','2026-07-04 22:00:00+00','TBD'),
(75, 'r32','Vinnare grupp B','3:a plats C/D/F','2026-07-05 19:00:00+00','TBD'),
(76, 'r32','Vinnare grupp D','3:a plats A/E/G','2026-07-05 22:00:00+00','TBD'),
(77, 'r32','Vinnare grupp E','3:a plats B/F/H','2026-07-06 19:00:00+00','TBD'),
(78, 'r32','Vinnare grupp G','3:a plats C/I/J','2026-07-06 22:00:00+00','TBD'),
(79, 'r32','Vinnare grupp F','3:a plats D/G/K','2026-07-07 19:00:00+00','TBD'),
(80, 'r32','Vinnare grupp H','3:a plats E/F/L','2026-07-07 22:00:00+00','TBD'),
(81, 'r32','Vinnare grupp I','Tvåa grupp J','2026-07-08 19:00:00+00','TBD'),
(82, 'r32','Vinnare grupp K','Tvåa grupp L','2026-07-08 22:00:00+00','TBD'),
(83, 'r32','Vinnare grupp J','Tvåa grupp I','2026-07-09 19:00:00+00','TBD'),
(84, 'r32','Vinnare grupp L','Tvåa grupp K','2026-07-09 22:00:00+00','TBD'),
(85, 'r32','Tvåa grupp A','Tvåa grupp B','2026-07-10 19:00:00+00','TBD'),
(86, 'r32','Tvåa grupp C','Tvåa grupp D','2026-07-10 22:00:00+00','TBD'),
(87, 'r32','Tvåa grupp E','Tvåa grupp F','2026-07-11 19:00:00+00','TBD'),
(88, 'r32','Tvåa grupp G','Tvåa grupp H','2026-07-11 22:00:00+00','TBD'),
-- Åttondelsfinaler
(89, 'r16','Vinnare match 73','Vinnare match 74','2026-07-14 19:00:00+00','TBD'),
(90, 'r16','Vinnare match 75','Vinnare match 76','2026-07-14 22:00:00+00','TBD'),
(91, 'r16','Vinnare match 77','Vinnare match 78','2026-07-15 19:00:00+00','TBD'),
(92, 'r16','Vinnare match 79','Vinnare match 80','2026-07-15 22:00:00+00','TBD'),
(93, 'r16','Vinnare match 81','Vinnare match 82','2026-07-16 19:00:00+00','TBD'),
(94, 'r16','Vinnare match 83','Vinnare match 84','2026-07-16 22:00:00+00','TBD'),
(95, 'r16','Vinnare match 85','Vinnare match 86','2026-07-17 19:00:00+00','TBD'),
(96, 'r16','Vinnare match 87','Vinnare match 88','2026-07-17 22:00:00+00','TBD'),
-- Kvartsfinaler
(97, 'qf','Vinnare match 89','Vinnare match 90','2026-07-22 19:00:00+00','TBD'),
(98, 'qf','Vinnare match 91','Vinnare match 92','2026-07-22 22:00:00+00','TBD'),
(99, 'qf','Vinnare match 93','Vinnare match 94','2026-07-23 19:00:00+00','TBD'),
(100,'qf','Vinnare match 95','Vinnare match 96','2026-07-23 22:00:00+00','TBD'),
-- Semifinaler
(101,'sf','Vinnare match 97','Vinnare match 98','2026-07-26 22:00:00+00','MetLife Stadium, New York'),
(102,'sf','Vinnare match 99','Vinnare match 100','2026-07-27 22:00:00+00','AT&T Stadium, Dallas'),
-- Bronsmatch
(103,'3rd','Förlorare SF1','Förlorare SF2','2026-07-30 19:00:00+00','Hard Rock Stadium, Miami'),
-- Final
(104,'final','Vinnare SF1','Vinnare SF2','2026-08-02 20:00:00+00','MetLife Stadium, New York');
