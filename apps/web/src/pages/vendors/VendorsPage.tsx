import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";
import { createVendor, listVendors, updateVendor, type VendorInput } from "@/api/vendors";
import type { Vendor } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useHasPermission } from "@/hooks/useHasPermission";

// No shared-types schema exists for Vendor yet — mirrors the Vendor model
// fields described in the plan (code/numericCode/name/nameAr/contactName/
// phone/email/address/paymentTermsDays/notes), same convention as
// BranchesPage/CustomersPage.
const vendorSchema = z.object({
  code: z.string().min(1, "Code is required"),
  numericCode: z.coerce.number().int().positive("Numeric code must be positive"),
  name: z.string().min(1, "Name is required"),
  nameAr: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  paymentTermsDays: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

function VendorForm({
  initial,
  onSubmit,
  isPending,
}: {
  initial?: Vendor;
  onSubmit: (input: VendorInput) => void;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: initial
      ? {
          code: initial.code,
          numericCode: initial.numericCode,
          name: initial.name,
          nameAr: initial.nameAr ?? "",
          contactName: initial.contactName ?? "",
          phone: initial.phone ?? "",
          email: initial.email ?? "",
          address: initial.address ?? "",
          paymentTermsDays: initial.paymentTermsDays ?? undefined,
          notes: initial.notes ?? "",
          isActive: initial.isActive,
        }
      : { isActive: true },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Code" error={errors.code} {...register("code")} />
        <TextField
          label="Numeric code"
          type="number"
          error={errors.numericCode}
          {...register("numericCode")}
        />
      </div>
      <TextField label="Name" error={errors.name} {...register("name")} />
      <TextField label="Name (Arabic)" error={errors.nameAr} {...register("nameAr")} />
      <TextField label="Contact name" error={errors.contactName} {...register("contactName")} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Phone" error={errors.phone} {...register("phone")} />
        <TextField label="Email" type="email" error={errors.email} {...register("email")} />
      </div>
      <TextField label="Address" error={errors.address} {...register("address")} />
      <TextField
        label="Payment terms (days)"
        type="number"
        error={errors.paymentTermsDays}
        {...register("paymentTermsDays")}
      />
      <TextField label="Notes" error={errors.notes} {...register("notes")} />
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

export function VendorsPage() {
  const canManage = useHasPermission("vendors.manage");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalState, setModalState] = useState<{ open: boolean; vendor?: Vendor }>({ open: false });

  const vendorsQuery = useQuery({
    queryKey: ["vendors", search],
    queryFn: () => listVendors({ search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: createVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setModalState({ open: false });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: VendorInput }) => updateVendor(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setModalState({ open: false });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
        {canManage && <Button onClick={() => setModalState({ open: true })}>New vendor</Button>}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by code or name…"
        className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={vendorsQuery.isLoading}
          isError={vendorsQuery.isError}
          error={vendorsQuery.error}
          isEmpty={(vendorsQuery.data?.length ?? 0) === 0}
          emptyMessage="No vendors yet."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorsQuery.data?.map((vendor) => (
                <tr key={vendor.id}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{vendor.code}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{vendor.name}</td>
                  <td className="px-4 py-2 text-slate-600">{vendor.phone ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        vendor.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {vendor.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link to={`/vendors/${vendor.id}`} className="text-sm font-medium text-slate-900 underline">
                        Statement
                      </Link>
                      {canManage && (
                        <Button variant="ghost" onClick={() => setModalState({ open: true, vendor })}>
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
        title={modalState.vendor ? "Edit vendor" : "New vendor"}
      >
        <VendorForm
          initial={modalState.vendor}
          isPending={createMutation.isPending || updateMutation.isPending}
          onSubmit={(input) =>
            modalState.vendor
              ? updateMutation.mutate({ id: modalState.vendor.id, input })
              : createMutation.mutate(input)
          }
        />
      </Modal>
    </div>
  );
}
