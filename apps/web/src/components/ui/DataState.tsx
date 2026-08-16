import type { ReactNode } from "react";

interface DataStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/** Wraps a react-query result and renders the right state — loading/error/empty/content. */
export function DataState({
  isLoading,
  isError,
  error,
  isEmpty = false,
  emptyMessage = "No records found.",
  children,
}: DataStateProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading…</div>;
  }
  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {errorMessage(error)}
      </div>
    );
  }
  if (isEmpty) {
    return <div className="p-8 text-center text-sm text-slate-500">{emptyMessage}</div>;
  }
  return <>{children}</>;
}
