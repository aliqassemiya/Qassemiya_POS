import { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { listAccounts } from "@/api/accounts";
import { listBranches } from "@/api/branches";
import {
  createJournalEntry,
  listJournalEntries,
  type CreateJournalEntryInput,
} from "@/api/journal-entries";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Pagination } from "@/components/ui/Pagination";
import { useHasPermission } from "@/hooks/useHasPermission";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";
import { useUrlState, useUrlNumberState } from "@/hooks/useUrlState";

const PAGE_SIZE = 50;

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// No shared-types schema exists for JournalEntry yet — see the note atop
// api/journal-entries.ts. The balance invariant (Σdebit = Σcredit) is also
// enforced client-side here (disabling submit until balanced) as a UX
// nicety — the API is the real source of truth and re-validates it.
function buildJournalEntrySchema(t: (key: string) => string) {
  const journalLineSchema = z.object({
    accountId: z.string().min(1, t("journalEntries.accountRequired")),
    debit: z.coerce.number().nonnegative().default(0),
    credit: z.coerce.number().nonnegative().default(0),
    description: z.string().optional(),
  });

  return z.object({
    entryDate: z.string().min(1, t("journalEntries.dateRequired")),
    description: z.string().min(1, t("journalEntries.descriptionRequired")),
    branchId: z.string().optional(),
    lines: z.array(journalLineSchema).min(2, t("journalEntries.linesMinTwo")),
  });
}

function NewEntryForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: () => listAccounts() });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });

  const journalEntrySchema = useMemo(() => buildJournalEntrySchema(t), [t]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateJournalEntryInput>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      entryDate: isoDate(new Date()),
      description: "",
      branchId: "",
      lines: [
        { accountId: "", debit: 0, credit: 0, description: "" },
        { accountId: "", debit: 0, credit: 0, description: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchedLines = watch("lines");
  const totalDebit = watchedLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = watchedLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  // Round to cents before comparing to avoid floating-point false negatives.
  const isBalanced =
    Math.round(totalDebit * 100) === Math.round(totalCredit * 100) && totalDebit > 0;

  const createMutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: () => {
      onCreated();
      toast.success(t("journalEntries.posted"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("journalEntries.postFailedToast"))),
  });

  const onSubmit = (input: CreateJournalEntryInput) =>
    createMutation.mutate({
      ...input,
      entryDate: new Date(input.entryDate).toISOString(),
      branchId: input.branchId || undefined,
      lines: input.lines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || undefined,
      })),
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t("journalEntries.dateLabel")}
          type="date"
          error={errors.entryDate}
          {...register("entryDate")}
        />
        <SelectField
          label={t("journalEntries.branchOptionalLabel")}
          error={errors.branchId}
          {...register("branchId")}
        >
          <option value="">{t("journalEntries.companyWide")}</option>
          {branchesQuery.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
      </div>
      <TextField
        label={t("journalEntries.descriptionLabel")}
        error={errors.description}
        {...register("description")}
      />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-700">{t("journalEntries.linesLabel")}</h3>
        {errors.lines?.message && <p className="text-xs text-red-600">{errors.lines.message}</p>}
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-cols-[1fr_6rem_6rem_auto] items-end gap-2 rounded-md border border-slate-100 p-3"
          >
            <SelectField
              label={t("journalEntries.accountLabel")}
              error={errors.lines?.[index]?.accountId}
              {...register(`lines.${index}.accountId` as const)}
            >
              <option value="">{t("journalEntries.accountSelectPlaceholder")}</option>
              {accountsQuery.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t("journalEntries.debitLabel")}
              type="number"
              step="0.01"
              error={errors.lines?.[index]?.debit}
              {...register(`lines.${index}.debit` as const, { valueAsNumber: true })}
            />
            <TextField
              label={t("journalEntries.creditLabel")}
              type="number"
              step="0.01"
              error={errors.lines?.[index]?.credit}
              {...register(`lines.${index}.credit` as const, { valueAsNumber: true })}
            />
            <Button
              type="button"
              variant="ghost"
              disabled={fields.length <= 2}
              onClick={() => remove(index)}
            >
              {t("journalEntries.removeButton")}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => append({ accountId: "", debit: 0, credit: 0, description: "" })}
        >
          {t("journalEntries.addLineButton")}
        </Button>
      </div>

      <div
        className={`flex items-center justify-between rounded-md p-3 text-sm ${
          isBalanced ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        <span>
          {t("journalEntries.totalsSummary", {
            debitTotal: currency(totalDebit),
            creditTotal: currency(totalCredit),
          })}
        </span>
        <span className="font-medium">
          {isBalanced ? t("journalEntries.balanced") : t("journalEntries.notBalanced")}
        </span>
      </div>

      <Button type="submit" isLoading={createMutation.isPending} disabled={!isBalanced}>
        {t("journalEntries.postEntryButton")}
      </Button>
      {createMutation.isError && (
        <p className="text-xs text-red-600">{t("journalEntries.postEntryFailedInline")}</p>
      )}
    </form>
  );
}

export function JournalEntriesPage() {
  const { t } = useTranslation();
  const canManage = useHasPermission("journal.manage");
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [branchId, setBranchId] = useUrlState("branchId");
  const [sourceType, setSourceType] = useUrlState("sourceType");

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useUrlState("from", isoDate(monthAgo));
  const [to, setTo] = useUrlState("to", isoDate(today));
  const [page, setPage] = useUrlNumberState("page", 1);

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });

  const entriesQuery = useQuery({
    queryKey: ["journal-entries", branchId, sourceType, from, to, page],
    queryFn: () =>
      listJournalEntries({
        branchId: branchId || undefined,
        sourceType: sourceType || undefined,
        // Plain "YYYY-MM-DD" -- the API resolves this to the correct
        // Riyadh-local day boundary itself (see date-range.ts server-side).
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });
  const journalEntries = entriesQuery.data?.data ?? [];
  const totalCount = entriesQuery.data?.totalCount ?? 0;

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1);
      setter(v);
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("journalEntries.title")}</h1>
        {canManage && <Button onClick={() => setModalOpen(true)}>{t("journalEntries.newManualEntry")}</Button>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <select
          value={branchId}
          onChange={(e) => resetToFirstPage(setBranchId)(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">{t("common.allBranches")}</option>
          {branchesQuery.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          value={sourceType}
          onChange={(e) => resetToFirstPage(setSourceType)(e.target.value)}
          placeholder={t("journalEntries.sourceTypePlaceholder")}
          className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("common.from")}</label>
          <input
            type="date"
            value={from}
            onChange={(e) => resetToFirstPage(setFrom)(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("common.to")}</label>
          <input
            type="date"
            value={to}
            onChange={(e) => resetToFirstPage(setTo)(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={entriesQuery.isLoading}
          isError={entriesQuery.isError}
          error={entriesQuery.error}
          isEmpty={journalEntries.length === 0}
          emptyMessage={t("journalEntries.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("journalEntries.dateColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("journalEntries.descriptionColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("journalEntries.sourceColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("journalEntries.totalDebitColumn")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {journalEntries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 text-slate-600">{new Date(entry.entryDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{entry.description}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {entry.sourceType}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-900">
                    {currency(entry.lines.reduce((sum, l) => sum + l.debit, 0))}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/journal-entries/${entry.id}`} className="text-sm font-medium text-slate-900 underline">
                      {t("common.view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("journalEntries.newEntryModalTitle")}>
        <NewEntryForm
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
            setModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
