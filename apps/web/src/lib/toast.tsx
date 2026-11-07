"use client";

import { Bell, CheckCircle2, Info, XCircle } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import type { ReactNode } from "react";

const DURATION_MS = 4000;

function iconWrap(node: ReactNode) {
  return <span className="mt-0.5 shrink-0">{node}</span>;
}

export function toastSuccess(message: string, description?: string) {
  return sonnerToast.success(message, {
    description,
    duration: DURATION_MS,
    icon: iconWrap(<CheckCircle2 className="h-4 w-4" aria-hidden />),
  });
}

export function toastError(message: string, description?: string) {
  return sonnerToast.error(message, {
    description,
    duration: DURATION_MS,
    icon: iconWrap(<XCircle className="h-4 w-4" aria-hidden />),
  });
}

export function toastInfo(message: string, description?: string) {
  return sonnerToast.message(message, {
    description,
    duration: DURATION_MS,
    icon: iconWrap(<Info className="h-4 w-4" aria-hidden />),
  });
}

export function toastNotification(message: string, description?: string) {
  return sonnerToast(message, {
    description,
    duration: DURATION_MS,
    icon: iconWrap(<Bell className="h-4 w-4" aria-hidden />),
  });
}

/** Map common API/UI result strings to success or error toasts. */
export function notifyResult(message: string) {
  const m = message.toLowerCase();
  if (/\b(fail|failed|error|invalid|denied|forbidden)\b/.test(m) || m.includes("save failed")) {
    toastError(message);
    return;
  }
  if (
    m.includes("saved") ||
    m.includes("created") ||
    m.includes("updated") ||
    m.includes("deleted") ||
    m.includes("assigned") ||
    m.includes("published") ||
    m.includes("success")
  ) {
    toastSuccess(message);
    return;
  }
  toastInfo(message);
}
