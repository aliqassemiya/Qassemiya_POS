import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BranchSwitcher } from "./BranchSwitcher";
import { useAuthStore } from "@/store/authStore";
import { tokenStorage } from "@/lib/tokenStorage";
import { logout as logoutRequest } from "@/api/auth";
import { Button } from "@/components/ui/Button";

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const handleLogout = async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    tokenStorage.clearRefreshToken();
    clearSession();
    if (refreshToken) {
      try {
        await logoutRequest(refreshToken);
      } catch {
        // best-effort — session is already cleared client-side
      }
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <BranchSwitcher />
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user?.fullName}</span>
            <Button variant="secondary" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
