import { getDb } from "./index";

/** Known LocalMeta keys — a plain key/value store, per the plan. */
export const LocalMetaKey = {
  API_URL: "apiUrl",
  DEVICE_UUID: "deviceUuid",
  DEVICE_NAME: "deviceName",
  BRANCH_ID: "branchId",
  BRANCH_NAME: "branchName",
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  CURRENT_EMPLOYEE_ID: "currentEmployeeId",
  CURRENT_EMPLOYEE_NAME: "currentEmployeeName",
  CURRENT_USER_ID: "currentUserId",
  LAST_CATALOG_SYNC_AT: "lastCatalogSyncAt",
  PRINTER_TARGET: "printerTarget",
  DEVICE_PAIRED: "devicePaired",
  LANGUAGE: "language",
} as const;
export type LocalMetaKey = (typeof LocalMetaKey)[keyof typeof LocalMetaKey];

export async function getMeta(key: LocalMetaKey): Promise<string | null> {
  const row = await getDb().selectFrom("localMeta").select("value").where("key", "=", key).executeTakeFirst();
  return row?.value ?? null;
}

export async function setMeta(key: LocalMetaKey, value: string | null): Promise<void> {
  await getDb()
    .insertInto("localMeta")
    .values({ key, value })
    .onConflict((oc) => oc.column("key").doUpdateSet({ value }))
    .execute();
}

export async function getAllMeta(): Promise<Record<string, string | null>> {
  const rows = await getDb().selectFrom("localMeta").selectAll().execute();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function clearAuthMeta(): Promise<void> {
  await setMeta(LocalMetaKey.ACCESS_TOKEN, null);
  await setMeta(LocalMetaKey.REFRESH_TOKEN, null);
  await setMeta(LocalMetaKey.CURRENT_EMPLOYEE_ID, null);
  await setMeta(LocalMetaKey.CURRENT_EMPLOYEE_NAME, null);
  await setMeta(LocalMetaKey.CURRENT_USER_ID, null);
}
