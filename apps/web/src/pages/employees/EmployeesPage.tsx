import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

// No shared-types schema exists for Employee create/update yet — kept local,
// mirroring the (thin) Employee model described in the plan.
const employeeSchema = z.object({
  employeeCode: z.string().min(1, "Employee code is required"),
  fullName: z.string().min(1, "Name is required"),
  branchId: z.string().uuid("Select a branch"),
  roles: z.array(z.nativeEnum(RoleName)).min(1, "Select at least one role"),
  pinCode: z.string().min(4).max(8).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

function EmployeeForm({
  initial,
  onSubmit,
  isPending,
}: {
  initial?: Employee;
  onSubmit: (input: EmployeeInput) => void;
  isPending: boolean;
}) {
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: initial
      ? {
          employeeCode: initial.employeeCode,
          fullName: initial.fullName,
          branchId: initial.branchId,
          roles: initial.roles,
          isActive: initial.isActive,
        }
      : { roles: [], isActive: true },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField label="Employee code" error={errors.employeeCode} {...register("employeeCode")} />
      <TextField label="Full name" error={errors.fullName} {...register("fullName")} />
      <SelectField label="Branch" error={errors.branchId} {...register("branchId")}>
        <option value="">Select a branch…</option>
        {branchesQuery.data?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectField>

      <Controller
        control={control}
        name="roles"
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Roles</span>
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
                  {role}
                </label>
              ))}
            </div>
            {errors.roles && <span className="text-xs text-red-600">{errors.roles.message}</span>}
          </div>
        )}
      />

      {!initial && (
        <TextField
          label="Initial PIN (4–8 digits, POS login)"
          error={errors.pinCode}
          {...register("pinCode")}
        />
      )}

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

function ResetPinForm({ employee, onDone }: { employee: Employee; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const mutation = useMutation({
    mutationFn: () => resetEmployeePin(employee.id, pin),
    onSuccess: onDone,
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        Set a new POS PIN for <span className="font-medium">{employee.fullName}</span>.
      </p>
      <TextField label="New PIN (4–8 digits)" value={pin} onChange={(e) => setPin(e.target.value)} />
      <Button
        isLoading={mutation.isPending}
        disabled={pin.length < 4}
        onClick={() => mutation.mutate()}
      >
        Reset PIN
      </Button>
      {mutation.isError && <p className="text-xs text-red-600">Could not reset the PIN. Please try again.</p>}
    </div>
  );
}

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [formModal, setFormModal] = useState<{ open: boolean; employee?: Employee }>({ open: false });
  const [pinModalEmployee, setPinModalEmployee] = useState<Employee | null>(null);

  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setFormModal({ open: false });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: EmployeeInput }) => updateEmployee(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setFormModal({ open: false });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
        <Button onClick={() => setFormModal({ open: true })}>New employee</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={employeesQuery.isLoading}
          isError={employeesQuery.isError}
          error={employeesQuery.error}
          isEmpty={(employeesQuery.data?.length ?? 0) === 0}
          emptyMessage="No employees yet."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Branch</th>
                <th className="px-4 py-2 font-medium">Roles</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employeesQuery.data?.map((emp) => (
                <tr key={emp.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{emp.fullName}</td>
                  <td className="px-4 py-2 text-slate-600">{emp.employeeCode}</td>
                  <td className="px-4 py-2 text-slate-600">{emp.branch?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{emp.roles.join(", ")}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        emp.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {emp.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="flex justify-end gap-2 px-4 py-2 text-right">
                    <Button variant="ghost" onClick={() => setFormModal({ open: true, employee: emp })}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setPinModalEmployee(emp)}>
                      Reset PIN
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal
        open={formModal.open}
        onClose={() => setFormModal({ open: false })}
        title={formModal.employee ? "Edit employee" : "New employee"}
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

      <Modal open={pinModalEmployee !== null} onClose={() => setPinModalEmployee(null)} title="Reset PIN">
        {pinModalEmployee && (
          <ResetPinForm employee={pinModalEmployee} onDone={() => setPinModalEmployee(null)} />
        )}
      </Modal>
    </div>
  );
}
