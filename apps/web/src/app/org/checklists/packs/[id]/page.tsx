import { ChecklistPackDetailClient } from "./pack-detail-client";

export const instant = false;

export const metadata = {
  title: "Edit checklist pack",
  description: "Edit pack templates and auto-assign settings.",
};

export default async function ChecklistPackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChecklistPackDetailClient packId={Number(id)} />;
}
