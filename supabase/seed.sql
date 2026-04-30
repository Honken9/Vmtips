-- ============================================================
-- VM 2026 – Lag (Grupp A–L, 48 lag totalt)
-- OBS: Verifiera mot officiellt schema på fifa.com
-- ============================================================

insert into public.teams (name, code, flag, group_name) values
-- Grupp A
('Argentina', 'ARG', '🇦🇷', 'A'),
('Chile', 'CHI', '🇨🇱', 'A'),
('Peru', 'PER', '🇵🇪', 'A'),
('Canada', 'CAN', '🇨🇦', 'A'),
-- Grupp B
('Mexico', 'MEX', '🇲🇽', 'B'),
('Jamaica', 'JAM', '🇯🇲', 'B'),
('Venezuela', 'VEN', '🇻🇪', 'B'),
('Ecuador', 'ECU', '🇪🇨', 'B'),
-- Grupp C
('USA', 'USA', '🇺🇸', 'C'),
('Panama', 'PAN', '🇵🇦', 'C'),
('Uruguay', 'URU', '🇺🇾', 'C'),
('Bolivia', 'BOL', '🇧🇴', 'C'),
-- Grupp D
('Brazil', 'BRA', '🇧🇷', 'D'),
('Costa Rica', 'CRC', '🇨🇷', 'D'),
('Colombia', 'COL', '🇨🇴', 'D'),
('Paraguay', 'PAR', '🇵🇾', 'D'),
-- Grupp E
('Spain', 'ESP', '🇪🇸', 'E'),
('Croatia', 'CRO', '🇭🇷', 'E'),
('Morocco', 'MAR', '🇲🇦', 'E'),
('Japan', 'JPN', '🇯🇵', 'E'),
-- Grupp F
('Portugal', 'POR', '🇵🇹', 'F'),
('Poland', 'POL', '🇵🇱', 'F'),
('South Korea', 'KOR', '🇰🇷', 'F'),
('Algeria', 'ALG', '🇩🇿', 'F'),
-- Grupp G
('France', 'FRA', '🇫🇷', 'G'),
('Belgium', 'BEL', '🇧🇪', 'G'),
('Australia', 'AUS', '🇦🇺', 'G'),
('Nigeria', 'NGA', '🇳🇬', 'G'),
-- Grupp H
('Germany', 'GER', '🇩🇪', 'H'),
('Netherlands', 'NED', '🇳🇱', 'H'),
('Senegal', 'SEN', '🇸🇳', 'H'),
('New Zealand', 'NZL', '🇳🇿', 'H'),
-- Grupp I
('England', 'ENG', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'I'),
('Serbia', 'SRB', '🇷🇸', 'I'),
('Iran', 'IRN', '🇮🇷', 'I'),
('Cameroon', 'CMR', '🇨🇲', 'I'),
-- Grupp J
('Italy', 'ITA', '🇮🇹', 'J'),
('Switzerland', 'SUI', '🇨🇭', 'J'),
('Egypt', 'EGY', '🇪🇬', 'J'),
('Saudi Arabia', 'KSA', '🇸🇦', 'J'),
-- Grupp K
('Denmark', 'DEN', '🇩🇰', 'K'),
('Austria', 'AUT', '🇦🇹', 'K'),
('Tunisia', 'TUN', '🇹🇳', 'K'),
('DR Congo', 'COD', '🇨🇩', 'K'),
-- Grupp L
('Turkey', 'TUR', '🇹🇷', 'L'),
('Ukraine', 'UKR', '🇺🇦', 'L'),
('Ivory Coast', 'CIV', '🇨🇮', 'L'),
('Honduras', 'HON', '🇭🇳', 'L');

-- ============================================================
-- Gruppspelsmatcher (exempel Grupp A – fyll i resten + KO)
-- Kickoff-tider är approximativa – uppdatera med officiella
-- ============================================================

-- Grupp A (matcher 1–6)
insert into public.matches (match_number, stage, group_name, home_team_id, away_team_id, kickoff_at, venue)
values
(1, 'group', 'A',
  (select id from teams where code='ARG'),
  (select id from teams where code='CAN'),
  '2026-06-12 19:00:00+00', 'MetLife Stadium, New York'),
(2, 'group', 'A',
  (select id from teams where code='CHI'),
  (select id from teams where code='PER'),
  '2026-06-12 22:00:00+00', 'SoFi Stadium, Los Angeles'),
(3, 'group', 'A',
  (select id from teams where code='ARG'),
  (select id from teams where code='PER'),
  '2026-06-17 19:00:00+00', 'AT&T Stadium, Dallas'),
(4, 'group', 'A',
  (select id from teams where code='CAN'),
  (select id from teams where code='CHI'),
  '2026-06-17 22:00:00+00', 'Levi''s Stadium, San Jose'),
(5, 'group', 'A',
  (select id from teams where code='CAN'),
  (select id from teams where code='PER'),
  '2026-06-21 22:00:00+00', 'BC Place, Vancouver'),
(6, 'group', 'A',
  (select id from teams where code='ARG'),
  (select id from teams where code='CHI'),
  '2026-06-21 22:00:00+00', 'Estadio Azteca, Mexico City');

-- Grupp B
insert into public.matches (match_number, stage, group_name, home_team_id, away_team_id, kickoff_at, venue)
values
(7,  'group', 'B', (select id from teams where code='MEX'), (select id from teams where code='ECU'), '2026-06-13 19:00:00+00', 'Estadio Azteca, Mexico City'),
(8,  'group', 'B', (select id from teams where code='JAM'), (select id from teams where code='VEN'), '2026-06-13 22:00:00+00', 'Hard Rock Stadium, Miami'),
(9,  'group', 'B', (select id from teams where code='MEX'), (select id from teams where code='VEN'), '2026-06-18 19:00:00+00', 'Estadio Guadalajara, Guadalajara'),
(10, 'group', 'B', (select id from teams where code='ECU'), (select id from teams where code='JAM'), '2026-06-18 22:00:00+00', 'NRG Stadium, Houston'),
(11, 'group', 'B', (select id from teams where code='ECU'), (select id from teams where code='VEN'), '2026-06-22 22:00:00+00', 'Allegiant Stadium, Las Vegas'),
(12, 'group', 'B', (select id from teams where code='MEX'), (select id from teams where code='JAM'), '2026-06-22 22:00:00+00', 'Estadio Azteca, Mexico City');

-- Grupp C
insert into public.matches (match_number, stage, group_name, home_team_id, away_team_id, kickoff_at, venue)
values
(13, 'group', 'C', (select id from teams where code='USA'), (select id from teams where code='BOL'), '2026-06-14 19:00:00+00', 'SoFi Stadium, Los Angeles'),
(14, 'group', 'C', (select id from teams where code='PAN'), (select id from teams where code='URU'), '2026-06-14 22:00:00+00', 'Hard Rock Stadium, Miami'),
(15, 'group', 'C', (select id from teams where code='USA'), (select id from teams where code='URU'), '2026-06-19 19:00:00+00', 'MetLife Stadium, New York'),
(16, 'group', 'C', (select id from teams where code='BOL'), (select id from teams where code='PAN'), '2026-06-19 22:00:00+00', 'AT&T Stadium, Dallas'),
(17, 'group', 'C', (select id from teams where code='BOL'), (select id from teams where code='URU'), '2026-06-23 22:00:00+00', 'Lumen Field, Seattle'),
(18, 'group', 'C', (select id from teams where code='USA'), (select id from teams where code='PAN'), '2026-06-23 22:00:00+00', 'Arrowhead Stadium, Kansas City');

-- Grupp D–L: lägg till på samma sätt (förkortat här för tydlighet)
-- Använd admin-gränssnittet för att lägga till fler matcher, eller kör ett fullständigt seed-skript.

-- ============================================================
-- Slutspelsmatcher (utan lag – de fylls i av admin)
-- ============================================================
insert into public.matches (match_number, stage, home_placeholder, away_placeholder, kickoff_at, venue)
values
-- Rond 32 (16 matcher)
(49,  'r32', 'Vinnare grupp A', '3:a plats (B/C/D)', '2026-07-04 19:00:00+00', 'TBD'),
(50,  'r32', 'Vinnare grupp C', '3:a plats (A/B/E)', '2026-07-04 22:00:00+00', 'TBD'),
(51,  'r32', 'Vinnare grupp B', '3:a plats (C/D/F)', '2026-07-05 19:00:00+00', 'TBD'),
(52,  'r32', 'Vinnare grupp D', '3:a plats (A/E/G)', '2026-07-05 22:00:00+00', 'TBD'),
(53,  'r32', 'Vinnare grupp E', '3:a plats (B/F/H)', '2026-07-06 19:00:00+00', 'TBD'),
(54,  'r32', 'Vinnare grupp G', '3:a plats (C/I/J)', '2026-07-06 22:00:00+00', 'TBD'),
(55,  'r32', 'Vinnare grupp F', '3:a plats (D/G/K)', '2026-07-07 19:00:00+00', 'TBD'),
(56,  'r32', 'Vinnare grupp H', '3:a plats (E/F/L)', '2026-07-07 22:00:00+00', 'TBD'),
(57,  'r32', 'Vinnare grupp I', 'Tvåa grupp J',     '2026-07-08 19:00:00+00', 'TBD'),
(58,  'r32', 'Vinnare grupp K', 'Tvåa grupp L',     '2026-07-08 22:00:00+00', 'TBD'),
(59,  'r32', 'Vinnare grupp J', 'Tvåa grupp I',     '2026-07-09 19:00:00+00', 'TBD'),
(60,  'r32', 'Vinnare grupp L', 'Tvåa grupp K',     '2026-07-09 22:00:00+00', 'TBD'),
(61,  'r32', 'Tvåa grupp A',    'Tvåa grupp B',     '2026-07-10 19:00:00+00', 'TBD'),
(62,  'r32', 'Tvåa grupp C',    'Tvåa grupp D',     '2026-07-10 22:00:00+00', 'TBD'),
(63,  'r32', 'Tvåa grupp E',    'Tvåa grupp F',     '2026-07-11 19:00:00+00', 'TBD'),
(64,  'r32', 'Tvåa grupp G',    'Tvåa grupp H',     '2026-07-11 22:00:00+00', 'TBD'),
-- Åttondelsfinaler (8 matcher)
(65, 'r16', 'Vinnare M49', 'Vinnare M50', '2026-07-14 19:00:00+00', 'TBD'),
(66, 'r16', 'Vinnare M51', 'Vinnare M52', '2026-07-14 22:00:00+00', 'TBD'),
(67, 'r16', 'Vinnare M53', 'Vinnare M54', '2026-07-15 19:00:00+00', 'TBD'),
(68, 'r16', 'Vinnare M55', 'Vinnare M56', '2026-07-15 22:00:00+00', 'TBD'),
(69, 'r16', 'Vinnare M57', 'Vinnare M58', '2026-07-16 19:00:00+00', 'TBD'),
(70, 'r16', 'Vinnare M59', 'Vinnare M60', '2026-07-16 22:00:00+00', 'TBD'),
(71, 'r16', 'Vinnare M61', 'Vinnare M62', '2026-07-17 19:00:00+00', 'TBD'),
(72, 'r16', 'Vinnare M63', 'Vinnare M64', '2026-07-17 22:00:00+00', 'TBD'),
-- Kvartsfinaler (4 matcher)
(73, 'qf', 'Vinnare M65', 'Vinnare M66', '2026-07-22 19:00:00+00', 'TBD'),
(74, 'qf', 'Vinnare M67', 'Vinnare M68', '2026-07-22 22:00:00+00', 'TBD'),
(75, 'qf', 'Vinnare M69', 'Vinnare M70', '2026-07-23 19:00:00+00', 'TBD'),
(76, 'qf', 'Vinnare M71', 'Vinnare M72', '2026-07-23 22:00:00+00', 'TBD'),
-- Semifinaler (2 matcher)
(77, 'sf', 'Vinnare M73', 'Vinnare M74', '2026-07-26 22:00:00+00', 'MetLife Stadium, New York'),
(78, 'sf', 'Vinnare M75', 'Vinnare M76', '2026-07-27 22:00:00+00', 'AT&T Stadium, Dallas'),
-- Bronsmatch
(79, '3rd', 'Förlorare M77', 'Förlorare M78', '2026-07-30 19:00:00+00', 'Hard Rock Stadium, Miami'),
-- Final
(80, 'final', 'Vinnare M77', 'Vinnare M78', '2026-08-02 20:00:00+00', 'MetLife Stadium, New York');
