import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const salesSummaryQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class SalesSummaryQueryDto extends createZodDto(salesSummaryQuerySchema) {}

export const salesTrendQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class SalesTrendQueryDto extends createZodDto(salesTrendQuerySchema) {}

// No branchId — Shopify orders aren't attributable to a branch, so unlike
// salesTrend this is always company-wide.
export const onlineSalesTrendQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class OnlineSalesTrendQueryDto extends createZodDto(onlineSalesTrendQuerySchema) {}

export const vendorPerformanceQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class VendorPerformanceQueryDto extends createZodDto(vendorPerformanceQuerySchema) {}

export const vendorBalancesQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
});
export class VendorBalancesQueryDto extends createZodDto(vendorBalancesQuerySchema) {}

export const trialBalanceQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class TrialBalanceQueryDto extends createZodDto(trialBalanceQuerySchema) {}

export const profitAndLossQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class ProfitAndLossQueryDto extends createZodDto(profitAndLossQuerySchema) {}

export const balanceSheetQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  asOf: z.string().date().optional(),
});
export class BalanceSheetQueryDto extends createZodDto(balanceSheetQuerySchema) {}

export const cashFlowQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class CashFlowQueryDto extends createZodDto(cashFlowQuerySchema) {}

export const vatSummaryQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class VatSummaryQueryDto extends createZodDto(vatSummaryQuerySchema) {}

// branchId filters the in-store side only — the online (Shopify) side is
// always company-wide, since ShopifyOrder has no branchId at all.
export const channelComparisonQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class ChannelComparisonQueryDto extends createZodDto(channelComparisonQuerySchema) {}
