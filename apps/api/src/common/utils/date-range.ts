// This business operates in one timezone (Saudi Arabia, UTC+3, no DST), so
// every "YYYY-MM-DD" date-picker value in the app means "that calendar day
// in Riyadh time" to whoever typed it -- not UTC. Using a fixed offset
// rather than the server process's own configured timezone keeps this
// correct regardless of where the API ends up deployed (e.g. a Docker
// container that defaults to UTC) -- same technique already used in
// shopify.service.ts's startOfCurrentMonthRiyadh.
export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

export function startOfDayRiyadh(dateString: string): Date {
  return new Date(new Date(`${dateString}T00:00:00.000Z`).getTime() - RIYADH_OFFSET_MS);
}

export function endOfDayRiyadh(dateString: string): Date {
  return new Date(new Date(`${dateString}T23:59:59.999Z`).getTime() - RIYADH_OFFSET_MS);
}
