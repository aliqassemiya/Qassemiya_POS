import path from "node:path";
import { app, BrowserWindow, shell } from "electron";
import { is } from "@electron-toolkit/utils";
import { initDb, closeDb } from "./db";
import { setMeta, getMeta, LocalMetaKey } from "./db/local-meta";
import { registerIpcHandlers } from "./ipc/register";
import { syncWorker } from "./sync/sync-worker";

// Explicit, filesystem-safe app name — the scoped package name ("@qassemiya/pos")
// would otherwise leak into app.getPath('userData') and other OS paths.
app.setName("qassemiya-pos");

let mainWindow: BrowserWindow | null = null;

async function ensureDefaultApiUrl(): Promise<void> {
  const existing = await getMeta(LocalMetaKey.API_URL);
  if (!existing) {
    await setMeta(LocalMetaKey.API_URL, process.env.API_URL ?? "http://localhost:3000");
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    void mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  initDb();
  await ensureDefaultApiUrl();
  registerIpcHandlers(() => mainWindow);
  createWindow();
  await syncWorker.start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  syncWorker.stop();
  void closeDb();
});
