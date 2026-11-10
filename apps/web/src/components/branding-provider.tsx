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
import { useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  applyPrimaryColor,
  brandDisplayName,
  clearPrimaryColor,
  type OrgBranding,
} from "@/lib/branding";
import { orgLiveChannel } from "@/lib/live-topics";
import { resolveTenant } from "@/lib/tenant";

type BrandingContextValue = {
  branding: OrgBranding | null;
  displayName: string;
  logoUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

type BrandingPayload = {
  data: OrgBranding;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "branding") : null;
  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyBranding = useCallback((next: OrgBranding | null) => {
    setBranding(next);
    if (next) {
      applyPrimaryColor(next.primary_color);
    } else {
      clearPrimaryColor();
    }
  }, []);

  const onPayload = useCallback(
    (payload: BrandingPayload) => {
      setLiveReady(true);
      applyBranding(payload.data ?? null);
      setLoading(false);
    },
    [applyBranding],
  );

  const refresh = useCallback(async () => {
    try {
      await ensureCsrf();
      const session = await fetchSessionUser();
      if (!session) {
        applyBranding(null);
        return;
      }
      const nextTenant = session.tenant_id || resolveTenant();
      if (!nextTenant) {
        applyBranding(null);
        return;
      }
      const res = await api<{ data: OrgBranding }>("/api/v1/org/branding", {
        tenant: nextTenant,
      });
      applyBranding(res.data);
    } catch {
      applyBranding(null);
    } finally {
      setLoading(false);
    }
  }, [applyBranding]);

  useLiveTopic<BrandingPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (liveReady) {
      setLoading(false);
      return;
    }
    void refresh();
    return () => {
      clearPrimaryColor();
    };
  }, [liveReady, refresh]);

  const value = useMemo<BrandingContextValue>(() => {
    const logoPath = branding?.logo_url?.trim() || null;
    // <img> cannot send X-Tenant; tenancy middleware accepts ?tenant= (same as training media).
    const nextTenant = resolveTenant();
    const params = new URLSearchParams();
    if (nextTenant) params.set("tenant", nextTenant);
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
