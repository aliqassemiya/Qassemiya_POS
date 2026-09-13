import { apiClient } from "@/lib/apiClient";
import type {
  BalanceSheetReport,
  CashPositionReport,
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

export interface SalesTrendReport {
  from: string;
  to: string;
  days: Array<{ date: string; total: number; orderCount: number }>;
}

export async function getSalesTrend(query: { branchId?: string; from?: string; to?: string }): Promise<SalesTrendReport> {
  const { data } = await apiClient.get<SalesTrendReport>("/reports/sales-trend", { params: query });
  return data;
}

// No branchId — Shopify orders aren't attributable to a branch, always company-wide.
export async function getOnlineSalesTrend(query: { from?: string; to?: string }): Promise<SalesTrendReport> {
  const { data } = await apiClient.get<SalesTrendReport>("/reports/online-sales-trend", { params: query });
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

export interface ChannelComparisonSkuRow {
  productVariantId: string;
  sku: string;
  productName: string;
  inStoreQuantity: number;
  inStoreRevenue: number;
  onlineQuantity: number;
  onlineRevenue: number;
}

export interface ChannelComparisonUnmatchedRow {
  sku: string | null;
  title: string;
  quantity: number;
  revenue: number;
}

export interface ChannelComparisonReport {
  from?: string;
  to?: string;
  inStore: { orderCount: number; total: number };
  online: { orderCount: number; total: number };
  combined: number;
  bySku: ChannelComparisonSkuRow[];
  unmatchedShopifySkus: ChannelComparisonUnmatchedRow[];
}

// branchId only filters the in-store side — Shopify orders have no branch,
// so the online figure returned here is always company-wide.
export async function getChannelComparison(query: {
  branchId?: string;
  from?: string;
  to?: string;
}): Promise<ChannelComparisonReport> {
  const { data } = await apiClient.get<ChannelComparisonReport>("/reports/channel-comparison", { params: query });
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
