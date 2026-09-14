import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { RoleName } from "@qassemiya/shared-types";
import { listBranches } from "@/api/branches";
import { createEmployee, listEmployees, resetEmployeePin, updateEmployee, type EmployeeInput } from "@/api/employees";
import type { Employee } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Pagination } from "@/components/ui/Pagination";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

const PAGE_SIZE = 50;

interface EmployeeFormValues {
  employeeCode: string;
  fullName: string;
  email: string;
  branchId: string;
  grantAccess: boolean;
  roles: RoleName[];
  pinCode: string;
  isActive: boolean;
}

// No shared-types schema exists for Employee create/update yet — kept local,
// mirroring the (thin) Employee model described in the plan. grantAccess is
// a form-only toggle — POS system access (PIN + roles) is optional per
// employee, so roles/pinCode are only required when it's on.
function buildEmployeeSchema(t: (key: string) => string) {
  return z
    .object({
      employeeCode: z.string().min(1, t("employees.employeeCodeRequired")),
      fullName: z.string().min(1, t("employees.nameRequired")),
      email: z.string().email(t("employees.invalidEmail")).optional().or(z.literal("")),
      branchId: z.string().uuid(t("employees.branchRequired")),
      grantAccess: z.boolean().default(false),
      roles: z.array(z.nativeEnum(RoleName)).default([]),
      pinCode: z.string().optional().or(z.literal("")),
      isActive: z.boolean().default(true),
    })
    .refine((data) => !data.grantAccess || data.roles.length > 0, {
      message: t("employees.rolesRequired"),
      path: ["roles"],
    })
    .refine((data) => !data.grantAccess || (data.pinCode && data.pinCode.length >= 4 && data.pinCode.length <= 8), {
      message: t("employees.pinLength"),
      path: ["pinCode"],
    });
}

function EmployeeForm({
  initial,
  onSubmit,
  isPending,
}: {
  initial?: Employee;
  onSubmit: (input: EmployeeInput) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const employeeSchema = useMemo(() => buildEmployeeSchema(t), [t]);
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  // Once granted, access can't be revoked from this form (the API has no
  // downgrade path) — so an employee who already has roles always keeps the
  // PIN/roles fields visible, no toggle. A new or currently-no-access
  // employee gets the toggle to opt into (or later upgrade to) POS access.
  const hasExistingAccess = Boolean(initial?.roles?.length);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: initial
      ? {
          employeeCode: initial.employeeCode,
          fullName: initial.fullName,
          email: initial.email ?? "",
          branchId: initial.branchId,
          grantAccess: hasExistingAccess,
          roles: initial.roles,
          pinCode: "",
          isActive: initial.isActive,
        }
      : { grantAccess: false, roles: [], pinCode: "", isActive: true },
  });

  const grantAccess = hasExistingAccess || watch("grantAccess");

  const submit = (values: EmployeeFormValues) => {
    onSubmit({
      employeeCode: values.employeeCode,
      fullName: values.fullName,
      email: values.email || undefined,
      branchId: values.branchId,
      isActive: values.isActive,
      roles: grantAccess ? values.roles : undefined,
      pinCode: grantAccess && values.pinCode ? values.pinCode : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <TextField label={t("employees.employeeCodeLabel")} error={errors.employeeCode} {...register("employeeCode")} />
      <TextField label={t("employees.fullNameLabel")} error={errors.fullName} {...register("fullName")} />
      <TextField label={t("common.email")} type="email" error={errors.email} {...register("email")} />
      <SelectField label={t("common.branch")} error={errors.branchId} {...register("branchId")}>
        <option value="">{t("employees.selectBranch")}</option>
        {branchesQuery.data?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectField>

      {!hasExistingAccess && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" {...register("grantAccess")} />
          {t("employees.grantAccessLabel")}
        </label>
      )}
      {!grantAccess && <p className="text-xs text-slate-500">{t("employees.noAccessHint")}</p>}

      {grantAccess && (
        <>
          <Controller
            control={control}
            name="roles"
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">{t("employees.rolesLabel")}</span>
                <div className="flex flex-wrap gap-3">
                  {Object.values(RoleName).map((role) => (
                    <label key={role} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={field.value?.includes(role) ?? false}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...(field.value ?? []), role]
                            : (field.value ?? []).filter((r) => r !== role);
                          field.onChange(next);
                        }}
                      />
                      {t(`employees.roles.${role}`)}
                    </label>
                  ))}
                </div>
                {errors.roles && <span className="text-xs text-red-600">{errors.roles.message}</span>}
              </div>
            )}
          />

          {!hasExistingAccess && (
            <TextField label={t("employees.initialPinLabel")} error={errors.pinCode} {...register("pinCode")} />
          )}
        </>
      )}

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

function ResetPinForm({ employee, onDone }: { employee: Employee; onDone: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const mutation = useMutation({
    mutationFn: () => resetEmployeePin(employee.id, pin),
    onSuccess: () => {
      onDone();
      toast.success(t("employees.pinReset"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("employees.resetPinFailed"))),
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">{t("employees.setNewPinFor", { name: employee.fullName })}</p>
      <TextField label={t("employees.newPinLabel")} value={pin} onChange={(e) => setPin(e.target.value)} />
      <Button
        isLoading={mutation.isPending}
        disabled={pin.length < 4}
        onClick={() => mutation.mutate()}
      >
        {t("employees.resetPin")}
      </Button>
      {mutation.isError && <p className="text-xs text-red-600">{t("employees.resetPinInlineError")}</p>}
    </div>
  );
}

export function EmployeesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [formModal, setFormModal] = useState<{ open: boolean; employee?: Employee }>({ open: false });
  const [pinModalEmployee, setPinModalEmployee] = useState<Employee | null>(null);
  const [page, setPage] = useState(1);

  const employeesQuery = useQuery({
    queryKey: ["employees", page],
    queryFn: () => listEmployees({ page, pageSize: PAGE_SIZE }),
  });
  const employees = employeesQuery.data?.data ?? [];
  const totalCount = employeesQuery.data?.totalCount ?? 0;

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setFormModal({ open: false });
      toast.success(t("employees.created"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("employees.createFailed"))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: EmployeeInput }) => updateEmployee(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setFormModal({ open: false });
      toast.success(t("employees.updated"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("employees.updateFailed"))),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("employees.title")}</h1>
        <Button onClick={() => setFormModal({ open: true })}>{t("employees.newEmployee")}</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={employeesQuery.isLoading}
          isError={employeesQuery.isError}
          error={employeesQuery.error}
          isEmpty={employees.length === 0}
          emptyMessage={t("employees.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("common.name")}</th>
                <th className="px-4 py-2 font-medium">{t("employees.codeColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("common.email")}</th>
                <th className="px-4 py-2 font-medium">{t("common.branch")}</th>
                <th className="px-4 py-2 font-medium">{t("employees.rolesColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("common.status")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{emp.fullName}</td>
                  <td className="px-4 py-2 text-slate-600">{emp.employeeCode}</td>
                  <td className="px-4 py-2 text-slate-600">{emp.email ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{emp.branch?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {emp.roles.length > 0 ? emp.roles.map((r) => t(`employees.roles.${r}`)).join(", ") : t("employees.noAccessBadge")}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        emp.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {emp.isActive ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td className="flex justify-end gap-2 px-4 py-2 text-right">
                    <Button variant="ghost" onClick={() => setFormModal({ open: true, employee: emp })}>
                      {t("common.edit")}
                    </Button>
                    {emp.roles.length > 0 && (
                      <Button variant="ghost" onClick={() => setPinModalEmployee(emp)}>
                        {t("employees.resetPin")}
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
        open={formModal.open}
        onClose={() => setFormModal({ open: false })}
        title={formModal.employee ? t("employees.editEmployee") : t("employees.newEmployee")}
      >
        <EmployeeForm
          initial={formModal.employee}
          isPending={createMutation.isPending || updateMutation.isPending}
          onSubmit={(input) =>
            formModal.employee
              ? updateMutation.mutate({ id: formModal.employee.id, input })
              : createMutation.mutate(input)
          }
        />
      </Modal>

      <Modal open={pinModalEmployee !== null} onClose={() => setPinModalEmployee(null)} title={t("employees.resetPin")}>
        {pinModalEmployee && (
          <ResetPinForm employee={pinModalEmployee} onDone={() => setPinModalEmployee(null)} />
        )}
      </Modal>
    </div>
  );
}
