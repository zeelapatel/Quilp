import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export type ToastState = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type UIState = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toast: ToastState | null;
  setToast: (toast: ToastState | null) => void;
};

export const useUIStore = create<UIState>(set => ({
  sidebarOpen: true,
  setSidebarOpen: sidebarOpen => set({ sidebarOpen }),
  toast: null,
  setToast: toast => set({ toast })
}));
