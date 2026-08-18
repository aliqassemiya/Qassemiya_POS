import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getVendorStatement } from "@/api/vendors";
import { DataState } from "@/components/ui/DataState";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

const TYPE_CLASSES: Record<string, string> = {
  INVOICE: "bg-amber-100 text-amber-700",
  PAYMENT: "bg-green-100 text-green-700",
  RETURN: "bg-blue-100 text-blue-700",
};

export function VendorStatementPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const statementQuery = useQuery({
    queryKey: ["vendors", id, "statement"],
    queryFn: () => getVendorStatement(id as string),
  });

  return (
    <DataState
      isLoading={statementQuery.isLoading}
      isError={statementQuery.isError}
      error={statementQuery.error}
    >
      {statementQuery.data && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate(-1)} className="mb-1 text-xs text-slate-500 underline">
                {t("vendors.statement.back")}
              </button>
              <h1 className="text-2xl font-bold text-slate-900">{statementQuery.data.vendor.name}</h1>
              <p className="text-sm text-slate-500">
                {statementQuery.data.vendor.code}
                {statementQuery.data.vendor.contactName ? ` · ${statementQuery.data.vendor.contactName}` : ""}
                {statementQuery.data.vendor.phone ? ` · ${statementQuery.data.vendor.phone}` : ""}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-right">
              <p className="text-xs text-slate-500">{t("vendors.statement.outstandingBalance")}</p>
              <p className="text-lg font-semibold text-slate-900">{currency(statementQuery.data.balance)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <DataState
              isLoading={false}
              isError={false}
              isEmpty={statementQuery.data.entries.length === 0}
              emptyMessage={t("vendors.statement.empty")}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("vendors.statement.dateColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("vendors.statement.typeColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("vendors.statement.referenceColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("vendors.statement.debitColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("vendors.statement.creditColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("vendors.statement.balanceColumn")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statementQuery.data.entries.map((entry, index) => (
                    <tr key={`${entry.type}-${entry.referenceId}-${index}`}>
                      <td className="px-4 py-2 text-slate-600">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            TYPE_CLASSES[entry.type] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {t(`vendors.statement.types.${entry.type}`)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{entry.referenceLabel ?? entry.referenceId.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-slate-900">{entry.debit ? currency(entry.debit) : "—"}</td>
                      <td className="px-4 py-2 text-slate-900">{entry.credit ? currency(entry.credit) : "—"}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{currency(entry.runningBalance)}</td>
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
