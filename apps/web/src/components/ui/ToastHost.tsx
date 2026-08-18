import { useToastStore } from "@/store/toastStore";

const KIND_STYLES: Record<string, string> = {
  success: "border-green-300 bg-green-50 text-green-800",
  error: "border-red-300 bg-red-50 text-red-800",
  info: "border-slate-300 bg-white text-slate-800",
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-md ${KIND_STYLES[t.kind]}`}
        >
          <span className="flex-1">{t.text}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="text-xs font-medium opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
