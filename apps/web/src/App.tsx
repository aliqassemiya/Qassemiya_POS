import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getCurrentUser } from "@/api/auth";
import { refreshAccessToken } from "@/lib/apiClient";
import { tokenStorage } from "@/lib/tokenStorage";
import { useAuthStore } from "@/store/authStore";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { ToastHost } from "@/components/ui/ToastHost";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { BranchesPage } from "@/pages/branches/BranchesPage";
import { ProductsPage } from "@/pages/products/ProductsPage";
import { ProductFormPage } from "@/pages/products/ProductFormPage";
import { InventoryPage } from "@/pages/inventory/InventoryPage";
import { SalesPage } from "@/pages/sales/SalesPage";
import { SaleDetailPage } from "@/pages/sales/SaleDetailPage";
import { ReturnsPage } from "@/pages/returns/ReturnsPage";
import { CustomersPage } from "@/pages/customers/CustomersPage";
import { CustomerDetailPage } from "@/pages/customers/CustomerDetailPage";
import { EmployeesPage } from "@/pages/employees/EmployeesPage";
import { UsersPage } from "@/pages/users/UsersPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { VendorsPage } from "@/pages/vendors/VendorsPage";
import { VendorStatementPage } from "@/pages/vendors/VendorStatementPage";
import { PurchaseOrdersPage } from "@/pages/purchase-orders/PurchaseOrdersPage";
import { PurchaseOrderFormPage } from "@/pages/purchase-orders/PurchaseOrderFormPage";
import { PurchaseOrderDetailPage } from "@/pages/purchase-orders/PurchaseOrderDetailPage";
import { PurchaseInvoicesPage } from "@/pages/purchase-invoices/PurchaseInvoicesPage";
import { PurchaseInvoiceDetailPage } from "@/pages/purchase-invoices/PurchaseInvoiceDetailPage";
import { PurchaseReturnsPage } from "@/pages/purchase-returns/PurchaseReturnsPage";
import { AccountsPage } from "@/pages/accounts/AccountsPage";
import { AccountLedgerPage } from "@/pages/accounts/AccountLedgerPage";
import { JournalEntriesPage } from "@/pages/journal-entries/JournalEntriesPage";
import { JournalEntryDetailPage } from "@/pages/journal-entries/JournalEntryDetailPage";
import { ExpensesPage } from "@/pages/expenses/ExpensesPage";
import { FinancialReportsPage } from "@/pages/reports/FinancialReportsPage";
import { ShopifySettingsPage } from "@/pages/integrations/ShopifySettingsPage";
import { OnlineOrdersPage } from "@/pages/integrations/OnlineOrdersPage";
import { WhatsAppSettingsPage } from "@/pages/integrations/WhatsAppSettingsPage";
import { TamaraSettingsPage } from "@/pages/integrations/TamaraSettingsPage";
import { TabbySettingsPage } from "@/pages/integrations/TabbySettingsPage";
import { ChannelComparisonPage } from "@/pages/reports/ChannelComparisonPage";

export default function App() {
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setHydrated = useAuthStore((s) => s.setHydrated);

  // On first load, try to silently restore a session from the stored refresh
  // token (access tokens are never persisted). If there's no refresh token,
  // or it's expired/invalid, this simply falls through to /login.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const storedRefreshToken = tokenStorage.getRefreshToken();
      if (!storedRefreshToken) {
        setHydrated(true);
        return;
      }
      const accessToken = await refreshAccessToken();
      if (!accessToken) {
        setHydrated(true);
        return;
      }
      try {
        const user = await getCurrentUser();
        if (!cancelled) setSession({ accessToken, user });
      } catch {
        tokenStorage.clearRefreshToken();
        clearSession();
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ToastHost />
      <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id" element={<ProductFormPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/sales/:id" element={<SaleDetailPage />} />
          <Route path="/returns" element={<ReturnsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/vendors/:id" element={<VendorStatementPage />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/purchase-orders/new" element={<PurchaseOrderFormPage />} />
          <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
          <Route path="/purchase-invoices" element={<PurchaseInvoicesPage />} />
          <Route path="/purchase-invoices/:id" element={<PurchaseInvoiceDetailPage />} />
          <Route path="/purchase-returns" element={<PurchaseReturnsPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:id/ledger" element={<AccountLedgerPage />} />
          <Route path="/journal-entries" element={<JournalEntriesPage />} />
          <Route path="/journal-entries/:id" element={<JournalEntryDetailPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/reports/financial" element={<FinancialReportsPage />} />
          <Route path="/integrations/shopify" element={<ShopifySettingsPage />} />
          <Route path="/integrations/shopify/orders" element={<OnlineOrdersPage />} />
          <Route path="/integrations/whatsapp" element={<WhatsAppSettingsPage />} />
          <Route path="/integrations/tamara" element={<TamaraSettingsPage />} />
          <Route path="/integrations/tabby" element={<TabbySettingsPage />} />
          <Route path="/reports/channel-comparison" element={<ChannelComparisonPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
