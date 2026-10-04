import axios from "axios";
import { uuidv7 } from "uuidv7";
import { getApiClient, setApiUrl } from "../api-client";
import { getMeta, setMeta, clearAuthMeta, LocalMetaKey } from "../db/local-meta";

export interface PairDeviceInput {
  apiUrl: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  deviceName: string;
}

export interface PublicBranch {
  id: string;
  code: string;
  name: string;
}

/**
 * Plain axios call (not getApiClient()) — at pairing time there's no stored
 * API URL yet, and the endpoint is deliberately unauthenticated so a fresh
 * till can list branches before it has any credentials.
 */
export async function listPublicBranches(apiUrl: string): Promise<PublicBranch[]> {
  const { data } = await axios.get<PublicBranch[]>(`${apiUrl.replace(/\/+$/, "")}/branches/public`, { timeout: 10_000 });
  return data;
}

export interface PairDeviceResult {
  deviceUuid: string;
}

/** First-run device pairing: registers this terminal against a branch. Required before PIN login. */
export async function pairDevice(input: PairDeviceInput): Promise<PairDeviceResult> {
  await setApiUrl(input.apiUrl);

  let deviceUuid = await getMeta(LocalMetaKey.DEVICE_UUID);
  if (!deviceUuid) {
    deviceUuid = uuidv7();
  }

  const client = getApiClient();
  await client.post("/auth/register-device", {
    deviceUuid,
    name: input.deviceName,
    branchId: input.branchId,
  });

  await setMeta(LocalMetaKey.DEVICE_UUID, deviceUuid);
  await setMeta(LocalMetaKey.DEVICE_NAME, input.deviceName);
  await setMeta(LocalMetaKey.BRANCH_ID, input.branchId);
  await setMeta(LocalMetaKey.BRANCH_CODE, input.branchCode);
  await setMeta(LocalMetaKey.BRANCH_NAME, input.branchName);
  await setMeta(LocalMetaKey.DEVICE_PAIRED, "true");

  return { deviceUuid };
}

/**
 * Recovery path for a device whose server-side pairing is gone (e.g. the
 * backing database was reset) — until this existed, that state was a dead
 * end: the login screen would 401 forever with "Device is not paired" and
 * there was no way back to PairingScreen without a login, which itself is
 * exactly what's blocked. Keeps the cached deviceUuid — re-submitting
 * pairing with the same uuid just upserts a fresh Device row server-side,
 * no need to mint a new one.
 */
export async function unpairDevice(): Promise<void> {
  await setMeta(LocalMetaKey.DEVICE_PAIRED, "false");
  await clearAuthMeta();
}

export interface PairingState {
  paired: boolean;
  apiUrl: string | null;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  deviceUuid: string | null;
  deviceName: string | null;
}

export async function getPairingState(): Promise<PairingState> {
  const [paired, apiUrl, branchId, deviceUuid, deviceName] = await Promise.all([
    getMeta(LocalMetaKey.DEVICE_PAIRED),
    getMeta(LocalMetaKey.API_URL),
    getMeta(LocalMetaKey.BRANCH_ID),
    getMeta(LocalMetaKey.DEVICE_UUID),
    getMeta(LocalMetaKey.DEVICE_NAME),
  ]);

  let branchCode = await getMeta(LocalMetaKey.BRANCH_CODE);
  let branchName = await getMeta(LocalMetaKey.BRANCH_NAME);

  // Tills paired before branch code/name were cached locally have a
  // branchId but nothing else -- backfill them once (via the same
  // unauthenticated endpoint the pairing screen itself uses) so
  // already-paired tills pick this up without needing to re-pair.
  if (paired === "true" && branchId && (!branchCode || !branchName) && apiUrl) {
    try {
      const branches = await listPublicBranches(apiUrl);
      const match = branches.find((b) => b.id === branchId);
      if (match) {
        branchCode = match.code;
        branchName = match.name;
        await setMeta(LocalMetaKey.BRANCH_CODE, branchCode);
        await setMeta(LocalMetaKey.BRANCH_NAME, branchName);
      }
    } catch {
      // Offline or server unreachable -- fall through with whatever's cached.
    }
  }

  return { paired: paired === "true", apiUrl, branchId, branchCode, branchName, deviceUuid, deviceName };
}

export interface PinLoginInput {
  employeeCode: string;
  pinCode: string;
}

export interface PinLoginResult {
  employeeId: string;
  employeeName: string;
  userId: string;
}

export async function pinLogin(input: PinLoginInput): Promise<PinLoginResult> {
  const deviceUuid = await getMeta(LocalMetaKey.DEVICE_UUID);
  if (!deviceUuid) throw new Error("Device is not paired yet");

  const client = getApiClient();
  const { data } = await client.post("/auth/pos-pin-login", {
    employeeCode: input.employeeCode,
    pinCode: input.pinCode,
    deviceUuid,
  });

  const accessToken: string | undefined = data?.accessToken;
  const refreshToken: string | undefined = data?.refreshToken;
  if (!accessToken) throw new Error("Login response missing accessToken");

  const employeeId: string = data?.employee?.id ?? data?.employeeId ?? "";
  const employeeName: string = data?.employee?.name ?? data?.employee?.fullName ?? input.employeeCode;
  const userId: string = data?.user?.id ?? data?.userId ?? "";

  await setMeta(LocalMetaKey.ACCESS_TOKEN, accessToken);
  await setMeta(LocalMetaKey.REFRESH_TOKEN, refreshToken ?? null);
  await setMeta(LocalMetaKey.CURRENT_EMPLOYEE_ID, employeeId);
  await setMeta(LocalMetaKey.CURRENT_EMPLOYEE_NAME, employeeName);
  await setMeta(LocalMetaKey.CURRENT_USER_ID, userId);

  return { employeeId, employeeName, userId };
}

export async function logout(): Promise<void> {
  await clearAuthMeta();
}

export interface CurrentSession {
  employeeId: string | null;
  employeeName: string | null;
  userId: string | null;
  loggedIn: boolean;
}

export async function getCurrentSession(): Promise<CurrentSession> {
  const [employeeId, employeeName, userId, accessToken] = await Promise.all([
    getMeta(LocalMetaKey.CURRENT_EMPLOYEE_ID),
    getMeta(LocalMetaKey.CURRENT_EMPLOYEE_NAME),
    getMeta(LocalMetaKey.CURRENT_USER_ID),
    getMeta(LocalMetaKey.ACCESS_TOKEN),
  ]);
  return { employeeId, employeeName, userId, loggedIn: Boolean(accessToken) };
}
