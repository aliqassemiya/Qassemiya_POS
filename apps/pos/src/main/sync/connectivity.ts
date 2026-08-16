import axios from "axios";

export type ConnectivityListener = (online: boolean) => void;

/**
 * Electron's main process has no `navigator.onLine`, so connectivity is
 * inferred from whether the API is reachable: a short-timeout GET against
 * the API base URL, polled periodically. Any HTTP response (even a 404 —
 * meaning "no /health route, but the server answered") counts as online;
 * only connection-level failures (refused, DNS, timeout) count as offline.
 */
export class ConnectivityMonitor {
  private online = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<ConnectivityListener>();
  private getApiUrl: () => string;
  private intervalMs: number;

  constructor(getApiUrl: () => string, intervalMs = 15_000) {
    this.getApiUrl = getApiUrl;
    this.intervalMs = intervalMs;
  }

  isOnline(): boolean {
    return this.online;
  }

  onChange(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.timer) return;
    void this.check();
    this.timer = setInterval(() => void this.check(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async check(): Promise<boolean> {
    const apiUrl = this.getApiUrl();
    let reachable = false;
    if (apiUrl) {
      try {
        await axios.get(`${apiUrl.replace(/\/$/, "")}/health`, { timeout: 4000, validateStatus: () => true });
        reachable = true;
      } catch {
        reachable = false;
      }
    }
    if (reachable !== this.online) {
      this.online = reachable;
      for (const listener of this.listeners) listener(reachable);
    }
    return reachable;
  }
}
