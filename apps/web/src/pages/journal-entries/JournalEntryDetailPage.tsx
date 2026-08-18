import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getJournalEntry } from "@/api/journal-entries";
import { DataState } from "@/components/ui/DataState";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

export function JournalEntryDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const entryQuery = useQuery({
    queryKey: ["journal-entries", id],
    queryFn: () => getJournalEntry(id as string),
  });

  const totalDebit = entryQuery.data?.lines.reduce((sum, l) => sum + l.debit, 0) ?? 0;
  const totalCredit = entryQuery.data?.lines.reduce((sum, l) => sum + l.credit, 0) ?? 0;

  return (
    <DataState isLoading={entryQuery.isLoading} isError={entryQuery.isError} error={entryQuery.error}>
      {entryQuery.data && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate(-1)} className="mb-1 text-xs text-slate-500 underline">
                {t("journalEntries.detail.back")}
              </button>
              <h1 className="text-2xl font-bold text-slate-900">{entryQuery.data.description}</h1>
              <p className="text-sm text-slate-500">
                {new Date(entryQuery.data.entryDate).toLocaleDateString()}
                {entryQuery.data.branch
                  ? ` · ${entryQuery.data.branch.name}`
                  : ` · ${t("journalEntries.detail.companyWide")}`}
                {entryQuery.data.reversalOfEntryId ? ` · ${t("journalEntries.detail.reversalSuffix")}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {entryQuery.data.sourceType}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("journalEntries.detail.accountColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("journalEntries.detail.descriptionColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("journalEntries.detail.debitColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("journalEntries.detail.creditColumn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entryQuery.data.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {line.account ? `${line.account.code} — ${line.account.name}` : line.accountId}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{line.description ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-900">{line.debit ? currency(line.debit) : "—"}</td>
                    <td className="px-4 py-2 text-slate-900">{line.credit ? currency(line.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td className="px-4 py-2" colSpan={2}>
                    {t("journalEntries.detail.totalsLabel")}
                  </td>
                  <td className="px-4 py-2">{currency(totalDebit)}</td>
                  <td className="px-4 py-2">{currency(totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </DataState>
  );
}
