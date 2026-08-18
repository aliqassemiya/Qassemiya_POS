import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const salesSummaryQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export class SalesSummaryQueryDto extends createZodDto(salesSummaryQuerySchema) {}

export const salesTrendQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export class SalesTrendQueryDto extends createZodDto(salesTrendQuerySchema) {}

export const vendorPerformanceQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export class VendorPerformanceQueryDto extends createZodDto(vendorPerformanceQuerySchema) {}

export const vendorBalancesQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
});
export class VendorBalancesQueryDto extends createZodDto(vendorBalancesQuerySchema) {}

export const trialBalanceQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export class TrialBalanceQueryDto extends createZodDto(trialBalanceQuerySchema) {}

export const profitAndLossQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export class ProfitAndLossQueryDto extends createZodDto(profitAndLossQuerySchema) {}

export const balanceSheetQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  asOf: z.string().datetime().optional(),
});
export class BalanceSheetQueryDto extends createZodDto(balanceSheetQuerySchema) {}

export const cashFlowQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export class CashFlowQueryDto extends createZodDto(cashFlowQuerySchema) {}

export const vatSummaryQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export class VatSummaryQueryDto extends createZodDto(vatSummaryQuerySchema) {}
