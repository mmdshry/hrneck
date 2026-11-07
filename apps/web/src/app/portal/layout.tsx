import type { ReactNode } from "react";
import { PortalChrome } from "@/app/portal/portal-chrome";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalChrome>{children}</PortalChrome>;
}
