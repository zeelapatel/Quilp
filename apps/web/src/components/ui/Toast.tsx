import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { useUIStore, type ToastVariant } from "../../stores/ui";

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-l-[3px] border-l-success",
  error: "border-l-[3px] border-l-danger",
  info: "border-l-[3px] border-l-accent",
};

export function useToast() {
  const setToast = useUIStore(state => state.setToast);
  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      setToast({
        id: Date.now(),
        message,
        variant,
      });
    },
    [setToast]
  );

  return { showToast };
}

export function Toast() {
  const toast = useUIStore(state => state.toast);
  const setToast = useUIStore(state => state.setToast);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!toast) {
      setIsExiting(false);
      return;
    }

    setIsExiting(false);
    const dismissTimer = window.setTimeout(() => setIsExiting(true), 3000);
    const clearTimer = window.setTimeout(() => setToast(null), 3150);

    return () => {
      window.clearTimeout(dismissTimer);
      window.clearTimeout(clearTimer);
    };
  }, [toast, setToast]);

  if (!toast) {
    return null;
  }

  return (
    <div
      className={clsx(
        "fixed bottom-6 left-1/2 z-[70] min-w-[260px] -translate-x-1/2 rounded border border-[#333333] bg-bg-secondary px-4 py-2.5 font-sans text-[13px] text-text-primary transition-all duration-150",
        VARIANT_STYLES[toast.variant],
        isExiting ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      )}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}
