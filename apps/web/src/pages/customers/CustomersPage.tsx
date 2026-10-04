import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { createCustomer, listCustomers, updateCustomer, type CustomerInput } from "@/api/customers";
import type { Customer } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Pagination } from "@/components/ui/Pagination";
import { useHasPermission } from "@/hooks/useHasPermission";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

const PAGE_SIZE = 50;

// No shared-types schema exists for Customer yet — kept local, mirroring the
// Customer model fields described in the plan.
function buildCustomerSchema(t: (key: string) => string) {
  return z.object({
    fullName: z.string().min(1, t("customers.nameRequired")),
    phone: z.string().min(1, t("customers.phoneRequired")),
    email: z.string().email(t("customers.invalidEmail")).optional().or(z.literal("")),
    notes: z.string().optional(),
  });
}

function CustomerForm({
  initial,
  onSubmit,
  isPending,
}: {
  initial?: Customer;
  onSubmit: (input: CustomerInput) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const customerSchema = useMemo(() => buildCustomerSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: initial
      ? { fullName: initial.fullName, phone: initial.phone ?? "", email: initial.email ?? "", notes: initial.notes ?? "" }
      : {},
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField label={t("customers.fullNameLabel")} error={errors.fullName} {...register("fullName")} />
      <TextField label={t("customers.phoneLabel")} error={errors.phone} {...register("phone")} />
      <TextField label={t("customers.emailLabel")} type="email" error={errors.email} {...register("email")} />
      <TextField label={t("customers.notesLabel")} error={errors.notes} {...register("notes")} />
      <Button type="submit" isLoading={isPending}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function CustomersPage() {
  const { t } = useTranslation();
  const canManage = useHasPermission("customers.manage");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState<{ open: boolean; customer?: Customer }>({ open: false });

  const customersQuery = useQuery({
    queryKey: ["customers", search, page],
    queryFn: () => listCustomers({ search: search || undefined, page, pageSize: PAGE_SIZE }),
  });
  const customers = customersQuery.data?.data ?? [];
  const totalCount = customersQuery.data?.totalCount ?? 0;

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setModalState({ open: false });
      toast.success(t("customers.created"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("customers.createFailed"))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerInput }) => updateCustomer(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setModalState({ open: false });
      toast.success(t("customers.updated"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("customers.updateFailed"))),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("customers.title")}</h1>
        {canManage && <Button onClick={() => setModalState({ open: true })}>{t("customers.newCustomer")}</Button>}
      </div>

      <input
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
        placeholder={t("customers.searchPlaceholder")}
        className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={customersQuery.isLoading}
          isError={customersQuery.isError}
          error={customersQuery.error}
          isEmpty={customers.length === 0}
          emptyMessage={t("customers.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("common.name")}</th>
                <th className="px-4 py-2 font-medium">{t("common.phone")}</th>
                <th className="px-4 py-2 font-medium">{t("common.email")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{c.fullName}</td>
                  <td className="px-4 py-2 text-slate-600">{c.phone ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{c.email ?? "—"}</td>
                  <td className="flex justify-end gap-2 px-4 py-2 text-right">
                    <Link
                      to={`/customers/${c.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-transparent px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      {t("common.view")}
                    </Link>
                    {canManage && (
                      <Button variant="ghost" onClick={() => setModalState({ open: true, customer: c })}>
                        {t("common.edit")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

      <Modal
        open={modalState.open}
        onClose={() => setModalState({ open: false })}
        title={modalState.customer ? t("customers.editCustomer") : t("customers.newCustomer")}
      >
        <CustomerForm
          initial={modalState.customer}
          isPending={createMutation.isPending || updateMutation.isPending}
          onSubmit={(input) =>
            modalState.customer
              ? updateMutation.mutate({ id: modalState.customer.id, input })
              : createMutation.mutate(input)
          }
        />
      </Modal>
    </div>
  );
}
