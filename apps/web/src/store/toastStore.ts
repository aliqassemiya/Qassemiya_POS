import { create } from "zustand";

export interface ToastMessage {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

interface ToastStore {
  toasts: ToastMessage[];
  push: (kind: ToastMessage["kind"], text: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, text) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, kind, text }] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), 5000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (text: string) => useToastStore.getState().push("success", text),
  error: (text: string) => useToastStore.getState().push("error", text),
  info: (text: string) => useToastStore.getState().push("info", text),
};
