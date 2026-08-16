import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@qassemiya/shared-types";
import { login } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { tokenStorage } from "@/lib/tokenStorage";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      tokenStorage.setRefreshToken(data.refreshToken);
      setSession({ accessToken: data.accessToken, user: data.user });
      const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";
      navigate(from, { replace: true });
    },
  });

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Qassemiya Back Office</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to manage branches, catalog, and sales.</p>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email}
            {...register("email")}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password}
            {...register("password")}
          />

          {mutation.isError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              Invalid email or password, or the server is unreachable.
            </div>
          )}

          <Button type="submit" isLoading={mutation.isPending} className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
