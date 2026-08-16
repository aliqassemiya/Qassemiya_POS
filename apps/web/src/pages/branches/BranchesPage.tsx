import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createBranch, listBranches, updateBranch, type BranchInput } from "@/api/branches";
import type { Branch } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useHasPermission } from "@/hooks/useHasPermission";

// No shared-types schema exists for Branch yet — this mirrors the Branch model
// fields described in the plan (name/nameAr/address/phone/vatNumber/isActive).
const branchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  nameAr: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  vatNumber: z.string().optional(),
  isActive: z.boolean().default(true),
});

function BranchForm({
  initial,
  onSubmit,
  isPending,
}: {
  initial?: Branch;
  onSubmit: (input: BranchInput) => void;
  isPending: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchInput>({
    resolver: zodResolver(branchSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          nameAr: initial.nameAr ?? "",
          address: initial.address ?? "",
          phone: initial.phone ?? "",
          vatNumber: initial.vatNumber ?? "",
          isActive: initial.isActive,
        }
      : { isActive: true },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField label="Name" error={errors.name} {...register("name")} />
      <TextField label="Name (Arabic)" error={errors.nameAr} {...register("nameAr")} />
      <TextField label="Address" error={errors.address} {...register("address")} />
      <TextField label="Phone" error={errors.phone} {...register("phone")} />
      <TextField label="VAT Number" error={errors.vatNumber} {...register("vatNumber")} />
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

export function BranchesPage() {
  const canManage = useHasPermission("branches.manage");
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<{ open: boolean; branch?: Branch }>({ open: false });

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });

  const createMutation = useMutation({
    mutationFn: createBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setModalState({ open: false });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: BranchInput }) => updateBranch(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setModalState({ open: false });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Branches</h1>
        {canManage && <Button onClick={() => setModalState({ open: true })}>New branch</Button>}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={branchesQuery.isLoading}
          isError={branchesQuery.isError}
          error={branchesQuery.error}
          isEmpty={(branchesQuery.data?.length ?? 0) === 0}
          emptyMessage="No branches yet."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Address</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Status</th>
                {canManage && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branchesQuery.data?.map((branch) => (
                <tr key={branch.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{branch.name}</td>
                  <td className="px-4 py-2 text-slate-600">{branch.address ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{branch.phone ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        branch.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {branch.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" onClick={() => setModalState({ open: true, branch })}>
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
        title={modalState.branch ? "Edit branch" : "New branch"}
      >
        <BranchForm
          initial={modalState.branch}
          isPending={createMutation.isPending || updateMutation.isPending}
          onSubmit={(input) =>
            modalState.branch
              ? updateMutation.mutate({ id: modalState.branch.id, input })
              : createMutation.mutate(input)
          }
        />
      </Modal>
    </div>
  );
}
