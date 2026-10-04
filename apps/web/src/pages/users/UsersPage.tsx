import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { listBranches } from "@/api/branches";
import {
  assignRole,
  createUser,
  listRoles,
  listUsers,
  removeRole,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/api/users";
import type { DashboardUser } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

function buildUserSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("users.invalidEmail")),
    password: z.string().min(8, t("users.passwordMinLength")),
    fullName: z.string().min(1, t("users.nameRequired")),
  });
}

function CreateUserForm({ onSubmit, isPending }: { onSubmit: (input: CreateUserInput) => void; isPending: boolean }) {
  const { t } = useTranslation();
  const schema = useMemo(() => buildUserSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserInput>({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <TextField label={t("users.fullNameLabel")} error={errors.fullName} {...register("fullName")} />
      <TextField label={t("common.email")} type="email" error={errors.email} {...register("email")} />
      <TextField label={t("users.passwordLabel")} type="text" error={errors.password} {...register("password")} />
      <Button type="submit" isLoading={isPending}>
        {t("common.save")}
      </Button>
    </form>
  );
}

function EditUserForm({
  user,
  onSubmit,
  isPending,
}: {
  user: DashboardUser;
  onSubmit: (input: UpdateUserInput) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(user.fullName);
  const [isActive, setIsActive] = useState(user.isActive);
  const [password, setPassword] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <TextField label={t("users.fullNameLabel")} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <TextField
        label={t("users.newPasswordOptionalLabel")}
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        {t("common.active")}
      </label>
      <Button
        isLoading={isPending}
        onClick={() =>
          onSubmit({
            fullName: fullName !== user.fullName ? fullName : undefined,
            isActive: isActive !== user.isActive ? isActive : undefined,
            password: password.length >= 8 ? password : undefined,
          })
        }
      >
        {t("common.save")}
      </Button>
      {password.length > 0 && password.length < 8 && (
        <p className="text-xs text-red-600">{t("users.passwordMinLength")}</p>
      )}
    </div>
  );
}

function ManageRolesModal({ user, onDone }: { user: DashboardUser; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: listRoles });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [roleId, setRoleId] = useState("");
  const [branchId, setBranchId] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    onDone();
  };

  const assignMutation = useMutation({
    mutationFn: () => assignRole(user.id, { roleId, branchId: branchId || null }),
    onSuccess: () => {
      invalidate();
      toast.success(t("users.roleAssigned"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("users.roleAssignFailed"))),
  });

  const removeMutation = useMutation({
    mutationFn: (userRoleId: string) => removeRole(user.id, userRoleId),
    onSuccess: () => {
      invalidate();
      toast.success(t("users.roleRemoved"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("users.roleRemoveFailed"))),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">{t("users.currentGrantsTitle")}</h3>
        {user.userRoles.length === 0 ? (
          <p className="text-sm text-slate-500">{t("users.noGrants")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {user.userRoles.map((grant) => (
              <li
                key={grant.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <span>
                  {t(`employees.roles.${grant.role.name}`)}
                  {" @ "}
                  {grant.branch ? grant.branch.name : t("users.allBranchesGrant")}
                </span>
                <Button
                  variant="ghost"
                  isLoading={removeMutation.isPending && removeMutation.variables === grant.id}
                  onClick={() => removeMutation.mutate(grant.id)}
                >
                  {t("common.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-700">{t("users.addGrantTitle")}</h3>
        <SelectField label={t("users.roleLabel")} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">{t("users.selectRole")}</option>
          {rolesQuery.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {t(`employees.roles.${r.name}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("common.branch")} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">{t("users.allBranchesGrant")}</option>
          {branchesQuery.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <Button disabled={!roleId} isLoading={assignMutation.isPending} onClick={() => assignMutation.mutate()}>
          {t("users.addGrant")}
        </Button>
      </div>
    </div>
  );
}

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<DashboardUser | null>(null);
  const [rolesUser, setRolesUser] = useState<DashboardUser | null>(null);

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const users = usersQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
      toast.success(t("users.created"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("users.createFailed"))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
      toast.success(t("users.updated"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("users.updateFailed"))),
  });

  // The roles modal reads live grants -- keep it pointed at the freshest
  // copy of the open user as the list refetches after assign/remove.
  const liveRolesUser = rolesUser ? (users.find((u) => u.id === rolesUser.id) ?? rolesUser) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("users.title")}</h1>
        <Button onClick={() => setCreateOpen(true)}>{t("users.newUser")}</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          error={usersQuery.error}
          isEmpty={users.length === 0}
          emptyMessage={t("users.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("common.name")}</th>
                <th className="px-4 py-2 font-medium">{t("common.email")}</th>
                <th className="px-4 py-2 font-medium">{t("users.grantsColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("common.status")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">{u.fullName}</td>
                  <td className="px-4 py-2 text-slate-600" dir="ltr">
                    {u.email}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {u.userRoles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {u.userRoles.map((grant) => (
                          <span
                            key={grant.id}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                          >
                            {t(`employees.roles.${grant.role.name}`)} · {grant.branch ? grant.branch.name : t("users.allBranchesGrant")}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">{t("users.noGrants")}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.isActive ? t("common.active") : t("common.inactive")}
                    </span>
                  </td>
                  <td className="flex justify-end gap-2 px-4 py-2 text-right">
                    <Button variant="ghost" onClick={() => setRolesUser(u)}>
                      {t("users.manageRoles")}
                    </Button>
                    <Button variant="ghost" onClick={() => setEditUser(u)}>
                      {t("common.edit")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t("users.newUser")}>
        <CreateUserForm onSubmit={(input) => createMutation.mutate(input)} isPending={createMutation.isPending} />
      </Modal>

      <Modal open={editUser !== null} onClose={() => setEditUser(null)} title={t("users.editUser")}>
        {editUser && (
          <EditUserForm
            user={editUser}
            isPending={updateMutation.isPending}
            onSubmit={(input) => updateMutation.mutate({ id: editUser.id, input })}
          />
        )}
      </Modal>

      <Modal open={liveRolesUser !== null} onClose={() => setRolesUser(null)} title={t("users.manageRoles")}>
        {liveRolesUser && <ManageRolesModal user={liveRolesUser} onDone={() => {}} />}
      </Modal>
    </div>
  );
}
