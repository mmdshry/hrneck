import { TargetDetailClient } from "./target-detail-client";

export const instant = false;

export const metadata = {
  title: "Employee",
  description: "Employee profile, connected checklists, and pack assignment.",
};

export default async function TargetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TargetDetailClient targetId={Number(id)} />;
}
