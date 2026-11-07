import html2canvas from "html2canvas";
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

export async function downloadAuthenticated(
  url: string,
  filename: string,
  accept: string,
): Promise<void> {
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
}

export async function captureElementPng(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: window.devicePixelRatio > 1 ? 2 : 1,
    useCORS: true,
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("PNG export failed"));
    }, "image/png");
  });

  downloadBlob(blob, filename);
}
