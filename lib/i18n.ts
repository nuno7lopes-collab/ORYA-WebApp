type SupportedLocale = "pt-PT" | "en-US" | "es-ES";

const LOCALE_MAP: Record<string, SupportedLocale> = {
  pt: "pt-PT",
  "pt-PT": "pt-PT",
  en: "en-US",
  "en-US": "en-US",
  es: "es-ES",
  "es-ES": "es-ES",
};

export function resolveLocale(lang?: string | null): SupportedLocale {
  if (!lang) return "pt-PT";
  const normalized = lang.trim();
  return LOCALE_MAP[normalized] ?? "pt-PT";
}

export function formatCurrency(cents: number, currency: string, locale?: string | null) {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  const safeCurrency = currency ? currency.toUpperCase() : "EUR";
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: safeCurrency,
    minimumFractionDigits: 2,
  }).format(safeCents / 100);
}

export function formatDateTime(value: Date, locale?: string | null, timezone?: string | null) {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    timeZone: timezone || "Europe/Lisbon",
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

export function formatDate(value: Date, locale?: string | null, timezone?: string | null) {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    timeZone: timezone || "Europe/Lisbon",
    dateStyle: "short",
  }).format(value);
}

export function formatTime(value: Date, locale?: string | null, timezone?: string | null) {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    timeZone: timezone || "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

const DICT: Record<SupportedLocale, Record<string, string>> = {
  "pt-PT": {
    eventMissing: "Evento em falta.",
    eventInvalid: "Evento inválido.",
    slugMissing: "Slug em falta.",
    eventNotFound: "Evento não encontrado.",
    eventNotPublic: "Evento não público.",
    registrationsOpen: "Inscrições abertas via ORYA.",
    registerNow: "Inscrever-me",
    tournament: "Torneio",
    nextMatches: "Próximos jogos",
    liveScoreTitle: "Live Score",
    liveScoreSubtitle: "Placar ao vivo e links de streaming.",
    liveMatches: "Em curso",
    upcomingMatches: "Próximos jogos",
    noLiveMatches: "Sem jogos ao vivo.",
    noUpcomingMatches: "Sem jogos agendados.",
    watchStream: "Ver streaming",
    monitorTitle: "TV Monitor",
    monitorSubtitle: "Atualiza automaticamente",
    sponsors: "Patrocinadores",
    matches: "jogos",
    padel: "Padel",
    court: "Quadra",
    calendarTitle: "Calendário de jogos",
    dateTimeLabel: "Data/Hora",
    courtLabel: "Quadra",
    phaseLabel: "Fase",
    matchLabel: "Jogo",
    statusLabel: "Status",
    bracket: "Bracket",
    noBracket: "Sem bracket.",
    standings: "Classificações",
    noStandings: "Sem standings.",
    groupLabel: "Grupo",
    pairing: "Dupla",
    pointsShort: "Pts",
    registrations: "Inscrições",
    registrationsClosed: "Inscrições fechadas.",
    noMatches: "Sem jogos agendados.",
  },
  "en-US": {
    eventMissing: "Event is missing.",
    eventInvalid: "Invalid event.",
    slugMissing: "Missing slug.",
    eventNotFound: "Event not found.",
    eventNotPublic: "Event not public.",
    registrationsOpen: "Registrations open on ORYA.",
    registerNow: "Register",
    tournament: "Tournament",
    nextMatches: "Upcoming matches",
    liveScoreTitle: "Live Score",
    liveScoreSubtitle: "Live scoreboard and streaming links.",
    liveMatches: "Live now",
    upcomingMatches: "Upcoming matches",
    noLiveMatches: "No live matches.",
    noUpcomingMatches: "No matches scheduled.",
    watchStream: "Watch stream",
    monitorTitle: "TV Monitor",
    monitorSubtitle: "Auto refresh",
    sponsors: "Sponsors",
    matches: "matches",
    padel: "Padel",
    court: "Court",
    calendarTitle: "Match schedule",
    dateTimeLabel: "Date/Time",
    courtLabel: "Court",
    phaseLabel: "Phase",
    matchLabel: "Match",
    statusLabel: "Status",
    bracket: "Bracket",
    noBracket: "No bracket.",
    standings: "Standings",
    noStandings: "No standings.",
    groupLabel: "Group",
    pairing: "Pairing",
    pointsShort: "Pts",
    registrations: "Registrations",
    registrationsClosed: "Registrations closed.",
    noMatches: "No matches scheduled.",
  },
  "es-ES": {
    eventMissing: "Evento en falta.",
    eventInvalid: "Evento inválido.",
    slugMissing: "Falta el slug.",
    eventNotFound: "Evento no encontrado.",
    eventNotPublic: "Evento no público.",
    registrationsOpen: "Inscripciones abiertas en ORYA.",
    registerNow: "Inscribirme",
    tournament: "Torneo",
    nextMatches: "Próximos partidos",
    liveScoreTitle: "Live Score",
    liveScoreSubtitle: "Marcador en directo y enlaces de streaming.",
    liveMatches: "En curso",
    upcomingMatches: "Próximos partidos",
    noLiveMatches: "Sin partidos en directo.",
    noUpcomingMatches: "Sin partidos programados.",
    watchStream: "Ver streaming",
    monitorTitle: "TV Monitor",
    monitorSubtitle: "Actualiza automáticamente",
    sponsors: "Patrocinadores",
    matches: "partidos",
    padel: "Padel",
    court: "Pista",
    calendarTitle: "Calendario de partidos",
    dateTimeLabel: "Fecha/Hora",
    courtLabel: "Pista",
    phaseLabel: "Fase",
    matchLabel: "Partido",
    statusLabel: "Estado",
    bracket: "Bracket",
    noBracket: "Sin bracket.",
    standings: "Clasificaciones",
    noStandings: "Sin clasificaciones.",
    groupLabel: "Grupo",
    pairing: "Pareja",
    pointsShort: "Pts",
    registrations: "Inscripciones",
    registrationsClosed: "Inscripciones cerradas.",
    noMatches: "Sin partidos programados.",
  },
};

export function t(key: string, locale?: string | null) {
  const resolved = resolveLocale(locale);
  return DICT[resolved]?.[key] ?? DICT["pt-PT"][key] ?? key;
}
