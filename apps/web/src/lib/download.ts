import { domToBlob } from "modern-screenshot";
import { ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function xsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export type AuthenticatedDownloadResult = {
  /** True when the server cut the export at its row cap (`X-Report-Truncated: 1`). */
  truncated: boolean;
};

export async function downloadAuthenticated(
  url: string,
  filename: string,
  accept: string,
): Promise<AuthenticatedDownloadResult> {
  await ensureCsrf();
  const headers = new Headers({
    Accept: accept,
    "X-Requested-With": "XMLHttpRequest",
    "X-Tenant": resolveTenant() ?? "",
  });
  const token = xsrfToken();
  if (token) headers.set("X-XSRF-TOKEN", token);

  const response = await fetch(url, {
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    throw new Error((await response.text()) || "Export failed");
  }

  downloadBlob(await response.blob(), filename);

  return { truncated: response.headers.get("X-Report-Truncated") === "1" };
}

export async function captureElementPng(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const blob = await domToBlob(element, {
    type: "image/png",
    scale: window.devicePixelRatio > 1 ? 2 : 1,
    backgroundColor: null,
  });

  if (!blob) {
    throw new Error("PNG export failed");
  }

  downloadBlob(blob, filename);
}
