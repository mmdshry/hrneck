import { ChecklistPacksClient } from "./packs-client";

export const instant = false;

export const metadata = {
  title: "Checklist packs",
  description: "Bundle templates into welcome packs and auto-assign on hire.",
};

export default function ChecklistPacksPage() {
  return <ChecklistPacksClient />;
}
