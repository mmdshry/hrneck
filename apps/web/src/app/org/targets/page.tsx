import { TargetsClient } from "./targets-client";

export const metadata = {
  title: "Targets",
  description: "Manage targets, groups, CSV import, and directory sync.",
};

export default function TargetsPage() {
  return <TargetsClient />;
}
