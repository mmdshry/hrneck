"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  applyPrimaryColor,
  brandDisplayName,
  clearPrimaryColor,
  type OrgBranding,
} from "@/lib/branding";
import { resolveTenant } from "@/lib/tenant";

type BrandingContextValue = {
  branding: OrgBranding | null;
  displayName: string;
  logoUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      await ensureCsrf();
      const session = await fetchSessionUser();
      if (!session?.tenant_id && !resolveTenant()) {
        setBranding(null);
        clearPrimaryColor();
        return;
      }
      const tenant = resolveTenant();
      if (!tenant) {
        setBranding(null);
        clearPrimaryColor();
        return;
      }
      const res = await api<{ data: OrgBranding }>("/api/v1/org/branding", {
        tenant,
      });
      setBranding(res.data);
      applyPrimaryColor(res.data.primary_color);
    } catch {
      setBranding(null);
      clearPrimaryColor();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      clearPrimaryColor();
    };
  }, [refresh]);

  const value = useMemo<BrandingContextValue>(() => {
    const logoPath = branding?.logo_url?.trim() || null;
    // <img> cannot send X-Tenant; tenancy middleware accepts ?tenant= (same as training media).
    const tenant = resolveTenant();
    const params = new URLSearchParams();
    if (tenant) params.set("tenant", tenant);
    if (branding?.logo_path) params.set("v", branding.logo_path);
    const query = params.toString();
    return {
      branding,
      displayName: brandDisplayName(branding),
      logoUrl: logoPath ? `${logoPath}${query ? `?${query}` : ""}` : null,
      loading,
      refresh,
    };
  }, [branding, loading, refresh]);

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      branding: null,
      displayName: "HRNECK",
      logoUrl: null,
      loading: false,
      refresh: async () => undefined,
    };
  }
  return ctx;
}
