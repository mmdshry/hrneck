import type { Metadata } from "next";
import { UsersClient } from "./users-client";

export const instant = false;

export const metadata: Metadata = {
  title: "Users",
  description: "Manage organization operators and role assignments.",
};

export default function UsersPage() {
  return <UsersClient />;
}
