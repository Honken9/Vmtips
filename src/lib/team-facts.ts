// Hardcodade fakta per FIFA-kod. Visar 1–4 punkter per land, hellre lite
// än fel. Fyll på med fler länder vid behov.

export interface TeamFacts {
  worldCupTitles?: number
  worldCupYears?: number[]
  bestResult?: string
  nickname?: string
  facts?: string[]
}

export const TEAM_FACTS: Record<string, TeamFacts> = {
  ARG: {
    worldCupTitles: 3,
    worldCupYears: [1978, 1986, 2022],
    nickname: 'La Albiceleste',
    facts: [
      'Lionel Messi vann Golden Ball både i VM 2014 och VM 2022.',
      'Diego Maradonas "Hand of God"-mål mot England 1986 är ett av VM:s mest omtalade.',
      'Argentina var värdland 1978 och vann turneringen.',
    ],
  },
  BRA: {
    worldCupTitles: 5,
    worldCupYears: [1958, 1962, 1970, 1994, 2002],
    nickname: 'Seleção',
    facts: [
      'Enda landet som varit med i samtliga VM-slutspel.',
      'Pelé är den enda spelaren som vunnit VM tre gånger (1958, 1962, 1970).',
      'Brasilien har spelat fler VM-matcher än något annat land.',
    ],
  },
  GER: {
    worldCupTitles: 4,
    worldCupYears: [1954, 1974, 1990, 2014],
    nickname: 'Die Mannschaft',
    facts: [
      '"Miracle of Bern" 1954 — Tysklands första VM-titel mot favoriterna Ungern.',
      '7–1 mot Brasilien i semifinalen 2014, en av VM-historiens mest chockerande matcher.',
      'Miroslav Klose är VM:s genom tiderna meste målskytt med 16 mål.',
    ],
  },
  ITA: {
    worldCupTitles: 4,
    worldCupYears: [1934, 1938, 1982, 2006],
    nickname: 'Gli Azzurri',
    facts: [
      'Italien missade VM 2018 och 2022 trots fyra titlar.',
      'Vann VM 1934 och 1938 – det enda landet att försvara titeln på den tiden (innan Brasilien).',
    ],
  },
  FRA: {
    worldCupTitles: 2,
    worldCupYears: [1998, 2018],
    nickname: 'Les Bleus',
    facts: [
      'Vann VM på hemmaplan 1998 mot Brasilien (3–0).',
      'Just Fontaine satte 13 mål i VM 1958 — ett rekord som fortfarande står sig.',
    ],
  },
  ESP: {
    worldCupTitles: 1,
    worldCupYears: [2010],
    nickname: 'La Roja',
    facts: [
      'Vann VM 2010 i Sydafrika med Andrés Iniestas mål i förlängningen mot Nederländerna.',
      'Ofta hyllat för "tiki-taka"-spelet under guldåren 2008–2012.',
    ],
  },
  ENG: {
    worldCupTitles: 1,
    worldCupYears: [1966],
    nickname: 'Three Lions',
    facts: [
      'Vann VM på hemmaplan 1966 mot Västtyskland (4–2 efter förlängning).',
      'Bobby Moore lyfte trofén – fortfarande Englands enda VM-titel.',
    ],
  },
  URU: {
    worldCupTitles: 2,
    worldCupYears: [1930, 1950],
    nickname: 'La Celeste',
    facts: [
      'Vann det allra första VM 1930 (värdland).',
      '"Maracanazo" 1950 — Uruguay slog Brasilien i finalen på Maracanã.',
    ],
  },
  NED: {
    worldCupTitles: 0,
    bestResult: 'Final 1974, 1978, 2010',
    nickname: 'Oranje',
    facts: [
      'Tre VM-finaler men aldrig vunnit – det evigt nära.',
      '"Total Football" på 70-talet med Johan Cruyff revolutionerade taktiken.',
    ],
  },
  POR: {
    worldCupTitles: 0,
    bestResult: 'Trea 1966',
    facts: [
      'Cristiano Ronaldo är genom tiderna meste målskytt i landslag (män).',
      'Vann EM 2016 i Frankrike – första stora titeln.',
    ],
  },
  CRO: {
    worldCupTitles: 0,
    bestResult: 'Final 2018, Trea 2022, Trea 1998',
    nickname: 'Vatreni',
    facts: [
      'Förlorade VM-finalen 2018 mot Frankrike (4–2).',
      'Med 4 miljoner invånare ett av de minsta länderna att nå en VM-final.',
    ],
  },
  BEL: {
    worldCupTitles: 0,
    bestResult: 'Trea 2018',
    nickname: 'De Rode Duivels',
    facts: ['Tog brons i VM 2018 efter att ha slagit Brasilien i kvarten.'],
  },
  USA: {
    worldCupTitles: 0,
    bestResult: 'Trea 1930',
    facts: [
      'Värdland tillsammans med Mexiko och Kanada för VM 2026.',
      'Sensationsegerade 1–0 mot England i VM 1950.',
    ],
  },
  MEX: {
    bestResult: 'Kvartsfinal 1970, 1986',
    nickname: 'El Tri',
    facts: [
      'Det enda landet som varit värd för VM tre gånger (1970, 1986, 2026).',
      '8 raka åttondelsfinaler 1994–2018.',
    ],
  },
  CAN: {
    bestResult: 'Gruppspel 1986, 2022, 2026',
    facts: [
      'Värdland tillsammans med USA och Mexiko 2026.',
      'Bara tredje VM-slutspelet någonsin.',
    ],
  },
  JPN: {
    bestResult: 'Åttondelsfinal flera gånger',
    nickname: 'Samurai Blue',
    facts: ['Slog både Tyskland och Spanien i gruppspelet 2022.'],
  },
  KOR: {
    bestResult: 'Fyra 2002',
    facts: ['Värdland 2002 tillsammans med Japan, kom på fjärde plats.'],
  },
  AUS: {
    bestResult: 'Åttondelsfinal 2006, 2022',
    nickname: 'Socceroos',
  },
  NZL: {
    facts: ['Endast lag obesegrat i VM 2010 – tre oavgjorda i gruppspelet.'],
  },
  MAR: {
    bestResult: 'Fyra 2022',
    facts: ['Första afrikanska/arabiska landet att nå en VM-semifinal (2022).'],
  },
  SEN: {
    bestResult: 'Kvartsfinal 2002',
    nickname: 'Lions of Teranga',
  },
  CMR: {
    bestResult: 'Kvartsfinal 1990',
    nickname: 'Indomitable Lions',
    facts: ['Roger Millas dansar 1990 är en av VM:s mest ikoniska bilder.'],
  },
  GHA: {
    bestResult: 'Kvartsfinal 2010',
    nickname: 'Black Stars',
  },
  NGA: {
    bestResult: 'Åttondelsfinal flera gånger',
    nickname: 'Super Eagles',
  },
  EGY: {
    nickname: 'The Pharaohs',
    facts: ['Mest framgångsrika afrikanska landet på Africa Cup of Nations (7 titlar).'],
  },
  IRN: {
    bestResult: 'Gruppspel',
    nickname: 'Team Melli',
  },
  KSA: {
    facts: ['Slog Argentina sensationellt i öppningsmatchen i VM 2022.'],
  },
  SUI: {
    bestResult: 'Åttondelsfinal flera gånger',
    nickname: 'Nati',
  },
  DEN: {
    bestResult: 'Kvartsfinal 1998',
    nickname: 'Danish Dynamite',
    facts: ['Vann EM 1992 trots att de inte ens var kvalificerade ursprungligen.'],
  },
  POL: {
    bestResult: 'Trea 1974, 1982',
    nickname: 'Bialo-Czerwoni',
  },
  COL: {
    bestResult: 'Kvartsfinal 2014',
    nickname: 'Los Cafeteros',
    facts: ['James Rodríguez vann Golden Boot 2014 med 6 mål.'],
  },
  ECU: {
    bestResult: 'Åttondelsfinal 2006',
    nickname: 'La Tri',
  },
  PAR: {
    bestResult: 'Kvartsfinal 2010',
  },
  BOL: {
    bestResult: 'Gruppspel 1994',
  },
  CHI: {
    bestResult: 'Trea 1962',
    nickname: 'La Roja',
    facts: ['Vann Copa América 2015 och 2016 i rad.'],
  },
  PER: {
    bestResult: 'Kvartsfinal 1970, 1978',
  },
  VEN: {
    facts: ['Första VM-slutspelet någonsin för Venezuela 2026.'],
  },
  JAM: {
    bestResult: 'Gruppspel 1998',
    nickname: 'Reggae Boyz',
  },
  PAN: {
    bestResult: 'Gruppspel 2018',
  },
  CRC: {
    bestResult: 'Kvartsfinal 2014',
    nickname: 'Los Ticos',
  },
  HON: {
    bestResult: 'Gruppspel',
  },
  NOR: {
    bestResult: 'Åttondelsfinal 1998',
    facts: ['Erling Haaland förväntas leda Norge i deras första VM sedan 1998.'],
  },
  TUR: {
    bestResult: 'Trea 2002',
    facts: ['Hakan Şükür satte VM:s snabbaste mål – 11 sekunder i bronsmatchen 2002.'],
  },
  UKR: {
    bestResult: 'Kvartsfinal 2006',
  },
  CIV: {
    nickname: 'Les Éléphants',
    facts: ['Didier Drogba är en av Afrikas största fotbollsstjärnor genom tiderna.'],
  },
  COD: {
    nickname: 'Les Léopards',
  },
  RSA: {
    bestResult: 'Värdland 2010',
  },
  CZE: {
    bestResult: 'Final EM 1996, Två gånger trea VM (som Tjeckoslovakien)',
  },
  CPV: {
    facts: ['Första VM-slutspelet någonsin för Kap Verde 2026.'],
  },
  BIH: {
    bestResult: 'Gruppspel 2014',
  },
  HAI: {
    bestResult: 'Gruppspel 1974',
  },
  IRQ: {
    facts: ['Vann Asian Cup 2007 mitt under Irakkriget – en av sportens mest gripande titlar.'],
  },
  JOR: {},
  ALG: {
    bestResult: 'Åttondelsfinal 2014',
  },
  TUN: {
    nickname: 'Carthage Eagles',
  },
  AUT: {
    bestResult: 'Trea 1954',
  },
  SCO: {
    facts: ['Skottland har aldrig avancerat från ett VM-gruppspel trots åtta deltaganden.'],
  },
  UZB: {
    facts: ['Första VM-slutspelet någonsin för Uzbekistan 2026.'],
  },
}

export function getFacts(fifaCode: string): TeamFacts | null {
  return TEAM_FACTS[fifaCode.toUpperCase()] ?? null
}
