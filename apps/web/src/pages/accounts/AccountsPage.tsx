import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { createAccount, listAccounts, updateAccount, type AccountInput } from "@/api/accounts";
import { AccountType, NormalBalance, type Account } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { useHasPermission } from "@/hooks/useHasPermission";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

// No shared-types schema exists for Account yet — mirrors the Account model
// fields described in the plan (code/name/nameAr/type/normalBalance/
// parentId/isActive), same convention as VendorsPage/BranchesPage.
function buildAccountSchema(t: (key: string) => string) {
  return z.object({
    code: z.string().min(1, t("accounts.codeRequired")),
    name: z.string().min(1, t("accounts.nameRequired")),
    nameAr: z.string().optional(),
    type: z.enum([
      AccountType.ASSET,
      AccountType.LIABILITY,
      AccountType.EQUITY,
      AccountType.REVENUE,
      AccountType.EXPENSE,
      AccountType.COGS,
    ]),
    normalBalance: z.enum([NormalBalance.DEBIT, NormalBalance.CREDIT]),
    parentId: z.string().optional(),
    isActive: z.boolean().default(true),
  });
}

const TYPE_CLASSES: Record<string, string> = {
  ASSET: "bg-blue-100 text-blue-700",
  LIABILITY: "bg-amber-100 text-amber-700",
  EQUITY: "bg-purple-100 text-purple-700",
  REVENUE: "bg-green-100 text-green-700",
  EXPENSE: "bg-red-100 text-red-700",
  COGS: "bg-orange-100 text-orange-700",
};

function AccountForm({
  initial,
  accounts,
  onSubmit,
  isPending,
}: {
  initial?: Account;
  accounts: Account[];
  onSubmit: (input: AccountInput) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const accountSchema = useMemo(() => buildAccountSchema(t), [t]);
  const isSystem = initial?.isSystem ?? false;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: initial
      ? {
          code: initial.code,
          name: initial.name,
          nameAr: initial.nameAr ?? "",
          type: initial.type,
          normalBalance: initial.normalBalance,
          parentId: initial.parentId ?? "",
          isActive: initial.isActive,
        }
      : { type: AccountType.EXPENSE, normalBalance: NormalBalance.DEBIT, isActive: true },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {isSystem && (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">{t("accounts.systemAccountNotice")}</p>
      )}
      <TextField label={t("accounts.codeLabel")} disabled={isSystem} error={errors.code} {...register("code")} />
      <TextField label={t("common.name")} error={errors.name} {...register("name")} />
      <TextField label={t("accounts.nameArabicLabel")} error={errors.nameAr} {...register("nameAr")} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t("accounts.typeLabel")} disabled={isSystem} error={errors.type} {...register("type")}>
          {Object.values(AccountType).map((type) => (
            <option key={type} value={type}>
              {t(`accounts.types.${type}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("accounts.normalBalanceLabel")} error={errors.normalBalance} {...register("normalBalance")}>
          {Object.values(NormalBalance).map((b) => (
            <option key={b} value={b}>
              {t(`accounts.normalBalances.${b}`)}
            </option>
          ))}
        </SelectField>
      </div>
      <SelectField label={t("accounts.parentAccountLabel")} error={errors.parentId} {...register("parentId")}>
        <option value="">{t("accounts.noneOption")}</option>
        {accounts
          .filter((a) => a.id !== initial?.id)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
      </SelectField>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" {...register("isActive")} />
        {t("common.active")}
      </label>
      <Button type="submit" isLoading={isPending}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function AccountsPage() {
  const { t } = useTranslation();
  const canManage = useHasPermission("accounts.manage");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalState, setModalState] = useState<{ open: boolean; account?: Account }>({ open: false });

  const accountsQuery = useQuery({
    queryKey: ["accounts", search, typeFilter],
    queryFn: () =>
      listAccounts({
        search: search || undefined,
        type: (typeFilter || undefined) as AccountType | undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setModalState({ open: false });
      toast.success(t("accounts.created"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("accounts.createFailed"))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AccountInput }) => updateAccount(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setModalState({ open: false });
      toast.success(t("accounts.updated"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("accounts.updateFailed"))),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("accounts.title")}</h1>
        {canManage && <Button onClick={() => setModalState({ open: true })}>{t("accounts.newAccount")}</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("accounts.searchPlaceholder")}
          className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">{t("accounts.allTypes")}</option>
          {Object.values(AccountType).map((type) => (
            <option key={type} value={type}>
              {t(`accounts.types.${type}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={accountsQuery.isLoading}
          isError={accountsQuery.isError}
          error={accountsQuery.error}
          isEmpty={(accountsQuery.data?.length ?? 0) === 0}
          emptyMessage={t("accounts.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("accounts.codeLabel")}</th>
                <th className="px-4 py-2 font-medium">{t("common.name")}</th>
                <th className="px-4 py-2 font-medium">{t("accounts.typeLabel")}</th>
                <th className="px-4 py-2 font-medium">{t("accounts.normalBalanceLabel")}</th>
                <th className="px-4 py-2 font-medium">{t("common.status")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accountsQuery.data?.map((account) => (
                <tr key={account.id}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{account.code}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {account.name}
                    {account.isSystem && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {t("accounts.systemBadge")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        TYPE_CLASSES[account.type] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {t(`accounts.types.${account.type}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{t(`accounts.normalBalances.${account.normalBalance}`)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        account.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {account.isActive ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        to={`/accounts/${account.id}/ledger`}
                        className="text-sm font-medium text-slate-900 underline"
                      >
                        {t("accounts.ledgerLink")}
                      </Link>
                      {canManage && (
                        <Button variant="ghost" onClick={() => setModalState({ open: true, account })}>
                          {t("common.edit")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal
        open={modalState.open}
        onClose={() => setModalState({ open: false })}
        title={modalState.account ? t("accounts.editAccount") : t("accounts.newAccount")}
      >
        <AccountForm
          initial={modalState.account}
          accounts={accountsQuery.data ?? []}
          isPending={createMutation.isPending || updateMutation.isPending}
          onSubmit={(input) =>
            modalState.account
              ? updateMutation.mutate({ id: modalState.account.id, input })
              : createMutation.mutate(input)
          }
        />
      </Modal>
    </div>
  );
}
