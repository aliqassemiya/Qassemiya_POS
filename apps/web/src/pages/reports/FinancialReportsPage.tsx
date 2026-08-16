import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listBranches } from "@/api/branches";
import {
  getBalanceSheet,
  getCashFlow,
  getProfitAndLoss,
  getTrialBalance,
  getVatSummary,
} from "@/api/reports";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";
import { downloadCsv } from "@/lib/csv";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function BalancedBadge({ balanced }: { balanced: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        balanced ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {balanced ? "Balanced" : "Out of balance"}
    </span>
  );
}

export function FinancialReportsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [branchId, setBranchId] = useState(activeBranchId ?? "");

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(isoDate(monthAgo));
  const [to, setTo] = useState(isoDate(today));
  const [asOf, setAsOf] = useState(isoDate(today));

  const fromIso = new Date(from).toISOString();
  const toIso = new Date(to).toISOString();
  const asOfIso = new Date(asOf).toISOString();

  const trialBalanceQuery = useQuery({
    queryKey: ["reports", "trial-balance", branchId, from, to],
    queryFn: () => getTrialBalance({ branchId: branchId || undefined, from: fromIso, to: toIso }),
  });

  const profitAndLossQuery = useQuery({
    queryKey: ["reports", "profit-and-loss", branchId, from, to],
    queryFn: () => getProfitAndLoss({ branchId: branchId || undefined, from: fromIso, to: toIso }),
  });

  const balanceSheetQuery = useQuery({
    queryKey: ["reports", "balance-sheet", branchId, asOf],
    queryFn: () => getBalanceSheet({ branchId: branchId || undefined, asOf: asOfIso }),
  });

  const cashFlowQuery = useQuery({
    queryKey: ["reports", "cash-flow", branchId, from, to],
    queryFn: () => getCashFlow({ branchId: branchId || undefined, from: fromIso, to: toIso }),
  });

  const vatSummaryQuery = useQuery({
    queryKey: ["reports", "vat-summary", branchId, from, to],
    queryFn: () => getVatSummary({ branchId: branchId || undefined, from: fromIso, to: toIso }),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Finance reports</h1>

      <div className="flex flex-wrap items-end gap-3">
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All branches</option>
          {branchesQuery.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Balance sheet as of</label>
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
            <h2 className="text-sm font-semibold text-slate-700">Trial balance</h2>
            {trialBalanceQuery.data && <BalancedBadge balanced={trialBalanceQuery.data.balanced} />}
          </div>
          <Button
            variant="secondary"
            disabled={!trialBalanceQuery.data?.rows.length}
            onClick={() =>
              trialBalanceQuery.data &&
              downloadCsv(
                `trial-balance-${from}-to-${to}.csv`,
                trialBalanceQuery.data.rows.map((row) => ({
                  code: row.code,
                  name: row.name,
                  type: row.type,
                  debit: row.debit,
                  credit: row.credit,
                })),
              )
            }
          >
            Export CSV
          </Button>
        </div>
        <DataState
          isLoading={trialBalanceQuery.isLoading}
          isError={trialBalanceQuery.isError}
          error={trialBalanceQuery.error}
          isEmpty={(trialBalanceQuery.data?.rows.length ?? 0) === 0}
          emptyMessage="No journal activity in this period yet."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Debit</th>
                <th className="px-3 py-2 font-medium">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trialBalanceQuery.data?.rows.map((row) => (
                <tr key={row.accountId}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.code}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.name}</td>
                  <td className="px-3 py-2 text-slate-600">{row.type}</td>
                  <td className="px-3 py-2">{currency(row.debit)}</td>
                  <td className="px-3 py-2">{currency(row.credit)}</td>
                </tr>
              ))}
            </tbody>
            {trialBalanceQuery.data && (
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>
                    Totals
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
          <h2 className="text-sm font-semibold text-slate-700">Profit &amp; loss</h2>
          <Button
            variant="secondary"
            disabled={!profitAndLossQuery.data}
            onClick={() =>
              profitAndLossQuery.data &&
              downloadCsv(`profit-and-loss-${from}-to-${to}.csv`, [
                {
                  revenue: profitAndLossQuery.data.revenue.total,
                  cogs: profitAndLossQuery.data.cogs.total,
                  grossProfit: profitAndLossQuery.data.grossProfit,
                  expenses: profitAndLossQuery.data.expenses.total,
                  netProfit: profitAndLossQuery.data.netProfit,
                },
              ])
            }
          >
            Export CSV
          </Button>
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
                  <p className="text-slate-500">Revenue</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {currency(profitAndLossQuery.data.revenue.total)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">COGS</p>
                  <p className="text-lg font-semibold text-slate-900">{currency(profitAndLossQuery.data.cogs.total)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Gross profit</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {currency(profitAndLossQuery.data.grossProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Expenses</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {currency(profitAndLossQuery.data.expenses.total)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Net profit</p>
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
                      <th className="px-3 py-2 font-medium">Revenue account</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
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
                      <th className="px-3 py-2 font-medium">Expense account</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
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
            <h2 className="text-sm font-semibold text-slate-700">Balance sheet</h2>
            {balanceSheetQuery.data && <BalancedBadge balanced={balanceSheetQuery.data.balanced} />}
          </div>
          <Button
            variant="secondary"
            disabled={!balanceSheetQuery.data}
            onClick={() =>
              balanceSheetQuery.data &&
              downloadCsv(`balance-sheet-${asOf}.csv`, [
                ...balanceSheetQuery.data.assets.map((r) => ({ section: "Asset", code: r.code, name: r.name, amount: r.amount })),
                ...balanceSheetQuery.data.liabilities.map((r) => ({
                  section: "Liability",
                  code: r.code,
                  name: r.name,
                  amount: r.amount,
                })),
                ...balanceSheetQuery.data.equity.map((r) => ({ section: "Equity", code: r.code, name: r.name, amount: r.amount })),
              ])
            }
          >
            Export CSV
          </Button>
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
                  Assets — {currency(balanceSheetQuery.data.totalAssets)}
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
                  Liabilities — {currency(balanceSheetQuery.data.totalLiabilities)}
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
                  Equity — {currency(balanceSheetQuery.data.totalEquity)}
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
          <h2 className="text-sm font-semibold text-slate-700">Cash position</h2>
          <Button
            variant="secondary"
            disabled={!cashFlowQuery.data}
            onClick={() =>
              cashFlowQuery.data &&
              downloadCsv(`cash-position-${from}-to-${to}.csv`, [
                { opening: cashFlowQuery.data.opening, movement: cashFlowQuery.data.movement, closing: cashFlowQuery.data.closing },
              ])
            }
          >
            Export CSV
          </Button>
        </div>
        <DataState isLoading={cashFlowQuery.isLoading} isError={cashFlowQuery.isError} error={cashFlowQuery.error}>
          {cashFlowQuery.data && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Opening</p>
                  <p className="text-lg font-semibold text-slate-900">{currency(cashFlowQuery.data.opening)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Movement</p>
                  <p
                    className={`text-lg font-semibold ${
                      cashFlowQuery.data.movement >= 0 ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {currency(cashFlowQuery.data.movement)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Closing</p>
                  <p className="text-lg font-semibold text-slate-900">{currency(cashFlowQuery.data.closing)}</p>
                </div>
              </div>
              {cashFlowQuery.data.accounts.length > 0 && (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Account</th>
                      <th className="px-3 py-2 font-medium">Opening</th>
                      <th className="px-3 py-2 font-medium">Movement</th>
                      <th className="px-3 py-2 font-medium">Closing</th>
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
          <h2 className="text-sm font-semibold text-slate-700">VAT summary</h2>
          <Button
            variant="secondary"
            disabled={!vatSummaryQuery.data}
            onClick={() =>
              vatSummaryQuery.data &&
              downloadCsv(`vat-summary-${from}-to-${to}.csv`, [
                {
                  vatCollected: vatSummaryQuery.data.vatPayable.collected,
                  vatCollectedReversed: vatSummaryQuery.data.vatPayable.reversed,
                  vatPayableNet: vatSummaryQuery.data.vatPayable.net,
                  vatPaid: vatSummaryQuery.data.vatReceivable.paid,
                  vatPaidReversed: vatSummaryQuery.data.vatReceivable.reversed,
                  vatReceivableNet: vatSummaryQuery.data.vatReceivable.net,
                  netVatDue: vatSummaryQuery.data.netVatDue,
                },
              ])
            }
          >
            Export CSV
          </Button>
        </div>
        <DataState
          isLoading={vatSummaryQuery.isLoading}
          isError={vatSummaryQuery.isError}
          error={vatSummaryQuery.error}
        >
          {vatSummaryQuery.data && (
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-slate-500">Output VAT (collected on sales)</p>
                <p className="text-lg font-semibold text-slate-900">
                  {currency(vatSummaryQuery.data.vatPayable.net)}
                </p>
                <p className="text-xs text-slate-400">
                  {currency(vatSummaryQuery.data.vatPayable.collected)} collected − {currency(vatSummaryQuery.data.vatPayable.reversed)} reversed (returns)
                </p>
              </div>
              <div>
                <p className="text-slate-500">Input VAT (paid on purchases)</p>
                <p className="text-lg font-semibold text-slate-900">
                  {currency(vatSummaryQuery.data.vatReceivable.net)}
                </p>
                <p className="text-xs text-slate-400">
                  {currency(vatSummaryQuery.data.vatReceivable.paid)} paid − {currency(vatSummaryQuery.data.vatReceivable.reversed)} reversed (purchase returns)
                </p>
              </div>
              <div>
                <p className="text-slate-500">Net VAT due</p>
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
