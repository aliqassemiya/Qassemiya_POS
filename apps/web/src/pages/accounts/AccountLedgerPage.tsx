import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getAccountLedger } from "@/api/accounts";
import { listBranches } from "@/api/branches";
import { DataState } from "@/components/ui/DataState";
import { endOfDayIso } from "@/lib/dateRange";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function AccountLedgerPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [branchId, setBranchId] = useState("");

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(isoDate(monthAgo));
  const [to, setTo] = useState(isoDate(today));

  const ledgerQuery = useQuery({
    queryKey: ["accounts", id, "ledger", branchId, from, to],
    queryFn: () =>
      getAccountLedger(id as string, {
        branchId: branchId || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? endOfDayIso(to) : undefined,
      }),
    enabled: Boolean(id),
  });

  return (
    <DataState isLoading={ledgerQuery.isLoading} isError={ledgerQuery.isError} error={ledgerQuery.error}>
      {ledgerQuery.data && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate(-1)} className="mb-1 text-xs text-slate-500 underline">
                {t("accounts.ledger.back")}
              </button>
              <h1 className="text-2xl font-bold text-slate-900">
                {ledgerQuery.data.account.code} — {ledgerQuery.data.account.name}
              </h1>
              <p className="text-sm text-slate-500">
                {t("accounts.ledger.typeAndBalance", {
                  type: t(`accounts.types.${ledgerQuery.data.account.type}`),
                  normalBalance: t(`accounts.normalBalances.${ledgerQuery.data.account.normalBalance}`),
                })}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-right">
              <p className="text-xs text-slate-500">{t("accounts.ledger.balanceLabel")}</p>
              <p className="text-lg font-semibold text-slate-900">{currency(ledgerQuery.data.closingBalance)}</p>
            </div>
          </div>

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
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <DataState
              isLoading={false}
              isError={false}
              isEmpty={ledgerQuery.data.entries.length === 0}
              emptyMessage={t("accounts.ledger.empty")}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("accounts.ledger.dateColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("accounts.ledger.descriptionColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("accounts.ledger.sourceColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("accounts.ledger.debitColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("accounts.ledger.creditColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("accounts.ledger.balanceColumn")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerQuery.data.entries.map((entry, index) => (
                    <tr key={`${entry.journalEntryId}-${index}`}>
                      <td className="px-4 py-2 text-slate-600">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-slate-900">{entry.description}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {entry.sourceType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-900">{entry.debit ? currency(entry.debit) : "—"}</td>
                      <td className="px-4 py-2 text-slate-900">{entry.credit ? currency(entry.credit) : "—"}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{currency(entry.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataState>
          </div>
        </div>
      )}
    </DataState>
  );
}
