import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createCustomer, listCustomers, updateCustomer, type CustomerInput } from "@/api/customers";
import type { Customer } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useHasPermission } from "@/hooks/useHasPermission";

// No shared-types schema exists for Customer yet — kept local, mirroring the
// Customer model fields described in the plan.
const customerSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().optional(),
});

function CustomerForm({
  initial,
  onSubmit,
  isPending,
}: {
  initial?: Customer;
  onSubmit: (input: CustomerInput) => void;
  isPending: boolean;
}) {
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
      <TextField label="Full name" error={errors.fullName} {...register("fullName")} />
      <TextField label="Phone *" error={errors.phone} {...register("phone")} />
      <TextField label="Email (optional)" type="email" error={errors.email} {...register("email")} />
      <TextField label="Notes" error={errors.notes} {...register("notes")} />
      <Button type="submit" isLoading={isPending}>
        Save
      </Button>
    </form>
  );
}

export function CustomersPage() {
  const canManage = useHasPermission("customers.manage");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalState, setModalState] = useState<{ open: boolean; customer?: Customer }>({ open: false });

  const customersQuery = useQuery({ queryKey: ["customers", search], queryFn: () => listCustomers(search || undefined) });

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setModalState({ open: false });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerInput }) => updateCustomer(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setModalState({ open: false });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        {canManage && <Button onClick={() => setModalState({ open: true })}>New customer</Button>}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, phone, or email…"
        className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={customersQuery.isLoading}
          isError={customersQuery.isError}
          error={customersQuery.error}
          isEmpty={(customersQuery.data?.length ?? 0) === 0}
          emptyMessage="No customers found."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Email</th>
                {canManage && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customersQuery.data?.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{c.fullName}</td>
                  <td className="px-4 py-2 text-slate-600">{c.phone ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{c.email ?? "—"}</td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" onClick={() => setModalState({ open: true, customer: c })}>
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal
        open={modalState.open}
        onClose={() => setModalState({ open: false })}
        title={modalState.customer ? "Edit customer" : "New customer"}
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
