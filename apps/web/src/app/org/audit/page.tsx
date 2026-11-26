import type { Metadata } from "next";
import { AuditLogClient } from "./audit-log-client";

export const instant = false;

export const metadata: Metadata = {
  title: "Audit log",
  description: "Recent administrative activity in this organization.",
};

export default function AuditLogPage() {
  return <AuditLogClient />;
}
