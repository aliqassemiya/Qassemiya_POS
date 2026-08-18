import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { createVendor, listVendors, updateVendor, type VendorInput } from "@/api/vendors";
import type { Vendor } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useHasPermission } from "@/hooks/useHasPermission";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

// No shared-types schema exists for Vendor yet — mirrors the Vendor model
// fields described in the plan (code/numericCode/name/nameAr/contactName/
// phone/email/address/paymentTermsDays/notes), same convention as
// BranchesPage/CustomersPage.
function buildVendorSchema(t: (key: string) => string) {
  return z.object({
    code: z.string().min(1, t("vendors.codeRequired")),
    numericCode: z.coerce.number().int().positive(t("vendors.numericCodePositive")),
    name: z.string().min(1, t("vendors.nameRequired")),
    nameAr: z.string().optional(),
    contactName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email(t("vendors.invalidEmail")).optional().or(z.literal("")),
    address: z.string().optional(),
    paymentTermsDays: z.coerce.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().default(true),
  });
}

function VendorForm({
  initial,
  onSubmit,
  isPending,
}: {
  initial?: Vendor;
  onSubmit: (input: VendorInput) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const vendorSchema = useMemo(() => buildVendorSchema(t), [t]);
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
        <TextField label={t("vendors.codeLabel")} error={errors.code} {...register("code")} />
        <TextField
          label={t("vendors.numericCodeLabel")}
          type="number"
          error={errors.numericCode}
          {...register("numericCode")}
        />
      </div>
      <TextField label={t("common.name")} error={errors.name} {...register("name")} />
      <TextField label={t("vendors.nameArabicLabel")} error={errors.nameAr} {...register("nameAr")} />
      <TextField label={t("vendors.contactNameLabel")} error={errors.contactName} {...register("contactName")} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={t("common.phone")} error={errors.phone} {...register("phone")} />
        <TextField label={t("common.email")} type="email" error={errors.email} {...register("email")} />
      </div>
      <TextField label={t("common.address")} error={errors.address} {...register("address")} />
      <TextField
        label={t("vendors.paymentTermsDaysLabel")}
        type="number"
        error={errors.paymentTermsDays}
        {...register("paymentTermsDays")}
      />
      <TextField label={t("vendors.notesLabel")} error={errors.notes} {...register("notes")} />
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

export function VendorsPage() {
  const { t } = useTranslation();
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
      toast.success(t("vendors.created"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("vendors.createFailed"))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: VendorInput }) => updateVendor(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setModalState({ open: false });
      toast.success(t("vendors.updated"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("vendors.updateFailed"))),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("vendors.title")}</h1>
        {canManage && <Button onClick={() => setModalState({ open: true })}>{t("vendors.newVendor")}</Button>}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("vendors.searchPlaceholder")}
        className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={vendorsQuery.isLoading}
          isError={vendorsQuery.isError}
          error={vendorsQuery.error}
          isEmpty={(vendorsQuery.data?.length ?? 0) === 0}
          emptyMessage={t("vendors.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("vendors.codeColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("common.name")}</th>
                <th className="px-4 py-2 font-medium">{t("common.phone")}</th>
                <th className="px-4 py-2 font-medium">{t("common.status")}</th>
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
                      {vendor.isActive ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link to={`/vendors/${vendor.id}`} className="text-sm font-medium text-slate-900 underline">
                        {t("vendors.statementLink")}
                      </Link>
                      {canManage && (
                        <Button variant="ghost" onClick={() => setModalState({ open: true, vendor })}>
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
        title={modalState.vendor ? t("vendors.editVendor") : t("vendors.newVendor")}
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
