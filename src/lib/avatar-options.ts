// Delade val för AI-avatar-generering: lag, pose, arena.
// Används av profilsidans FootballAvatarUpload och admins bildhanterare.
// API-routen (generate-football-image) har egna prompt-beskrivningar
// kopplade till value-fälten nedan.

export interface AvatarOption {
  value: string
  label: string
}

export const TEAM_OPTIONS: AvatarOption[] = [
  { value: 'Sverige', label: '🇸🇪 Sverige' },
  { value: 'Brasilien', label: '🇧🇷 Brasilien' },
  { value: 'Argentina', label: '🇦🇷 Argentina' },
  { value: 'Tyskland', label: '🇩🇪 Tyskland' },
  { value: 'Frankrike', label: '🇫🇷 Frankrike' },
  { value: 'England', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England' },
  { value: 'Spanien', label: '🇪🇸 Spanien' },
  { value: 'Italien', label: '🇮🇹 Italien' },
  { value: 'Portugal', label: '🇵🇹 Portugal' },
  { value: 'Nederländerna', label: '🇳🇱 Nederländerna' },
  { value: 'Belgien', label: '🇧🇪 Belgien' },
  { value: 'Kroatien', label: '🇭🇷 Kroatien' },
  { value: 'Norge', label: '🇳🇴 Norge' },
  // Premier League
  { value: 'Manchester United', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Manchester United' },
  { value: 'Manchester City', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Manchester City' },
  { value: 'Liverpool', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Liverpool' },
  { value: 'Arsenal', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Arsenal' },
  { value: 'Chelsea', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Chelsea' },
  { value: 'Tottenham', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Tottenham Hotspur' },
  { value: 'Newcastle', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Newcastle United' },
  { value: 'Aston Villa', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Aston Villa' },
  { value: 'West Ham', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 West Ham United' },
  // La Liga
  { value: 'Real Madrid', label: '🇪🇸 Real Madrid' },
  { value: 'Barcelona', label: '🇪🇸 FC Barcelona' },
  { value: 'Atlético Madrid', label: '🇪🇸 Atlético Madrid' },
  { value: 'Sevilla', label: '🇪🇸 Sevilla' },
  { value: 'Valencia', label: '🇪🇸 Valencia' },
  { value: 'Athletic Bilbao', label: '🇪🇸 Athletic Bilbao' },
  // Serie A
  { value: 'Juventus', label: '🇮🇹 Juventus' },
  { value: 'AC Milan', label: '🇮🇹 AC Milan' },
  { value: 'Inter Milan', label: '🇮🇹 Inter Milan' },
  { value: 'Roma', label: '🇮🇹 AS Roma' },
  { value: 'Napoli', label: '🇮🇹 Napoli' },
  { value: 'Lazio', label: '🇮🇹 Lazio' },
  // Bundesliga
  { value: 'Bayern München', label: '🇩🇪 Bayern München' },
  { value: 'Borussia Dortmund', label: '🇩🇪 Borussia Dortmund' },
  { value: 'RB Leipzig', label: '🇩🇪 RB Leipzig' },
  { value: 'Bayer Leverkusen', label: '🇩🇪 Bayer Leverkusen' },
  { value: 'Schalke 04', label: '🇩🇪 Schalke 04' },
  // Ligue 1
  { value: 'Paris Saint-Germain', label: '🇫🇷 Paris Saint-Germain' },
  { value: 'Olympique Marseille', label: '🇫🇷 Olympique Marseille' },
  { value: 'Olympique Lyon', label: '🇫🇷 Olympique Lyon' },
  { value: 'Monaco', label: '🇫🇷 AS Monaco' },
  // Eredivisie
  { value: 'Ajax', label: '🇳🇱 Ajax Amsterdam' },
  { value: 'PSV Eindhoven', label: '🇳🇱 PSV Eindhoven' },
  { value: 'Feyenoord', label: '🇳🇱 Feyenoord' },
  // Primeira Liga
  { value: 'FC Porto', label: '🇵🇹 FC Porto' },
  { value: 'Benfica', label: '🇵🇹 Benfica' },
  { value: 'Sporting CP', label: '🇵🇹 Sporting CP' },
  // Allsvenskan
  { value: 'AIK', label: '🇸🇪 AIK' },
  { value: 'Hammarby', label: '🇸🇪 Hammarby' },
  { value: 'Djurgården', label: '🇸🇪 Djurgården' },
  { value: 'IFK Göteborg', label: '🇸🇪 IFK Göteborg' },
  { value: 'Malmö FF', label: '🇸🇪 Malmö FF' },
  { value: 'IFK Norrköping', label: '🇸🇪 IFK Norrköping' },
  { value: 'Elfsborg', label: '🇸🇪 IF Elfsborg' },
]

export const POSE_OPTIONS: AvatarOption[] = [
  { value: 'celebrating', label: '🎉 Firar mål' },
  { value: 'shooting', label: '⚽ Skjuter på mål' },
  { value: 'running', label: '🏃 Springer med bollen' },
  { value: 'bicycle', label: '🤸 Cykelspark' },
  { value: 'header', label: '🤯 Nickar boll' },
  { value: 'dribbling', label: '🪄 Driblar' },
  { value: 'penalty', label: '🎯 Sparkar straff' },
  { value: 'standing', label: '🦁 Står stolt' },
  { value: 'sliding', label: '🦵 Glidtackling' },
  { value: 'trophy', label: '🏆 Lyfter pokalen' },
  { value: 'goalkeeper', label: '🧤 Målvaktsräddning' },
]

export const ARENA_OPTIONS: AvatarOption[] = [
  { value: 'Friends Arena', label: '🇸🇪 Friends Arena (Stockholm)' },
  { value: 'Wembley', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Wembley Stadium (London)' },
  { value: 'Camp Nou', label: '🇪🇸 Camp Nou (Barcelona)' },
  { value: 'Bernabéu', label: '🇪🇸 Santiago Bernabéu (Madrid)' },
  { value: 'San Siro', label: '🇮🇹 San Siro (Milano)' },
  { value: 'Maracanã', label: '🇧🇷 Maracanã (Rio de Janeiro)' },
  { value: 'Allianz Arena', label: '🇩🇪 Allianz Arena (München)' },
  { value: 'Old Trafford', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Old Trafford (Manchester)' },
  { value: 'MetLife Stadium', label: '🇺🇸 MetLife Stadium (USA)' },
  { value: 'Estadio Azteca', label: '🇲🇽 Estadio Azteca (Mexico City)' },
  { value: 'Anfield', label: '🇬🇧 Anfield (Liverpool)' },
  { value: 'Tele2 Arena', label: '🇸🇪 Tele2 Arena (Stockholm)' },
]
