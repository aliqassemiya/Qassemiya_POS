import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { listAccounts } from "@/api/accounts";
import { listBranches } from "@/api/branches";
import { createExpense, listExpenses, type ExpenseInput } from "@/api/expenses";
import { listPaymentMethods } from "@/api/paymentMethods";
import { AccountType } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { useHasPermission } from "@/hooks/useHasPermission";
import { useAuthStore } from "@/store/authStore";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// No shared-types schema exists for Expense yet — see the note atop
// api/expenses.ts.
const expenseSchema = z.object({
  branchId: z.string().optional(),
  categoryAccountId: z.string().min(1, "Category is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  paidByMethodId: z.string().min(1, "Payment method is required"),
  expenseDate: z.string().min(1, "Date is required"),
  description: z.string().optional(),
});

function NewExpenseForm({ onCreated }: { onCreated: () => void }) {
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  // Category accounts are chart-of-accounts rows of type EXPENSE, per the plan.
  const expenseAccountsQuery = useQuery({
    queryKey: ["accounts", "type", AccountType.EXPENSE],
    queryFn: () => listAccounts({ type: AccountType.EXPENSE }),
  });
  const paymentMethodsQuery = useQuery({ queryKey: ["payment-methods"], queryFn: listPaymentMethods });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { branchId: activeBranchId ?? "", expenseDate: isoDate(new Date()) },
  });

  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: onCreated,
  });

  const onSubmit = (input: ExpenseInput) =>
    createMutation.mutate({
      ...input,
      branchId: input.branchId || undefined,
      expenseDate: new Date(input.expenseDate).toISOString(),
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <SelectField label="Branch (optional)" error={errors.branchId} {...register("branchId")}>
        <option value="">Company-wide</option>
        {branchesQuery.data?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Expense category" error={errors.categoryAccountId} {...register("categoryAccountId")}>
        <option value="">Select a category…</option>
        {expenseAccountsQuery.data?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Amount"
        type="number"
        step="0.01"
        error={errors.amount}
        {...register("amount", { valueAsNumber: true })}
      />
      <SelectField label="Paid by" error={errors.paidByMethodId} {...register("paidByMethodId")}>
        <option value="">Select a payment method…</option>
        {paymentMethodsQuery.data?.map((pm) => (
          <option key={pm.id} value={pm.id}>
            {pm.name}
          </option>
        ))}
      </SelectField>
      <TextField label="Date" type="date" error={errors.expenseDate} {...register("expenseDate")} />
      <TextField label="Description" error={errors.description} {...register("description")} />
      <Button type="submit" isLoading={createMutation.isPending}>
        Record expense
      </Button>
      {createMutation.isError && (
        <p className="text-xs text-red-600">Could not record the expense. Please try again.</p>
      )}
    </form>
  );
}

export function ExpensesPage() {
  const canManage = useHasPermission("expenses.manage");
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [branchId, setBranchId] = useState("");

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(isoDate(monthAgo));
  const [to, setTo] = useState(isoDate(today));

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });

  const expensesQuery = useQuery({
    queryKey: ["expenses", branchId, from, to],
    queryFn: () =>
      listExpenses({
        branchId: branchId || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
        {canManage && <Button onClick={() => setModalOpen(true)}>New expense</Button>}
      </div>

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
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={expensesQuery.isLoading}
          isError={expensesQuery.isError}
          error={expensesQuery.error}
          isEmpty={(expensesQuery.data?.length ?? 0) === 0}
          emptyMessage="No expenses match your filters."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Branch</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expensesQuery.data?.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-4 py-2 text-slate-600">{new Date(expense.expenseDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {expense.categoryAccount?.name ?? expense.categoryAccountId}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{expense.branch?.name ?? "Company-wide"}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{currency(expense.amount)}</td>
                  <td className="px-4 py-2 text-slate-600">{expense.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New expense">
        <NewExpenseForm
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["expenses"] });
            setModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
