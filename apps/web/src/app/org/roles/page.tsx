import type { Metadata } from "next";
import { RolesClient } from "./roles-client";

export const metadata: Metadata = {
  title: "Roles",
  description: "Manage organization RBAC roles and permissions.",
};

export default function RolesPage() {
  return <RolesClient />;
}
