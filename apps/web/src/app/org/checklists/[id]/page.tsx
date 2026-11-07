import { ChecklistBuilderClient } from "./builder-client";

export const metadata = {
  title: "Checklist builder",
  description: "Design a flexible multimedia HR checklist template.",
};

export default async function ChecklistBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChecklistBuilderClient templateId={Number(id)} />;
}
