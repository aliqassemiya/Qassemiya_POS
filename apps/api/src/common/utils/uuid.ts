import { uuidv7 } from "uuidv7";

/**
 * Generate a time-ordered UUIDv7. All primary keys in this system are
 * generated client-side (app code, not the DB) so that a row created
 * offline on a POS terminal keeps the same id all the way through sync.
 */
export function newId(): string {
  return uuidv7();
}
