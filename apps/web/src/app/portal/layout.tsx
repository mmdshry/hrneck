import type { ReactNode } from "react";
import { PortalChrome } from "@/app/portal/portal-chrome";

/** Client OrgShell cannot participate in instant-nav validation. */
export const instant = false;

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalChrome>{children}</PortalChrome>;
}
