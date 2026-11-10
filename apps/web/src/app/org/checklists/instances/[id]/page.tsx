import { ChecklistFillClient } from "./fill-client";

export const instant = false;

export const metadata = {
  title: "Fill checklist",
  description: "Complete an internal HR checklist for an employee.",
};

export default async function ChecklistFillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChecklistFillClient instanceId={Number(id)} />;
}
