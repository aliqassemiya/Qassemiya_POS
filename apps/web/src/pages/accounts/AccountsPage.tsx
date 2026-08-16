import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";
import { createAccount, listAccounts, updateAccount, type AccountInput } from "@/api/accounts";
import { AccountType, NormalBalance, type Account } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { useHasPermission } from "@/hooks/useHasPermission";

// No shared-types schema exists for Account yet — mirrors the Account model
// fields described in the plan (code/name/nameAr/type/normalBalance/
// parentId/isActive), same convention as VendorsPage/BranchesPage.
const accountSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
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
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
          This is a system account. Its code, type, and system flag cannot be changed — only name/normal
          balance/parent/active status.
        </p>
      )}
      <TextField label="Code" disabled={isSystem} error={errors.code} {...register("code")} />
      <TextField label="Name" error={errors.name} {...register("name")} />
      <TextField label="Name (Arabic)" error={errors.nameAr} {...register("nameAr")} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Type" disabled={isSystem} error={errors.type} {...register("type")}>
          {Object.values(AccountType).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </SelectField>
        <SelectField label="Normal balance" error={errors.normalBalance} {...register("normalBalance")}>
          {Object.values(NormalBalance).map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </SelectField>
      </div>
      <SelectField label="Parent account (optional)" error={errors.parentId} {...register("parentId")}>
        <option value="">None</option>
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
        Active
      </label>
      <Button type="submit" isLoading={isPending}>
        Save
      </Button>
    </form>
  );
}

export function AccountsPage() {
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
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AccountInput }) => updateAccount(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setModalState({ open: false });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Chart of accounts</h1>
        {canManage && <Button onClick={() => setModalState({ open: true })}>New account</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code or name…"
          className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All types</option>
          {Object.values(AccountType).map((t) => (
            <option key={t} value={t}>
              {t}
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
          emptyMessage="No accounts yet."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Normal balance</th>
                <th className="px-4 py-2 font-medium">Status</th>
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
                        System
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        TYPE_CLASSES[account.type] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {account.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{account.normalBalance}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        account.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {account.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        to={`/accounts/${account.id}/ledger`}
                        className="text-sm font-medium text-slate-900 underline"
                      >
                        Ledger
                      </Link>
                      {canManage && (
                        <Button variant="ghost" onClick={() => setModalState({ open: true, account })}>
                          Edit
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
        title={modalState.account ? "Edit account" : "New account"}
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
