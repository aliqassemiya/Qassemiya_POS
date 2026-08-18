/**
 * A "to" filter typed as a plain date (e.g. "2026-08-17") must include the
 * whole day, not just its first instant. `new Date("2026-08-17")` parses as
 * 2026-08-17T00:00:00.000Z — sent straight to an API's `lte` bound, that
 * excludes literally everything created that day, which reads as "today's
 * activity never shows up until tomorrow." Built from the date's own
 * year/month/day (not `setHours`, which would apply the browser's local
 * timezone on top of the UTC-parsed date and could shift the boundary by
 * several hours) so the result is stable regardless of the viewer's locale.
 */
export function endOfDayIso(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString();
}
