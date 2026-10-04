import { create } from "zustand";
import type { SyncStatusPayload } from "../../../shared/ipc";

export type Screen = "till" | "returns" | "settings";

export interface PairingState {
  paired: boolean;
  apiUrl: string | null;
  branchId: string | null;
  branchCode: string | null;
  branchName: string | null;
  deviceUuid: string | null;
  deviceName: string | null;
}

export interface SessionState {
  employeeId: string | null;
  employeeName: string | null;
  userId: string | null;
  loggedIn: boolean;
}

interface SessionStore {
  pairing: PairingState | null;
  session: SessionState | null;
  screen: Screen;
  syncStatus: SyncStatusPayload;
  setPairing: (p: PairingState) => void;
  setSession: (s: SessionState) => void;
  setScreen: (s: Screen) => void;
  setSyncStatus: (s: SyncStatusPayload) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  pairing: null,
  session: null,
  screen: "till",
  syncStatus: { online: false, unsyncedCount: 0, isSyncing: false, lastSyncAt: null, lastError: null },
  setPairing: (pairing) => set({ pairing }),
  setSession: (session) => set({ session }),
  setScreen: (screen) => set({ screen }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
}));
