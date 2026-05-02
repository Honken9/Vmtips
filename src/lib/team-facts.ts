// Hardcodade fakta per FIFA-kod. Visar 1–4 punkter per land, hellre lite
// än fel. Fokus på de 48 lagen som är med i VM 2026.

export interface TeamFacts {
  worldCupTitles?: number
  worldCupYears?: number[]
  bestResult?: string
  nickname?: string
  facts?: string[]
}

export const TEAM_FACTS: Record<string, TeamFacts> = {
  // ─── Grupp A ─────────────────────────────────────────────────
  MEX: {
    bestResult: 'Kvartsfinal 1970, 1986',
    nickname: 'El Tri',
    facts: [
      'Det enda landet som varit värd för VM tre gånger (1970, 1986, 2026).',
      '8 raka åttondelsfinaler 1994–2018 – men aldrig kommit längre.',
      'Estadio Azteca (Mexico City) blir första arenan att stå värd för VM-final tre gånger.',
    ],
  },
  RSA: {
    bestResult: 'Värdland 2010 (gruppspel)',
    nickname: 'Bafana Bafana',
    facts: [
      'Värd för VM 2010 – första VM på afrikansk mark.',
      'Det enda värdlandet som någonsin åkt ut redan i gruppspelet (2010).',
      'Vuvuzelan blev hela världens ljudkuliss tack vare Sydafrikas VM 2010.',
    ],
  },
  KOR: {
    bestResult: 'Fyra 2002',
    nickname: 'Taegeuk Warriors',
    facts: [
      'Värdland 2002 (med Japan) – kom på fjärde plats efter att ha slagit Italien och Spanien.',
      'Son Heung-min är en av Asiens största fotbollsstjärnor genom tiderna.',
      'Vann brons i OS 2012 – herrlandslagets enda OS-medalj.',
    ],
  },
  CZE: {
    bestResult: 'Final EM 1996; trea VM 1934, 1962 (som Tjeckoslovakien)',
    facts: [
      'Som Tjeckoslovakien tog man brons i två VM (1934, 1962).',
      'Som självständigt Tjeckien gick man till EM-final 1996.',
      'Pavel Nedvěd vann Ballon d\'Or 2003.',
    ],
  },

  // ─── Grupp B ─────────────────────────────────────────────────
  CAN: {
    bestResult: 'Gruppspel 1986, 2022, 2026',
    nickname: 'Les Rouges',
    facts: [
      'Värdland tillsammans med USA och Mexiko 2026.',
      'Innan 2022 var enda VM-deltagandet 1986 – då utan att göra ett enda mål.',
      'Alphonso Davies (Bayern München) är landets största stjärna.',
    ],
  },
  BIH: {
    bestResult: 'Gruppspel 2014',
    nickname: 'Zmajevi (Drakarna)',
    facts: [
      'Andra VM-slutspelet någonsin – debuterade 2014 i Brasilien.',
      'Edin Džeko är genom tiderna meste målskytt.',
    ],
  },
  QAT: {
    bestResult: 'Gruppspel 2022',
    nickname: 'Al-Annabi',
    facts: [
      'Värdland 2022 – det första VM som spelats på vintern (november–december).',
      'Vann Asian Cup 2019 och 2023 i rad.',
      'Enda värdlandet att förlora alla tre gruppspelsmatcher (2022).',
    ],
  },
  SUI: {
    bestResult: 'Kvartsfinal 1934, 1938, 1954',
    nickname: 'Nati',
    facts: [
      'Spelar i 11 raka stora mästerskap sedan 2004 – imponerande för ett litet land.',
      'Slog Frankrike (regerande världsmästare) i åttondelen i EM 2020.',
      'Hemma för FIFA:s huvudkontor i Zürich.',
    ],
  },

  // ─── Grupp C ─────────────────────────────────────────────────
  BRA: {
    worldCupTitles: 5,
    worldCupYears: [1958, 1962, 1970, 1994, 2002],
    nickname: 'Seleção',
    facts: [
      'Enda landet som varit med i samtliga VM-slutspel sedan 1930.',
      'Pelé är den enda spelaren som vunnit VM tre gånger (1958, 1962, 1970).',
      'Brasilien har spelat fler VM-matcher än något annat land.',
      'Förlorade hemma-semifinalen 2014 mot Tyskland med 1–7 – en historisk chock.',
    ],
  },
  MAR: {
    bestResult: 'Fyra 2022',
    nickname: 'Lejonen från Atlas',
    facts: [
      'Första afrikanska/arabiska landet att nå en VM-semifinal (2022).',
      'Slog ut Spanien och Portugal i slutspelet 2022 utan att släppa in mål från motståndaren.',
      'Hakim Ziyech och Achraf Hakimi är de stora stjärnorna.',
    ],
  },
  HAI: {
    bestResult: 'Gruppspel 1974',
    nickname: 'Les Grenadiers',
    facts: [
      'Andra VM-slutspelet någonsin – senast 1974.',
      'Emmanuel Sanon gjorde landets enda VM-mål 1974, mot legenden Dino Zoff i Italien.',
    ],
  },
  SCO: {
    bestResult: 'Gruppspel (8 deltaganden, aldrig vidare)',
    nickname: 'Tartan Army',
    facts: [
      'Skottland har aldrig avancerat från ett VM-gruppspel trots åtta deltaganden.',
      'Ett av världens äldsta landslag – spelade världens första landskamp (1872 mot England).',
      'Hampden Park är hemmaplan – en av Storbritanniens mest historiska arenor.',
    ],
  },

  // ─── Grupp D ─────────────────────────────────────────────────
  USA: {
    bestResult: 'Trea 1930',
    nickname: 'USMNT',
    facts: [
      'Värdland tillsammans med Mexiko och Kanada för VM 2026.',
      'Sensationsegerade 1–0 mot England i VM 1950 – en av VM-historiens största skrällar.',
      'Tog tredje plats i det allra första VM 1930.',
      'Major League Soccer (MLS) är ligan där bland andra Messi spelar nu.',
    ],
  },
  PAR: {
    bestResult: 'Kvartsfinal 2010',
    nickname: 'La Albirroja',
    facts: [
      'José Luis Chilavert var en målvakt som gjorde över 60 mål i karriären – många från frisparkar och straffar.',
      'Slog ut Japan på straffar i åttondelen 2010.',
    ],
  },
  AUS: {
    bestResult: 'Åttondelsfinal 2006, 2022',
    nickname: 'Socceroos',
    facts: [
      'Bytte från Oceaniens till Asiens fotbollsförbund 2006.',
      'Tim Cahill är genom tiderna meste målskytt.',
      'Tim Cahills cykelspark mot Nederländerna 2014 är ett av VM:s vackraste mål.',
    ],
  },
  TUR: {
    bestResult: 'Trea 2002',
    nickname: 'Ay-Yıldızlılar (Mån-stjärnorna)',
    facts: [
      'Tog brons i VM 2002 – endast tredje VM någonsin för landet.',
      'Hakan Şükür satte VM:s snabbaste mål – 11 sekunder i bronsmatchen 2002.',
      'Hatayspor och Galatasaray är två av landets största klubbar.',
    ],
  },

  // ─── Grupp E ─────────────────────────────────────────────────
  GER: {
    worldCupTitles: 4,
    worldCupYears: [1954, 1974, 1990, 2014],
    nickname: 'Die Mannschaft',
    facts: [
      '"Miracle of Bern" 1954 – Tysklands första VM-titel mot favoriterna Ungern.',
      '7–1 mot Brasilien i semifinalen 2014, en av VM-historiens mest chockerande matcher.',
      'Miroslav Klose är VM:s genom tiderna meste målskytt med 16 mål.',
      'Bayern München har vunnit Champions League 6 gånger.',
    ],
  },
  CUW: {
    bestResult: 'Första VM 2026',
    nickname: 'Familia Kòrsou',
    facts: [
      'Första VM-slutspelet någonsin – minsta nation (befolkningsmässigt) någonsin i VM.',
      'Karibisk ö med ca 150 000 invånare – jämför Sveriges 10 miljoner.',
      'Tidigare en del av Nederländska Antillerna; spelar nu under egen flagga.',
    ],
  },
  CIV: {
    bestResult: 'Gruppspel 2006, 2010, 2014',
    nickname: 'Les Éléphants',
    facts: [
      'Didier Drogba är en av Afrikas största fotbollsstjärnor genom tiderna.',
      'Vann Africa Cup of Nations 2015 och 2023 (på hemmaplan).',
      '"Drogbas vapenvila" 2005 – när hans tal efter VM-kvalet sägs ha bidragit till slutet på inbördeskriget.',
    ],
  },
  ECU: {
    bestResult: 'Åttondelsfinal 2006',
    nickname: 'La Tri',
    facts: [
      'Spelar sina hemmamatcher i Quito på 2 850 meters höjd – tufft för bortalag.',
      'Antonio Valencia (ex-Manchester United) är en av landets mest kända spelare.',
    ],
  },

  // ─── Grupp F ─────────────────────────────────────────────────
  NED: {
    worldCupTitles: 0,
    bestResult: 'Final 1974, 1978, 2010',
    nickname: 'Oranje',
    facts: [
      'Tre VM-finaler men aldrig vunnit – det evigt nära.',
      '"Total Football" på 70-talet med Johan Cruyff revolutionerade taktiken.',
      'Vann EM 1988 i Tyskland – enda mästerskapstiteln.',
      'Klassiska bittra rivalen är Tyskland.',
    ],
  },
  JPN: {
    bestResult: 'Åttondelsfinal flera gånger',
    nickname: 'Samurai Blue',
    facts: [
      'Slog både Tyskland och Spanien i gruppspelet 2022 – sensation.',
      'Värd 2002 (tillsammans med Sydkorea).',
      'Japanska supportrarna känns igen för att städa upp läktarna efter matcherna.',
    ],
  },
  SWE: {
    bestResult: 'Tvåa 1958',
    nickname: 'Blågult',
    facts: [
      'Tvåa i hemma-VM 1958 – förlorade finalen mot Brasilien (Peles första VM).',
      'Trea i VM 1994 i USA med Brolin, Dahlin, Ravelli.',
      'Henrik Larsson, Zlatan Ibrahimović och Gunnar Nordahl är legendariska målskyttar.',
      'Allsvenskan är en av världens äldsta fotbollsligor – grundad 1924.',
    ],
  },
  TUN: {
    bestResult: 'Gruppspel (6 deltaganden)',
    nickname: 'Eagles of Carthage',
    facts: [
      'Första afrikanska landet att vinna en VM-match (mot Mexiko 1978).',
      'Slog Frankrike 1–0 i gruppspelet 2022 – men åkte ändå ut.',
    ],
  },

  // ─── Grupp G ─────────────────────────────────────────────────
  BEL: {
    worldCupTitles: 0,
    bestResult: 'Trea 2018',
    nickname: 'De Rode Duivels (Röda djävlarna)',
    facts: [
      'Tog brons i VM 2018 efter att ha slagit Brasilien i kvarten.',
      '"Den gyllene generationen" med De Bruyne, Lukaku och Hazard rankades som världsetta i flera år.',
      'Eden Hazards bror Thorgan har också spelat i landslaget.',
    ],
  },
  EGY: {
    bestResult: 'Gruppspel 1934, 1990, 2018',
    nickname: 'Faraonerna',
    facts: [
      'Mest framgångsrika afrikanska landet på Africa Cup of Nations (7 titlar).',
      'Mohamed Salah är genom tiderna meste landslagsmålskytt.',
      'Första afrikanska land att kvala in till VM (1934).',
    ],
  },
  IRN: {
    bestResult: 'Gruppspel (6 deltaganden)',
    nickname: 'Team Melli',
    facts: [
      'Aldrig avancerat från VM-gruppspelet trots flera deltaganden.',
      'Slog ut Wales i VM 2022 med två mål på övertid.',
      'Carlos Queiroz har varit förbundskapten i två omgångar.',
    ],
  },
  NZL: {
    bestResult: 'Gruppspel 1982, 2010, 2026',
    nickname: 'All Whites',
    facts: [
      'Endast lag obesegrat i VM 2010 – tre oavgjorda i gruppspelet.',
      'Andra VM-slutspelet på 16 år (efter 2010).',
      'Rugby är klart populärare än fotboll – men All Whites växer.',
    ],
  },

  // ─── Grupp H ─────────────────────────────────────────────────
  ESP: {
    worldCupTitles: 1,
    worldCupYears: [2010],
    nickname: 'La Roja (La Furia Roja)',
    facts: [
      'Vann VM 2010 i Sydafrika med Andrés Iniestas mål i förlängningen mot Nederländerna.',
      'Vann tre raka stora titlar 2008–2012: EM, VM, EM – den s.k. "tiki-taka"-eran.',
      'La Liga är en av världens starkaste ligor – Real Madrid och Barcelona är globalt största klubbar.',
    ],
  },
  CPV: {
    bestResult: 'Första VM 2026',
    nickname: 'Tubarões Azuis (Blå hajar)',
    facts: [
      'Första VM-slutspelet någonsin för Kap Verde 2026.',
      'En av de minsta nationer någonsin (~600 000 invånare) att kvala in till ett VM.',
      'Kap Verde är ett portugisisktalande örike utanför Västafrika.',
    ],
  },
  KSA: {
    bestResult: 'Åttondelsfinal 1994',
    nickname: 'Saudi Falcons',
    facts: [
      'Slog Argentina sensationellt 2–1 i öppningsmatchen i VM 2022.',
      'Saeed Al-Owairans drömmål mot Belgien i VM 1994 räknas som en av VM:s vackraste klassiker.',
      'Hemma för Cristiano Ronaldo (i klubblaget Al-Nassr).',
    ],
  },
  URU: {
    worldCupTitles: 2,
    worldCupYears: [1930, 1950],
    nickname: 'La Celeste',
    facts: [
      'Vann det allra första VM 1930 (värdland) och 1950.',
      '"Maracanazo" 1950 – Uruguay slog Brasilien i finalen på Maracanã.',
      'Suárez, Forlán och Cavani har gjort Uruguay till en modern VM-fasthet trots befolkning på bara 3,4 miljoner.',
    ],
  },

  // ─── Grupp I ─────────────────────────────────────────────────
  FRA: {
    worldCupTitles: 2,
    worldCupYears: [1998, 2018],
    nickname: 'Les Bleus',
    facts: [
      'Vann VM på hemmaplan 1998 mot Brasilien (3–0).',
      'Just Fontaine satte 13 mål i VM 1958 – ett rekord som fortfarande står sig.',
      'Förlorade VM-finalen 2022 mot Argentina på straffar.',
      'Kylian Mbappé blev tredje spelaren genom tiderna att göra hat-trick i en VM-final (2022).',
    ],
  },
  SEN: {
    bestResult: 'Kvartsfinal 2002',
    nickname: 'Lions of Teranga',
    facts: [
      'Slog regerande mästaren Frankrike i öppningsmatchen i VM 2002.',
      'Sadio Mané är genom tiderna meste landslagsmålskytt.',
      'Vann sin första Africa Cup of Nations 2021 (på straffar mot Egypten).',
    ],
  },
  IRQ: {
    bestResult: 'Gruppspel 1986',
    nickname: 'Mesopotamiens lejon',
    facts: [
      'Vann Asian Cup 2007 mitt under Irakkriget – en av sportens mest gripande titlar.',
      'Spelade hemma-kvalmatcher utomlands i många år p.g.a. kriget.',
    ],
  },
  NOR: {
    bestResult: 'Åttondelsfinal 1998',
    nickname: 'Drillos',
    facts: [
      'Erling Haaland (Manchester City) leder Norge i deras första VM sedan 1998.',
      'Slog Brasilien både i VM 1998 och OS 2000 – tradition av att fixa skrällar mot stora lag.',
      'Martin Ødegaard (Arsenal) är lagkapten.',
    ],
  },

  // ─── Grupp J ─────────────────────────────────────────────────
  ARG: {
    worldCupTitles: 3,
    worldCupYears: [1978, 1986, 2022],
    nickname: 'La Albiceleste',
    facts: [
      'Lionel Messi vann Golden Ball både i VM 2014 och VM 2022.',
      'Diego Maradonas "Hand of God"-mål mot England 1986 är ett av VM:s mest omtalade.',
      'Argentina var värdland 1978 och vann turneringen.',
      'VM 2022-finalen mot Frankrike ses ofta som "VM-historiens bästa final".',
    ],
  },
  ALG: {
    bestResult: 'Åttondelsfinal 2014',
    nickname: 'Les Fennecs (Ökenrävarna)',
    facts: [
      'Slog Västtyskland 2–1 i VM-debuten 1982 – en av VM:s största skrällar.',
      'Riyad Mahrez (City, Al-Ahli) är landets största stjärna.',
      'Vann Africa Cup of Nations 2019.',
    ],
  },
  AUT: {
    bestResult: 'Trea 1954',
    nickname: 'Burschenwirt-elvan',
    facts: [
      'Tog brons i VM 1954.',
      'Trots starka traditioner missade man VM från 1998 ända till 2026.',
      'David Alaba (Real Madrid) är genom tiderna mest framgångsrika spelaren.',
    ],
  },
  JOR: {
    bestResult: 'Första VM 2026',
    nickname: 'Al-Nashama',
    facts: [
      'Första VM-slutspelet någonsin för Jordanien 2026.',
      'Tog överraskande silver i Asian Cup 2024 efter att ha slagit Sydkorea i semin.',
    ],
  },

  // ─── Grupp K ─────────────────────────────────────────────────
  POR: {
    bestResult: 'Trea 1966',
    nickname: 'A Seleção das Quinas',
    facts: [
      'Cristiano Ronaldo är genom tiderna meste målskytt i landslag (män) – över 130 mål.',
      'Vann EM 2016 i Frankrike – första stora titeln.',
      'Eusébio satte 9 mål i VM 1966 och tog Portugal till bronset.',
      'Vann Nations League 2019 och 2025.',
    ],
  },
  COD: {
    bestResult: 'Gruppspel 1974',
    nickname: 'Léopards',
    facts: [
      'Som Zaire blev de 1974 första subsahariska landet i VM.',
      'Förlorade dock 0–9 mot Jugoslavien 1974 – fortfarande VM:s största förlust.',
      'Vann Africa Cup of Nations 1968 och 1974.',
    ],
  },
  UZB: {
    bestResult: 'Första VM 2026',
    nickname: 'Vita vargarna',
    facts: [
      'Första VM-slutspelet någonsin för Uzbekistan 2026.',
      'Spelade tidigare i Sovjetunionens landslag fram till 1991.',
      'Ung trupp – flera spelare i ryska Premier League.',
    ],
  },
  COL: {
    bestResult: 'Kvartsfinal 2014',
    nickname: 'Los Cafeteros',
    facts: [
      'James Rodríguez vann Golden Boot 2014 med 6 mål.',
      'Carlos Valderramas blonda "afro" är en av fotbollshistoriens mest ikoniska bilder.',
      'René Higuita uppfann "skorpionsparken" i en match mot England 1995.',
    ],
  },

  // ─── Grupp L ─────────────────────────────────────────────────
  ENG: {
    worldCupTitles: 1,
    worldCupYears: [1966],
    nickname: 'Three Lions',
    facts: [
      'Vann VM på hemmaplan 1966 mot Västtyskland (4–2 efter förlängning).',
      'Bobby Moore lyfte trofén – fortfarande Englands enda VM-titel.',
      '"It\'s coming home" – sången från EM 1996 har blivit ett mantra.',
      'Förlorade EM-finalerna 2020 och 2024 – väntar på första titeln på 60 år.',
    ],
  },
  CRO: {
    worldCupTitles: 0,
    bestResult: 'Final 2018; Trea 1998 och 2022',
    nickname: 'Vatreni (De Eldiga)',
    facts: [
      'Förlorade VM-finalen 2018 mot Frankrike (4–2).',
      'Med 4 miljoner invånare ett av de minsta länderna att nå en VM-final.',
      'Luka Modrić vann Ballon d\'Or 2018 efter VM-finalen.',
    ],
  },
  GHA: {
    bestResult: 'Kvartsfinal 2010',
    nickname: 'Black Stars',
    facts: [
      'Asamoah Gyan missade en straff på övertid mot Uruguay i kvartsfinalen 2010 – nära Afrikas första semifinal.',
      'Bröderna Ayew (Jordan, Andre, Rahim) har alla spelat i landslaget.',
    ],
  },
  PAN: {
    bestResult: 'Gruppspel 2018',
    nickname: 'La Marea Roja',
    facts: [
      'Andra VM-slutspelet någonsin – det första var 2018.',
      'I VM 2018 fick Felipe Baloy (37 år) gjort landets allra första VM-mål.',
    ],
  },

  // ─── Övriga relevanta lag (om databasen byts/utökas) ──────────
  ITA: {
    worldCupTitles: 4,
    worldCupYears: [1934, 1938, 1982, 2006],
    nickname: 'Gli Azzurri',
    facts: [
      'Italien missade VM 2018 och 2022 trots fyra titlar.',
      'Vann VM 1934 och 1938 i rad – det enda landet att försvara titeln på den tiden.',
      'Vann EM 2020 (spelat 2021) på straffar mot England.',
    ],
  },
  POL: {
    bestResult: 'Trea 1974, 1982',
    nickname: 'Orły (Örnarna)',
    facts: [
      'Tog brons i två VM (1974, 1982) – guldåren under 70- och 80-talen.',
      'Robert Lewandowski är en av världens bästa anfallare och landets meste målskytt.',
    ],
  },
  CHI: {
    bestResult: 'Trea 1962',
    nickname: 'La Roja',
    facts: [
      'Vann Copa América 2015 och 2016 i rad – på straffar båda gångerna mot Argentina.',
      'Tog brons i VM 1962 (på hemmaplan).',
    ],
  },
  CMR: {
    bestResult: 'Kvartsfinal 1990',
    nickname: 'Indomitable Lions',
    facts: [
      'Roger Millas dans 1990 är en av VM:s mest ikoniska bilder.',
      'Slog både regerande mästaren Argentina 1990 och Brasilien 2022 – tradition av att skrälla.',
    ],
  },
  NGA: {
    bestResult: 'Åttondelsfinal flera gånger',
    nickname: 'Super Eagles',
    facts: [
      'Vann OS-guld 1996 i Atlanta – ett av Afrikas största fotbollsögonblick.',
      'Tre Africa Cup of Nations-titlar.',
    ],
  },
  DEN: {
    bestResult: 'Kvartsfinal 1998',
    nickname: 'Danish Dynamite',
    facts: [
      'Vann EM 1992 trots att de inte ens var kvalificerade ursprungligen – Jugoslavien uteslöts pga kriget.',
      'Christian Eriksens hjärtstillestånd i EM 2020 chockade hela världen – han spelar igen idag.',
    ],
  },
  PER: {
    bestResult: 'Kvartsfinal 1970, 1978',
    nickname: 'La Bicolor',
    facts: [
      'Två kvartsfinaler i VM under 70-talet.',
      'Teófilo Cubillas är en av Sydamerikas legender.',
    ],
  },
  BOL: {
    bestResult: 'Gruppspel 1994',
    facts: [
      'Spelar hemmamatcher i La Paz på 3 600 meters höjd – mardröm för bortalagen.',
    ],
  },
  VEN: {
    bestResult: 'Första VM 2026',
    nickname: 'La Vinotinto',
    facts: [
      'Första VM-slutspelet någonsin för Venezuela 2026.',
      'Tog flera år av kvalkampanjer innan kvalet äntligen lyckades.',
    ],
  },
  JAM: {
    bestResult: 'Gruppspel 1998',
    nickname: 'Reggae Boyz',
    facts: [
      'Soundtracket "Rise Up" 1998 är fortfarande en hejaramsa.',
    ],
  },
  CRC: {
    bestResult: 'Kvartsfinal 2014',
    nickname: 'Los Ticos',
    facts: [
      'Slog ut England, Italien och Uruguay i gruppspelet 2014 – en av VM:s största gruppspelsskrällar.',
      'Keylor Navas är genom tiderna största stjärnan.',
    ],
  },
  HON: {
    bestResult: 'Gruppspel 1982, 2010, 2014',
    nickname: 'Los Catrachos',
  },
  UKR: {
    bestResult: 'Kvartsfinal 2006',
    nickname: 'Zbirna',
    facts: [
      'Andriy Shevchenko vann Ballon d\'Or 2004 – en av östra Europas största stjärnor genom tiderna.',
    ],
  },
}

export function getFacts(fifaCode: string): TeamFacts | null {
  return TEAM_FACTS[fifaCode.toUpperCase()] ?? null
}
