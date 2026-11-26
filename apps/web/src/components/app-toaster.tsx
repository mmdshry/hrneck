"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      expand
      visibleToasts={5}
      closeButton
      richColors
      toastOptions={{
        className: "border shadow-[var(--shadow-md)]",
      }}
    />
  );
}
