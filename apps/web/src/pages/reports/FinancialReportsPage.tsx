import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listBranches } from "@/api/branches";
import {
  getBalanceSheet,
  getCashFlow,
  getProfitAndLoss,
  getTrialBalance,
  getVatSummary,
} from "@/api/reports";
import { DataState } from "@/components/ui/DataState";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useAuthStore } from "@/store/authStore";
import { useUrlState } from "@/hooks/useUrlState";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function BalancedBadge({ balanced }: { balanced: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        balanced ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {balanced ? t("financialReports.balanced") : t("financialReports.outOfBalance")}
    </span>
  );
}

export function FinancialReportsPage() {
  const { t } = useTranslation();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [branchId, setBranchId] = useUrlState("branchId", activeBranchId ?? "");

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useUrlState("from", isoDate(monthAgo));
  const [to, setTo] = useUrlState("to", isoDate(today));
  const [asOf, setAsOf] = useUrlState("asOf", isoDate(today));

  const trialBalanceQuery = useQuery({
    queryKey: ["reports", "trial-balance", branchId, from, to],
    queryFn: () => getTrialBalance({ branchId: branchId || undefined, from, to }),
  });

  const profitAndLossQuery = useQuery({
    queryKey: ["reports", "profit-and-loss", branchId, from, to],
    queryFn: () => getProfitAndLoss({ branchId: branchId || undefined, from, to }),
  });

  const balanceSheetQuery = useQuery({
    queryKey: ["reports", "balance-sheet", branchId, asOf],
    queryFn: () => getBalanceSheet({ branchId: branchId || undefined, asOf }),
  });

  const cashFlowQuery = useQuery({
    queryKey: ["reports", "cash-flow", branchId, from, to],
    queryFn: () => getCashFlow({ branchId: branchId || undefined, from, to }),
  });

  const vatSummaryQuery = useQuery({
    queryKey: ["reports", "vat-summary", branchId, from, to],
    queryFn: () => getVatSummary({ branchId: branchId || undefined, from, to }),
  });

  const trialBalanceRows = (trialBalanceQuery.data?.rows ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    type: row.type,
    debit: row.debit,
    credit: row.credit,
  }));

  const profitAndLossRows = profitAndLossQuery.data
    ? [
        {
          revenue: profitAndLossQuery.data.revenue.total,
          cogs: profitAndLossQuery.data.cogs.total,
          grossProfit: profitAndLossQuery.data.grossProfit,
          expenses: profitAndLossQuery.data.expenses.total,
          netProfit: profitAndLossQuery.data.netProfit,
        },
      ]
    : [];

  const balanceSheetRows = balanceSheetQuery.data
    ? [
        ...balanceSheetQuery.data.assets.map((r) => ({ section: "Asset", code: r.code, name: r.name, amount: r.amount })),
        ...balanceSheetQuery.data.liabilities.map((r) => ({
          section: "Liability",
          code: r.code,
          name: r.name,
          amount: r.amount,
        })),
        ...balanceSheetQuery.data.equity.map((r) => ({ section: "Equity", code: r.code, name: r.name, amount: r.amount })),
      ]
    : [];

  const cashPositionRows = cashFlowQuery.data
    ? [{ opening: cashFlowQuery.data.opening, movement: cashFlowQuery.data.movement, closing: cashFlowQuery.data.closing }]
    : [];

  const vatSummaryRows = vatSummaryQuery.data
    ? [
        {
          vatCollected: vatSummaryQuery.data.vatPayable.collected,
          vatCollectedReversed: vatSummaryQuery.data.vatPayable.reversed,
          vatPayableNet: vatSummaryQuery.data.vatPayable.net,
          vatPaid: vatSummaryQuery.data.vatReceivable.paid,
          vatPaidReversed: vatSummaryQuery.data.vatReceivable.reversed,
          vatReceivableNet: vatSummaryQuery.data.vatReceivable.net,
          netVatDue: vatSummaryQuery.data.netVatDue,
        },
      ]
    : [];

  const trialBalanceHeaders = {
    code: t("financialReports.codeColumn"),
    name: t("financialReports.accountColumn"),
    type: t("financialReports.typeColumn"),
    debit: t("financialReports.debitColumn"),
    credit: t("financialReports.creditColumn"),
  };
  const profitAndLossHeaders = {
    revenue: t("financialReports.revenueLabel"),
    cogs: t("financialReports.cogsLabel"),
    grossProfit: t("financialReports.grossProfitLabel"),
    expenses: t("financialReports.expensesLabel"),
    netProfit: t("financialReports.netProfitLabel"),
  };
  const balanceSheetHeaders = {
    section: t("financialReports.sectionColumn"),
    code: t("financialReports.codeColumn"),
    name: t("financialReports.accountColumn"),
    amount: t("financialReports.amountColumn"),
  };
  const cashPositionHeaders = {
    opening: t("financialReports.openingLabel"),
    movement: t("financialReports.movementLabel"),
    closing: t("financialReports.closingLabel"),
  };
  const vatSummaryHeaders = {
    vatCollected: t("financialReports.vatCollectedColumn"),
    vatCollectedReversed: t("financialReports.vatCollectedReversedColumn"),
    vatPayableNet: t("financialReports.vatPayableNetColumn"),
    vatPaid: t("financialReports.vatPaidColumn"),
    vatPaidReversed: t("financialReports.vatPaidReversedColumn"),
    vatReceivableNet: t("financialReports.vatReceivableNetColumn"),
    netVatDue: t("financialReports.netVatDueColumn"),
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("financialReports.title")}</h1>

      <div className="flex flex-wrap items-end gap-3">
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">{t("common.allBranches")}</option>
          {branchesQuery.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("common.from")}</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("common.to")}</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("financialReports.asOfLabel")}</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      {/* Trial Balance */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">{t("financialReports.trialBalanceTitle")}</h2>
            {trialBalanceQuery.data && <BalancedBadge balanced={trialBalanceQuery.data.balanced} />}
          </div>
          <ExportMenu
            disabled={trialBalanceRows.length === 0}
            filename={`trial-balance-${from}-to-${to}`}
            sheetName="Trial balance"
            rows={trialBalanceRows}
            headers={trialBalanceHeaders}
          />
        </div>
        <DataState
          isLoading={trialBalanceQuery.isLoading}
          isError={trialBalanceQuery.isError}
          error={trialBalanceQuery.error}
          isEmpty={(trialBalanceQuery.data?.rows.length ?? 0) === 0}
          emptyMessage={t("financialReports.emptyTrialBalance")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">{t("financialReports.codeColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("financialReports.accountColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("financialReports.typeColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("financialReports.debitColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("financialReports.creditColumn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trialBalanceQuery.data?.rows.map((row) => (
                <tr key={row.accountId}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.code}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.name}</td>
                  <td className="px-3 py-2 text-slate-600">{t(`accounts.types.${row.type}`)}</td>
                  <td className="px-3 py-2">{currency(row.debit)}</td>
                  <td className="px-3 py-2">{currency(row.credit)}</td>
                </tr>
              ))}
            </tbody>
            {trialBalanceQuery.data && (
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>
                    {t("financialReports.totalsRow")}
                  </td>
                  <td className="px-3 py-2">{currency(trialBalanceQuery.data.totalDebit)}</td>
                  <td className="px-3 py-2">{currency(trialBalanceQuery.data.totalCredit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </DataState>
      </section>

      {/* Profit & Loss */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{t("financialReports.profitAndLossTitle")}</h2>
          <ExportMenu
            disabled={profitAndLossRows.length === 0}
            filename={`profit-and-loss-${from}-to-${to}`}
            sheetName="Profit and loss"
            rows={profitAndLossRows}
            headers={profitAndLossHeaders}
          />
        </div>
        <DataState
          isLoading={profitAndLossQuery.isLoading}
          isError={profitAndLossQuery.isError}
          error={profitAndLossQuery.error}
        >
          {profitAndLossQuery.data && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
                <div>
                  <p className="text-slate-500">{t("financialReports.revenueLabel")}</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {currency(profitAndLossQuery.data.revenue.total)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("financialReports.cogsLabel")}</p>
                  <p className="text-lg font-semibold text-slate-900">{currency(profitAndLossQuery.data.cogs.total)}</p>
                </div>
                <div>
                  <p className="text-slate-500">{t("financialReports.grossProfitLabel")}</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {currency(profitAndLossQuery.data.grossProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("financialReports.expensesLabel")}</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {currency(profitAndLossQuery.data.expenses.total)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("financialReports.netProfitLabel")}</p>
                  <p
                    className={`text-lg font-semibold ${
                      profitAndLossQuery.data.netProfit >= 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {currency(profitAndLossQuery.data.netProfit)}
                  </p>
                </div>
              </div>
              {profitAndLossQuery.data.revenue.accounts.length > 0 && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("financialReports.revenueAccountColumn")}</th>
                      <th className="px-3 py-2 font-medium">{t("financialReports.amountColumn")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profitAndLossQuery.data.revenue.accounts.map((line) => (
                      <tr key={line.accountId}>
                        <td className="px-3 py-2 text-slate-900">
                          {line.code} — {line.name}
                        </td>
                        <td className="px-3 py-2">{currency(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {profitAndLossQuery.data.expenses.accounts.length > 0 && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("financialReports.expenseAccountColumn")}</th>
                      <th className="px-3 py-2 font-medium">{t("financialReports.amountColumn")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profitAndLossQuery.data.expenses.accounts.map((line) => (
                      <tr key={line.accountId}>
                        <td className="px-3 py-2 text-slate-900">
                          {line.code} — {line.name}
                        </td>
                        <td className="px-3 py-2">{currency(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </DataState>
      </section>

      {/* Balance Sheet */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">{t("financialReports.balanceSheetTitle")}</h2>
            {balanceSheetQuery.data && <BalancedBadge balanced={balanceSheetQuery.data.balanced} />}
          </div>
          <ExportMenu
            disabled={balanceSheetRows.length === 0}
            filename={`balance-sheet-${asOf}`}
            sheetName="Balance sheet"
            rows={balanceSheetRows}
            headers={balanceSheetHeaders}
          />
        </div>
        <DataState
          isLoading={balanceSheetQuery.isLoading}
          isError={balanceSheetQuery.isError}
          error={balanceSheetQuery.error}
        >
          {balanceSheetQuery.data && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  {t("financialReports.sectionTotal", {
                    label: t("accounts.types.ASSET"),
                    total: currency(balanceSheetQuery.data.totalAssets),
                  })}
                </h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {balanceSheetQuery.data.assets.map((row) => (
                    <li key={row.accountId} className="flex justify-between py-1">
                      <span>{row.name}</span>
                      <span>{currency(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  {t("financialReports.sectionTotal", {
                    label: t("accounts.types.LIABILITY"),
                    total: currency(balanceSheetQuery.data.totalLiabilities),
                  })}
                </h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {balanceSheetQuery.data.liabilities.map((row) => (
                    <li key={row.accountId} className="flex justify-between py-1">
                      <span>{row.name}</span>
                      <span>{currency(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  {t("financialReports.sectionTotal", {
                    label: t("accounts.types.EQUITY"),
                    total: currency(balanceSheetQuery.data.totalEquity),
                  })}
                </h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {balanceSheetQuery.data.equity.map((row) => (
                    <li key={row.accountId} className="flex justify-between py-1">
                      <span>{row.name}</span>
                      <span>{currency(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </DataState>
      </section>

      {/* Cash Position */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{t("financialReports.cashPositionTitle")}</h2>
          <ExportMenu
            disabled={cashPositionRows.length === 0}
            filename={`cash-position-${from}-to-${to}`}
            sheetName="Cash position"
            rows={cashPositionRows}
            headers={cashPositionHeaders}
          />
        </div>
        <DataState isLoading={cashFlowQuery.isLoading} isError={cashFlowQuery.isError} error={cashFlowQuery.error}>
          {cashFlowQuery.data && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">{t("financialReports.openingLabel")}</p>
                  <p className="text-lg font-semibold text-slate-900">{currency(cashFlowQuery.data.opening)}</p>
                </div>
                <div>
                  <p className="text-slate-500">{t("financialReports.movementLabel")}</p>
                  <p
                    className={`text-lg font-semibold ${
                      cashFlowQuery.data.movement >= 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {currency(cashFlowQuery.data.movement)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("financialReports.closingLabel")}</p>
                  <p className="text-lg font-semibold text-slate-900">{currency(cashFlowQuery.data.closing)}</p>
                </div>
              </div>
              {cashFlowQuery.data.accounts.length > 0 && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("financialReports.accountColumn")}</th>
                      <th className="px-3 py-2 font-medium">{t("financialReports.openingLabel")}</th>
                      <th className="px-3 py-2 font-medium">{t("financialReports.movementLabel")}</th>
                      <th className="px-3 py-2 font-medium">{t("financialReports.closingLabel")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashFlowQuery.data.accounts.map((row) => (
                      <tr key={row.accountId}>
                        <td className="px-3 py-2 text-slate-900">
                          {row.code} — {row.name}
                        </td>
                        <td className="px-3 py-2">{currency(row.opening)}</td>
                        <td className="px-3 py-2">{currency(row.movement)}</td>
                        <td className="px-3 py-2">{currency(row.closing)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </DataState>
      </section>

      {/* VAT Summary */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{t("financialReports.vatSummaryTitle")}</h2>
          <ExportMenu
            disabled={vatSummaryRows.length === 0}
            filename={`vat-summary-${from}-to-${to}`}
            sheetName="VAT summary"
            rows={vatSummaryRows}
            headers={vatSummaryHeaders}
          />
        </div>
        <DataState
          isLoading={vatSummaryQuery.isLoading}
          isError={vatSummaryQuery.isError}
          error={vatSummaryQuery.error}
        >
          {vatSummaryQuery.data && (
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-slate-500">{t("financialReports.outputVatLabel")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {currency(vatSummaryQuery.data.vatPayable.net)}
                </p>
                <p className="text-xs text-slate-400">
                  {t("financialReports.vatCollectedBreakdown", {
                    collected: currency(vatSummaryQuery.data.vatPayable.collected),
                    reversed: currency(vatSummaryQuery.data.vatPayable.reversed),
                  })}
                </p>
              </div>
              <div>
                <p className="text-slate-500">{t("financialReports.inputVatLabel")}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {currency(vatSummaryQuery.data.vatReceivable.net)}
                </p>
                <p className="text-xs text-slate-400">
                  {t("financialReports.vatPaidBreakdown", {
                    paid: currency(vatSummaryQuery.data.vatReceivable.paid),
                    reversed: currency(vatSummaryQuery.data.vatReceivable.reversed),
                  })}
                </p>
              </div>
              <div>
                <p className="text-slate-500">{t("financialReports.netVatDueLabel")}</p>
                <p
                  className={`text-lg font-semibold ${
                    vatSummaryQuery.data.netVatDue >= 0 ? "text-slate-900" : "text-green-700"
                  }`}
                >
                  {currency(vatSummaryQuery.data.netVatDue)}
                </p>
              </div>
            </div>
          )}
        </DataState>
      </section>
    </div>
  );
}
