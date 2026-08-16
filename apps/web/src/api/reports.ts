import { apiClient } from "@/lib/apiClient";
import type {
  BalanceSheetReport,
  CashPositionReport,
  LowStockReportRow,
  ProfitAndLossReport,
  SalesSummaryReport,
  TrialBalanceReport,
  VatSummaryReport,
  VendorBalanceRow,
  VendorPerformanceReport,
} from "@/types/entities";

export async function getSalesSummary(query: {
  branchId?: string;
  from: string;
  to: string;
}): Promise<SalesSummaryReport> {
  const { data } = await apiClient.get<SalesSummaryReport>("/reports/sales-summary", { params: query });
  return data;
}

export async function getLowStockReport(query: { branchId?: string }): Promise<LowStockReportRow[]> {
  const { data } = await apiClient.get<LowStockReportRow[]>("/reports/low-stock", { params: query });
  return data;
}

export async function getVendorPerformanceReport(query: {
  vendorId?: string;
  branchId?: string;
  from?: string;
  to?: string;
}): Promise<VendorPerformanceReport> {
  const { data } = await apiClient.get<VendorPerformanceReport>("/reports/vendor-performance", { params: query });
  return data;
}

export async function getVendorBalancesReport(query: { vendorId?: string } = {}): Promise<VendorBalanceRow[]> {
  const { data } = await apiClient.get<VendorBalanceRow[]>("/reports/vendor-balances", { params: query });
  return data;
}

// Finance & Accounting reports (spicy-kindling-puffin.md's "Reports" section).
// No shared-types schema exists for these response shapes yet — see the note
// atop types/entities.ts.

export async function getTrialBalance(query: {
  branchId?: string;
  from?: string;
  to?: string;
}): Promise<TrialBalanceReport> {
  const { data } = await apiClient.get<TrialBalanceReport>("/reports/trial-balance", { params: query });
  return data;
}

export async function getProfitAndLoss(query: {
  branchId?: string;
  from: string;
  to: string;
}): Promise<ProfitAndLossReport> {
  const { data } = await apiClient.get<ProfitAndLossReport>("/reports/profit-and-loss", { params: query });
  return data;
}

export async function getBalanceSheet(query: { branchId?: string; asOf: string }): Promise<BalanceSheetReport> {
  const { data } = await apiClient.get<BalanceSheetReport>("/reports/balance-sheet", { params: query });
  return data;
}

export async function getCashFlow(query: {
  branchId?: string;
  from: string;
  to: string;
}): Promise<CashPositionReport> {
  const { data } = await apiClient.get<CashPositionReport>("/reports/cash-flow", { params: query });
  return data;
}

export async function getVatSummary(query: {
  branchId?: string;
  from: string;
  to: string;
}): Promise<VatSummaryReport> {
  const { data } = await apiClient.get<VatSummaryReport>("/reports/vat-summary", { params: query });
  return data;
}
