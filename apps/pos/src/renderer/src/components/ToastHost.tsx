import { useToastStore } from "../store/toast-store";

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  const latest = toasts[toasts.length - 1];
  return <div className={`toast ${latest.kind}`}>{latest.text}</div>;
}
