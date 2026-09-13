import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type {
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

// Report sign convention (critical — documented here since every financial
// report below relies on it): ASSET/EXPENSE/COGS balance = Σdebit - Σcredit;
// LIABILITY/EQUITY/REVENUE balance = Σcredit - Σdebit. This is the FIXED
// per-account-TYPE convention reports use for rollups — never an individual
// account's own `normalBalance` column — otherwise 4100 Sales Returns &
// Allowances (debit-normal, but type REVENUE) would ADD to instead of
// SUBTRACT from net revenue.
function typeBalance(type: string, debit: number, credit: number): number {
  return type === "ASSET" || type === "EXPENSE" || type === "COGS" ? debit - credit : credit - debit;
}

function dateRangeWhere(from?: string, to?: string) {
  if (!from && !to) return {};
  return { entryDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } };
}

// Shared by salesTrend and onlineSalesTrend — both the bucket keys AND the
// enumerated-days keys MUST use this same day-derivation method. Mixing
// `toISOString().slice(0, 10)` (UTC) with `setHours(0, 0, 0, 0)`
// (server-local time) shifts the enumerated days a full calendar day behind
// the order buckets for any server timezone ahead of UTC (e.g. Asia/Riyadh,
// UTC+3) — every lookup then misses and the chart shows zero sales even
// when orders exist.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async salesSummary(query: SalesSummaryQueryDto) {
    const where = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [aggregate, orderCount, byPaymentMethod] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: { subtotal: true, discountTotal: true, taxTotal: true, total: true },
      }),
      this.prisma.order.count({ where }),
      this.prisma.payment.groupBy({
        by: ["paymentMethodId"],
        where: { order: where },
        _sum: { amount: true },
      }),
    ]);

    const paymentMethods = await this.prisma.paymentMethod.findMany();
    const paymentMethodMap = new Map(paymentMethods.map((pm) => [pm.id, pm]));

    return {
      orderCount,
      subtotal: aggregate._sum.subtotal ?? 0,
      discountTotal: aggregate._sum.discountTotal ?? 0,
      taxTotal: aggregate._sum.taxTotal ?? 0,
      total: aggregate._sum.total ?? 0,
      byPaymentMethod: byPaymentMethod.map((row) => ({
        paymentMethodId: row.paymentMethodId,
        name: paymentMethodMap.get(row.paymentMethodId)?.name ?? row.paymentMethodId,
        amount: row._sum.amount ?? 0,
      })),
    };
  }

  /**
   * Daily sales totals for a dashboard trend chart — fetches raw orders in
   * range and buckets by calendar day in JS (same "fetch rows, reduce in
   * JS" idiom as vendorPerformance below), including zero-filled days so the
   * chart doesn't show gaps on days with no sales. Defaults to the last 7
   * days when no range is given.
   */
  async salesTrend(query: SalesTrendQueryDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.order.findMany({
      where: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        createdAt: { gte: from, lte: to },
      },
      select: { createdAt: true, total: true },
    });

    const buckets = new Map<string, { total: number; orderCount: number }>();
    for (const order of orders) {
      const day = dayKey(order.createdAt);
      const bucket = buckets.get(day) ?? { total: 0, orderCount: 0 };
      bucket.total += Number(order.total);
      bucket.orderCount += 1;
      buckets.set(day, bucket);
    }

    const days: Array<{ date: string; total: number; orderCount: number }> = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(to);
    endDay.setHours(0, 0, 0, 0);
    while (cursor <= endDay) {
      const key = dayKey(cursor);
      const bucket = buckets.get(key) ?? { total: 0, orderCount: 0 };
      days.push({ date: key, total: bucket.total, orderCount: bucket.orderCount });
      cursor.setDate(cursor.getDate() + 1);
    }

    return { from: from.toISOString(), to: to.toISOString(), days };
  }

  /**
   * Same day-bucketed shape as salesTrend, sourced from ShopifyOrder instead
   * of Order — company-wide by construction (no branchId filter; Shopify
   * orders aren't attributable to a branch). Uses currentTotalPrice (net of
   * refunds/edits) and excludes cancelled/voided orders, matching
   * channelComparison's online-total convention so the two stay consistent.
   */
  async onlineSalesTrend(query: OnlineSalesTrendQueryDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);

    const orders = await this.prisma.shopifyOrder.findMany({
      where: {
        cancelledAt: null,
        financialStatus: { not: "voided" },
        shopifyCreatedAt: { gte: from, lte: to },
      },
      select: { shopifyCreatedAt: true, currentTotalPrice: true },
    });

    const buckets = new Map<string, { total: number; orderCount: number }>();
    for (const order of orders) {
      const day = dayKey(order.shopifyCreatedAt);
      const bucket = buckets.get(day) ?? { total: 0, orderCount: 0 };
      bucket.total += Number(order.currentTotalPrice);
      bucket.orderCount += 1;
      buckets.set(day, bucket);
    }

    const days: Array<{ date: string; total: number; orderCount: number }> = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(to);
    endDay.setHours(0, 0, 0, 0);
    while (cursor <= endDay) {
      const key = dayKey(cursor);
      const bucket = buckets.get(key) ?? { total: 0, orderCount: 0 };
      days.push({ date: key, total: bucket.total, orderCount: bucket.orderCount });
      cursor.setDate(cursor.getDate() + 1);
    }

    return { from: from.toISOString(), to: to.toISOString(), days };
  }

  /**
   * Does NOT touch purchasing tables — joins OrderItem -> ProductVariant ->
   * Product.vendorId -> Vendor on EXISTING sales data (profit-per-line is
   * already unitPrice - costPriceSnapshot, fully computable today).
   * "Fetch rows, reduce in JS" — same convention as lowStock() — rather than
   * raw SQL.
   */
  async vendorPerformance(query: VendorPerformanceQueryDto) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        productVariant: {
          product: { vendorId: query.vendorId ? query.vendorId : { not: null } },
        },
        order: {
          ...(query.branchId ? { branchId: query.branchId } : {}),
          ...(query.from || query.to
            ? {
                createdAt: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(query.to) } : {}),
                },
              }
            : {}),
        },
      },
      include: { productVariant: { include: { product: { include: { vendor: true } } } } },
    });

    const byVendor = new Map<
      string,
      { vendorId: string; vendorCode: string; vendorName: string; unitsSold: number; revenue: number; cost: number; profit: number }
    >();
    const byProduct = new Map<
      string,
      { productId: string; productName: string; vendorId: string; vendorName: string; unitsSold: number; revenue: number; cost: number; profit: number }
    >();

    for (const item of items) {
      const product = item.productVariant.product;
      const vendor = product.vendor;
      if (!vendor) continue;

      const revenue = Number(item.lineTotal);
      const cost = Number(item.costPriceSnapshot) * item.quantity;
      const profit = revenue - cost;

      const v = byVendor.get(vendor.id) ?? {
        vendorId: vendor.id,
        vendorCode: vendor.code,
        vendorName: vendor.name,
        unitsSold: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
      v.unitsSold += item.quantity;
      v.revenue += revenue;
      v.cost += cost;
      v.profit += profit;
      byVendor.set(vendor.id, v);

      const p = byProduct.get(product.id) ?? {
        productId: product.id,
        productName: product.name,
        vendorId: vendor.id,
        vendorName: vendor.name,
        unitsSold: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
      p.unitsSold += item.quantity;
      p.revenue += revenue;
      p.cost += cost;
      p.profit += profit;
      byProduct.set(product.id, p);
    }

    return {
      byVendor: Array.from(byVendor.values()),
      byProduct: Array.from(byProduct.values()),
    };
  }

  /**
   * Online (Shopify) vs in-store (Order/OrderItem) sales, net of refunds on
   * both sides — "fetch rows, reduce in JS" idiom, same as vendorPerformance
   * above. In-store nets Order.total against that order's Σ
   * Return.totalRefundAmount (VOIDED orders excluded entirely); online uses
   * ShopifyOrder.currentTotalPrice, which Shopify itself already computes
   * net of refunds/edits, excluding cancelled/voided orders. branchId only
   * filters the in-store side — Shopify orders have no branch, so the
   * online figure is always company-wide.
   */
  async channelComparison(query: ChannelComparisonQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const dateWhere = (field: string) =>
      from || to ? { [field]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

    const orders = await this.prisma.order.findMany({
      where: {
        status: { not: "VOIDED" },
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...dateWhere("createdAt"),
      },
      select: {
        id: true,
        total: true,
        items: { select: { productVariantId: true, quantity: true, lineTotal: true } },
      },
    });

    const orderIds = orders.map((o) => o.id);
    const returns = orderIds.length
      ? await this.prisma.return.groupBy({
          by: ["orderId"],
          where: { orderId: { in: orderIds } },
          _sum: { totalRefundAmount: true },
        })
      : [];
    const refundByOrderId = new Map(returns.map((r) => [r.orderId, Number(r._sum.totalRefundAmount ?? 0)]));

    let inStoreTotal = 0;
    const inStoreByVariant = new Map<string, { quantity: number; revenue: number }>();
    for (const order of orders) {
      inStoreTotal += Number(order.total) - (refundByOrderId.get(order.id) ?? 0);
      for (const item of order.items) {
        const bucket = inStoreByVariant.get(item.productVariantId) ?? { quantity: 0, revenue: 0 };
        bucket.quantity += item.quantity;
        bucket.revenue += Number(item.lineTotal);
        inStoreByVariant.set(item.productVariantId, bucket);
      }
    }

    const shopifyOrders = await this.prisma.shopifyOrder.findMany({
      where: { cancelledAt: null, financialStatus: { not: "voided" }, ...dateWhere("shopifyCreatedAt") },
      select: {
        id: true,
        currentTotalPrice: true,
        items: { select: { productVariantId: true, sku: true, title: true, quantity: true, lineTotal: true } },
      },
    });

    let onlineTotal = 0;
    const onlineByVariant = new Map<string, { quantity: number; revenue: number }>();
    const unmatched = new Map<string, { sku: string | null; title: string; quantity: number; revenue: number }>();
    for (const order of shopifyOrders) {
      onlineTotal += Number(order.currentTotalPrice);
      for (const item of order.items) {
        const revenue = Number(item.lineTotal);
        if (item.productVariantId) {
          const bucket = onlineByVariant.get(item.productVariantId) ?? { quantity: 0, revenue: 0 };
          bucket.quantity += item.quantity;
          bucket.revenue += revenue;
          onlineByVariant.set(item.productVariantId, bucket);
        } else {
          const key = item.sku ?? item.title;
          const bucket = unmatched.get(key) ?? { sku: item.sku, title: item.title, quantity: 0, revenue: 0 };
          bucket.quantity += item.quantity;
          bucket.revenue += revenue;
          unmatched.set(key, bucket);
        }
      }
    }

    const variantIds = new Set([...inStoreByVariant.keys(), ...onlineByVariant.keys()]);
    const variants = variantIds.size
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: Array.from(variantIds) } },
          select: { id: true, sku: true, product: { select: { name: true } } },
        })
      : [];
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const bySku = Array.from(variantIds).map((variantId) => {
      const variant = variantMap.get(variantId);
      const inStore = inStoreByVariant.get(variantId) ?? { quantity: 0, revenue: 0 };
      const online = onlineByVariant.get(variantId) ?? { quantity: 0, revenue: 0 };
      return {
        productVariantId: variantId,
        sku: variant?.sku ?? variantId,
        productName: variant?.product.name ?? "",
        inStoreQuantity: inStore.quantity,
        inStoreRevenue: inStore.revenue,
        onlineQuantity: online.quantity,
        onlineRevenue: online.revenue,
      };
    });

    return {
      from: from?.toISOString(),
      to: to?.toISOString(),
      inStore: { orderCount: orders.length, total: inStoreTotal },
      online: { orderCount: shopifyOrders.length, total: onlineTotal },
      combined: inStoreTotal + onlineTotal,
      bySku,
      unmatchedShopifySkus: Array.from(unmatched.values()),
    };
  }

  /**
   * Simple AP subledger, computed on read — never a stored running balance:
   * outstanding = totalInvoiced - totalPaid - totalReturnCredits.
   * Invoice/payment totals use real groupBy() (mirroring the byPaymentMethod
   * idiom in salesSummary); PurchaseReturn has no scalar vendorId column of
   * its own (only via purchaseOrder.vendorId), which Prisma's groupBy can't
   * aggregate across a relation, so return credits are fetched and reduced
   * in JS instead.
   */
  async vendorBalances(query: VendorBalancesQueryDto) {
    const vendorWhere = query.vendorId ? { id: query.vendorId } : {};
    const invoiceWhere = { status: { not: "CANCELLED" as const }, ...(query.vendorId ? { vendorId: query.vendorId } : {}) };
    const paymentWhere = query.vendorId ? { vendorId: query.vendorId } : {};
    const returnWhere = query.vendorId ? { purchaseOrder: { vendorId: query.vendorId } } : {};

    const [vendors, invoiceGroups, paymentGroups, returns] = await Promise.all([
      this.prisma.vendor.findMany({ where: vendorWhere, orderBy: { name: "asc" } }),
      this.prisma.purchaseInvoice.groupBy({ by: ["vendorId"], where: invoiceWhere, _sum: { total: true } }),
      this.prisma.vendorPayment.groupBy({ by: ["vendorId"], where: paymentWhere, _sum: { amount: true } }),
      this.prisma.purchaseReturn.findMany({
        where: returnWhere,
        select: { totalCreditAmount: true, purchaseOrder: { select: { vendorId: true } } },
      }),
    ]);

    const invoicedMap = new Map(invoiceGroups.map((g) => [g.vendorId, Number(g._sum.total ?? 0)]));
    const paidMap = new Map(paymentGroups.map((g) => [g.vendorId, Number(g._sum.amount ?? 0)]));
    const returnCreditsMap = new Map<string, number>();
    for (const r of returns) {
      const vendorId = r.purchaseOrder.vendorId;
      returnCreditsMap.set(vendorId, (returnCreditsMap.get(vendorId) ?? 0) + Number(r.totalCreditAmount));
    }

    return vendors.map((vendor) => {
      const totalInvoiced = invoicedMap.get(vendor.id) ?? 0;
      const totalPaid = paidMap.get(vendor.id) ?? 0;
      const totalReturnCredits = returnCreditsMap.get(vendor.id) ?? 0;
      return {
        vendorId: vendor.id,
        vendorCode: vendor.code,
        vendorName: vendor.name,
        totalInvoiced,
        totalPaid,
        totalReturnCredits,
        outstanding: totalInvoiced - totalPaid - totalReturnCredits,
      };
    });
  }

  /**
   * journalLine.groupBy({by:['accountId'],_sum:{debit,credit}}), left-joined
   * in JS against the chart of accounts — same Map-join idiom salesSummary
   * already uses for byPaymentMethod. Footer asserts Σdebit=Σcredit.
   */
  async trialBalance(query: TrialBalanceQueryDto) {
    const journalWhere = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...dateRangeWhere(query.from, query.to),
    };

    const [groups, accounts] = await Promise.all([
      this.prisma.journalLine.groupBy({
        by: ["accountId"],
        where: { journalEntry: journalWhere },
        _sum: { debit: true, credit: true },
      }),
      this.prisma.account.findMany(),
    ]);

    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const rows = groups
      .map((g) => {
        const account = accountMap.get(g.accountId);
        return {
          accountId: g.accountId,
          code: account?.code ?? "",
          name: account?.name ?? "",
          type: account?.type ?? "",
          debit: Number(g._sum.debit ?? 0),
          credit: Number(g._sum.credit ?? 0),
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    const totalDebit = Math.round(rows.reduce((sum, r) => sum + r.debit, 0) * 100) / 100;
    const totalCredit = Math.round(rows.reduce((sum, r) => sum + r.credit, 0) * 100) / 100;

    return { rows, totalDebit, totalCredit, balanced: Math.round(totalDebit * 100) === Math.round(totalCredit * 100) };
  }

  /**
   * Same groupBy bucketed by account.type via the fixed sign convention
   * (typeBalance) — 4000 Sales Revenue and 4100 Sales Returns & Allowances
   * both being type REVENUE means they net automatically with zero special-
   * casing, so a Return actually reduces net revenue, not just gross.
   */
  async profitAndLoss(query: ProfitAndLossQueryDto) {
    const journalWhere = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...dateRangeWhere(query.from, query.to),
    };

    const [groups, accounts] = await Promise.all([
      this.prisma.journalLine.groupBy({
        by: ["accountId"],
        where: { journalEntry: journalWhere },
        _sum: { debit: true, credit: true },
      }),
      this.prisma.account.findMany({ where: { type: { in: ["REVENUE", "COGS", "EXPENSE"] } } }),
    ]);

    const sumsByAccount = new Map(groups.map((g) => [g.accountId, { debit: Number(g._sum.debit ?? 0), credit: Number(g._sum.credit ?? 0) }]));

    const revenue: Array<{ accountId: string; code: string; name: string; amount: number }> = [];
    const cogs: Array<{ accountId: string; code: string; name: string; amount: number }> = [];
    const expenses: Array<{ accountId: string; code: string; name: string; amount: number }> = [];

    for (const account of accounts) {
      const sums = sumsByAccount.get(account.id) ?? { debit: 0, credit: 0 };
      const amount = typeBalance(account.type, sums.debit, sums.credit);
      const row = { accountId: account.id, code: account.code, name: account.name, amount };
      if (account.type === "REVENUE") revenue.push(row);
      else if (account.type === "COGS") cogs.push(row);
      else expenses.push(row);
    }

    const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
    const totalCogs = cogs.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenses.reduce((sum, r) => sum + r.amount, 0);
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenses;

    return {
      revenue: { accounts: revenue.sort((a, b) => a.code.localeCompare(b.code)), total: totalRevenue },
      cogs: { accounts: cogs.sort((a, b) => a.code.localeCompare(b.code)), total: totalCogs },
      grossProfit,
      expenses: { accounts: expenses.sort((a, b) => a.code.localeCompare(b.code)), total: totalExpenses },
      netProfit,
    };
  }

  /**
   * Only an upper date bound (cumulative since inception, no period-closing
   * procedure — matches this codebase's "derived on read" philosophy).
   * Retained Earnings (account 3900) is never posted via a closing entry;
   * its displayed balance is always the COMPUTED Revenue-COGS-Expenses to
   * date, overriding whatever (normally zero) balance the ledger itself has
   * for that account.
   */
  async balanceSheet(query: BalanceSheetQueryDto) {
    const journalWhere = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.asOf ? { entryDate: { lte: new Date(query.asOf) } } : {}),
    };

    const [groups, accounts] = await Promise.all([
      this.prisma.journalLine.groupBy({
        by: ["accountId"],
        where: { journalEntry: journalWhere },
        _sum: { debit: true, credit: true },
      }),
      this.prisma.account.findMany(),
    ]);

    const sumsByAccount = new Map(groups.map((g) => [g.accountId, { debit: Number(g._sum.debit ?? 0), credit: Number(g._sum.credit ?? 0) }]));
    const balanceOf = (accountId: string, type: string) => {
      const sums = sumsByAccount.get(accountId) ?? { debit: 0, credit: 0 };
      return typeBalance(type, sums.debit, sums.credit);
    };

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalExpenses = 0;
    for (const account of accounts) {
      if (account.type === "REVENUE") totalRevenue += balanceOf(account.id, account.type);
      else if (account.type === "COGS") totalCogs += balanceOf(account.id, account.type);
      else if (account.type === "EXPENSE") totalExpenses += balanceOf(account.id, account.type);
    }
    const retainedEarningsComputed = totalRevenue - totalCogs - totalExpenses;

    const toRow = (account: (typeof accounts)[number]) => ({
      accountId: account.id,
      code: account.code,
      name: account.name,
      amount: account.code === "3900" ? retainedEarningsComputed : balanceOf(account.id, account.type),
    });

    const assets = accounts.filter((a) => a.type === "ASSET").map(toRow).sort((a, b) => a.code.localeCompare(b.code));
    const liabilities = accounts.filter((a) => a.type === "LIABILITY").map(toRow).sort((a, b) => a.code.localeCompare(b.code));
    const equity = accounts.filter((a) => a.type === "EQUITY").map(toRow).sort((a, b) => a.code.localeCompare(b.code));

    const totalAssets = assets.reduce((sum, r) => sum + r.amount, 0);
    const totalLiabilities = liabilities.reduce((sum, r) => sum + r.amount, 0);
    const totalEquity = equity.reduce((sum, r) => sum + r.amount, 0);

    return {
      asOf: query.asOf ?? null,
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      balanced: Math.round(totalAssets * 100) === Math.round((totalLiabilities + totalEquity) * 100),
    };
  }

  /**
   * Simple Cash Position (opening/movement/closing across the four cash-
   * equivalent accounts) — NOT a full Operating/Investing/Financing
   * statement, which this schema has no Bank/settlement concept to support
   * meaningfully.
   */
  async cashFlow(query: CashFlowQueryDto) {
    const cashAccounts = await this.prisma.account.findMany({ where: { code: { in: ["1000", "1010", "1020", "1030"] } } });
    const accountIds = cashAccounts.map((a) => a.id);

    const scopedWhere = (entryDateWhere?: Record<string, unknown>) => ({
      accountId: { in: accountIds },
      journalEntry: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(entryDateWhere ? { entryDate: entryDateWhere } : {}),
      },
    });

    const [openingGroups, closingGroups] = await Promise.all([
      query.from
        ? this.prisma.journalLine.groupBy({ by: ["accountId"], where: scopedWhere({ lt: new Date(query.from) }), _sum: { debit: true, credit: true } })
        : Promise.resolve([]),
      this.prisma.journalLine.groupBy({
        by: ["accountId"],
        where: scopedWhere(query.to ? { lte: new Date(query.to) } : undefined),
        _sum: { debit: true, credit: true },
      }),
    ]);

    const toBalanceMap = (groups: typeof openingGroups) => {
      const map = new Map<string, number>();
      for (const g of groups) map.set(g.accountId, Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0));
      return map;
    };
    const openingMap = toBalanceMap(openingGroups);
    const closingMap = toBalanceMap(closingGroups);

    const accountsRows = cashAccounts.map((a) => {
      const opening = openingMap.get(a.id) ?? 0;
      const closing = closingMap.get(a.id) ?? 0;
      return { accountId: a.id, code: a.code, name: a.name, opening, movement: closing - opening, closing };
    });

    return {
      accounts: accountsRows,
      opening: accountsRows.reduce((sum, r) => sum + r.opening, 0),
      movement: accountsRows.reduce((sum, r) => sum + r.movement, 0),
      closing: accountsRows.reduce((sum, r) => sum + r.closing, 0),
    };
  }

  /**
   * Derived from JournalLine (accounts 2100 VAT Payable / 1200 VAT
   * Receivable), never from raw Order.taxTotal — so it can never disagree
   * with the other JournalLine-sourced reports. Purely internal
   * bookkeeping, no ZATCA filing integration.
   */
  async vatSummary(query: VatSummaryQueryDto) {
    const journalWhere = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...dateRangeWhere(query.from, query.to),
    };

    const [vatPayableAccount, vatReceivableAccount] = await Promise.all([
      this.prisma.account.findUnique({ where: { code: "2100" } }),
      this.prisma.account.findUnique({ where: { code: "1200" } }),
    ]);

    const [payableAgg, receivableAgg] = await Promise.all([
      vatPayableAccount
        ? this.prisma.journalLine.aggregate({ where: { accountId: vatPayableAccount.id, journalEntry: journalWhere }, _sum: { debit: true, credit: true } })
        : null,
      vatReceivableAccount
        ? this.prisma.journalLine.aggregate({ where: { accountId: vatReceivableAccount.id, journalEntry: journalWhere }, _sum: { debit: true, credit: true } })
        : null,
    ]);

    // 2100 VAT Payable is credit-normal: Cr = VAT collected on sales, Dr = VAT reversed on returns.
    const vatCollected = Number(payableAgg?._sum.credit ?? 0);
    const vatCollectedReversed = Number(payableAgg?._sum.debit ?? 0);
    const netVatPayable = vatCollected - vatCollectedReversed;

    // 1200 VAT Receivable is debit-normal: Dr = VAT paid on purchase invoices, Cr = reversed on cancellations.
    const vatPaid = Number(receivableAgg?._sum.debit ?? 0);
    const vatPaidReversed = Number(receivableAgg?._sum.credit ?? 0);
    const netVatReceivable = vatPaid - vatPaidReversed;

    return {
      vatPayable: { collected: vatCollected, reversed: vatCollectedReversed, net: netVatPayable },
      vatReceivable: { paid: vatPaid, reversed: vatPaidReversed, net: netVatReceivable },
      netVatDue: netVatPayable - netVatReceivable,
    };
  }
}
