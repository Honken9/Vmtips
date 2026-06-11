// Tidsformattering pinnad till Europe/Stockholm.
//
// VIKTIGT: Använd ALLTID dessa för avsparkstider – aldrig date-fns
// format(new Date(iso), ...) direkt. date-fns formaterar i exekverings-
// miljöns tidszon: på Vercel-servern är det UTC, i webbläsaren beror det
// på besökaren. Resultatet blev olika tider på samma sida (UTC 19:00 i
// server-renderad text, 21:00 svensk tid i klient-nedräkningen).

const TZ = 'Europe/Stockholm'

/** '21:00' */
export function stockholmTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })
}

/** '24 juni 21:00' */
export function stockholmDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).replace(/\./g, '')
  return `${date} ${stockholmTime(iso)}`
}

/** 'ons 24 juni 21:00' */
export function stockholmWeekdayDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).replace(/\./g, '')
  return `${date} ${stockholmTime(iso)}`
}
