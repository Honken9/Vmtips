// Hårdkodad fallback för förbundskaptener per nation.
// Används när football-data.org inte returnerar coach-info.
// Uppdateras manuellt när tränare byts ut.

export interface FallbackCoach {
  name: string
  nationality?: string
}

export const WC_FALLBACK_COACHES: Record<string, FallbackCoach> = {
  // Hosts
  USA: { name: 'Mauricio Pochettino', nationality: 'Argentina' },
  MEX: { name: 'Javier Aguirre', nationality: 'Mexico' },
  CAN: { name: 'Jesse Marsch', nationality: 'USA' },

  // UEFA
  SWE: { name: 'Graham Potter', nationality: 'England' },
  ESP: { name: 'Luis de la Fuente', nationality: 'Spanien' },
  FRA: { name: 'Didier Deschamps', nationality: 'Frankrike' },
  GER: { name: 'Julian Nagelsmann', nationality: 'Tyskland' },
  ENG: { name: 'Thomas Tuchel', nationality: 'Tyskland' },
  ITA: { name: 'Gennaro Gattuso', nationality: 'Italien' },
  POR: { name: 'Roberto Martínez', nationality: 'Spanien' },
  NED: { name: 'Ronald Koeman', nationality: 'Nederländerna' },
  BEL: { name: 'Rudi Garcia', nationality: 'Frankrike' },
  CRO: { name: 'Zlatko Dalić', nationality: 'Kroatien' },
  SUI: { name: 'Murat Yakin', nationality: 'Schweiz' },
  DEN: { name: 'Brian Riemer', nationality: 'Danmark' },
  NOR: { name: 'Ståle Solbakken', nationality: 'Norge' },
  AUT: { name: 'Ralf Rangnick', nationality: 'Tyskland' },
  POL: { name: 'Jan Urban', nationality: 'Polen' },
  CZE: { name: 'Ivan Hašek', nationality: 'Tjeckien' },
  HUN: { name: 'Marco Rossi', nationality: 'Italien' },
  SCO: { name: 'Steve Clarke', nationality: 'Skottland' },
  WAL: { name: 'Craig Bellamy', nationality: 'Wales' },
  TUR: { name: 'Vincenzo Montella', nationality: 'Italien' },
  BIH: { name: 'Sergej Barbarez', nationality: 'Bosnien-Hercegovina' },

  // CONMEBOL
  BRA: { name: 'Carlo Ancelotti', nationality: 'Italien' },
  ARG: { name: 'Lionel Scaloni', nationality: 'Argentina' },
  URU: { name: 'Marcelo Bielsa', nationality: 'Argentina' },
  COL: { name: 'Néstor Lorenzo', nationality: 'Argentina' },
  ECU: { name: 'Sebastián Beccacece', nationality: 'Argentina' },
  PAR: { name: 'Gustavo Alfaro', nationality: 'Argentina' },
  CHI: { name: 'Ricardo Gareca', nationality: 'Argentina' },
  BOL: { name: 'Óscar Villegas', nationality: 'Bolivia' },
  PER: { name: 'Óscar Ibáñez', nationality: 'Argentina' },
  VEN: { name: 'Fernando Batista', nationality: 'Argentina' },

  // CAF
  MAR: { name: 'Walid Regragui', nationality: 'Marocko' },
  TUN: { name: 'Sami Trabelsi', nationality: 'Tunisien' },
  EGY: { name: 'Hossam Hassan', nationality: 'Egypten' },
  ALG: { name: 'Vladimir Petković', nationality: 'Schweiz' },
  SEN: { name: 'Pape Thiaw', nationality: 'Senegal' },
  NGA: { name: 'Éric Chelle', nationality: 'Mali' },
  GHA: { name: 'Otto Addo', nationality: 'Tyskland' },
  CMR: { name: 'Marc Brys', nationality: 'Belgien' },
  CIV: { name: 'Emerse Faé', nationality: 'Elfenbenskusten' },
  COD: { name: 'Sébastien Desabre', nationality: 'Frankrike' },
  RSA: { name: 'Hugo Broos', nationality: 'Belgien' },
  CPV: { name: 'Pedro "Bubista" Brito', nationality: 'Kap Verde' },

  // AFC
  KOR: { name: 'Hong Myung-bo', nationality: 'Sydkorea' },
  JPN: { name: 'Hajime Moriyasu', nationality: 'Japan' },
  AUS: { name: 'Tony Popovic', nationality: 'Australien' },
  IRN: { name: 'Amir Ghalenoei', nationality: 'Iran' },
  KSA: { name: 'Hervé Renard', nationality: 'Frankrike' },
  IRQ: { name: 'Graham Arnold', nationality: 'Australien' },
  UZB: { name: 'Timur Kapadze', nationality: 'Uzbekistan' },
  JOR: { name: 'Jamal Sellami', nationality: 'Marocko' },
  QAT: { name: 'Bartolomé Márquez', nationality: 'Spanien' },

  // CONCACAF (utöver värdar)
  HON: { name: 'Reinaldo Rueda', nationality: 'Colombia' },
  PAN: { name: 'Thomas Christiansen', nationality: 'Danmark' },
  CRC: { name: 'Miguel Herrera', nationality: 'Mexico' },
  HAI: { name: 'Sébastien Migné', nationality: 'Frankrike' },
  CUW: { name: 'Dick Advocaat', nationality: 'Nederländerna' },

  // OFC
  NZL: { name: 'Darren Bazeley', nationality: 'England' },
}

export function getFallbackCoach(fifaCode: string): FallbackCoach | null {
  return WC_FALLBACK_COACHES[fifaCode.toUpperCase()] ?? null
}
