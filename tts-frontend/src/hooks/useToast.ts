import { useCallback, useSyncExternalStore } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

let nextId = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function addToast(message: string, variant: ToastVariant, duration = 4000) {
  const id = nextId++;
  toasts = [...toasts, { id, message, variant, duration }];
  emit();
  setTimeout(() => removeToast(id), duration);
}

function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (msg: string) => addToast(msg, "success"),
  error: (msg: string) => addToast(msg, "error"),
  info: (msg: string) => addToast(msg, "info"),
};

export function useToasts(): [ToastItem[], (id: number) => void] {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
  );

  const dismiss = useCallback((id: number) => removeToast(id), []);

  return [snapshot, dismiss];
}
