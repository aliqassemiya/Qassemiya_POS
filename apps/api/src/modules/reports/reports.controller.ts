import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import {
  BalanceSheetQueryDto,
  CashFlowQueryDto,
  ChannelComparisonQueryDto,
  OnlineSalesTrendQueryDto,
  ProfitAndLossQueryDto,
  SalesSummaryQueryDto,
  SalesTrendQueryDto,
  TrialBalanceQueryDto,
  VatSummaryQueryDto,
  VendorBalancesQueryDto,
  VendorPerformanceQueryDto,
} from "./reports.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("reports")
@UseGuards(PermissionsGuard)
@RequirePermissions("reports.view")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("sales-summary")
  salesSummary(@Query() query: SalesSummaryQueryDto) {
    return this.reportsService.salesSummary(query);
  }

  @Get("sales-trend")
  salesTrend(@Query() query: SalesTrendQueryDto) {
    return this.reportsService.salesTrend(query);
  }

  @Get("vendor-performance")
  vendorPerformance(@Query() query: VendorPerformanceQueryDto) {
    return this.reportsService.vendorPerformance(query);
  }

  @Get("vendor-balances")
  vendorBalances(@Query() query: VendorBalancesQueryDto) {
    return this.reportsService.vendorBalances(query);
  }

  @Get("channel-comparison")
  @RequirePermissions("reports.channel.view")
  channelComparison(@Query() query: ChannelComparisonQueryDto) {
    return this.reportsService.channelComparison(query);
  }

  @Get("online-sales-trend")
  @RequirePermissions("reports.channel.view")
  onlineSalesTrend(@Query() query: OnlineSalesTrendQueryDto) {
    return this.reportsService.onlineSalesTrend(query);
  }

  // Financial reports below are gated by reports.financial.view (kept
  // separate from plain reports.view since e.g. INVENTORY_CLERK has the
  // latter but shouldn't see the P&L).
  @Get("trial-balance")
  @RequirePermissions("reports.financial.view")
  trialBalance(@Query() query: TrialBalanceQueryDto) {
    return this.reportsService.trialBalance(query);
  }

  @Get("profit-and-loss")
  @RequirePermissions("reports.financial.view")
  profitAndLoss(@Query() query: ProfitAndLossQueryDto) {
    return this.reportsService.profitAndLoss(query);
  }

  @Get("balance-sheet")
  @RequirePermissions("reports.financial.view")
  balanceSheet(@Query() query: BalanceSheetQueryDto) {
    return this.reportsService.balanceSheet(query);
  }

  @Get("cash-flow")
  @RequirePermissions("reports.financial.view")
  cashFlow(@Query() query: CashFlowQueryDto) {
    return this.reportsService.cashFlow(query);
  }

  @Get("vat-summary")
  @RequirePermissions("reports.financial.view")
  vatSummary(@Query() query: VatSummaryQueryDto) {
    return this.reportsService.vatSummary(query);
  }
}
