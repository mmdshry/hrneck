import { GroupsClient } from "./groups-client";

export const instant = false;

export const metadata = {
  title: "Groups",
  description: "Create and manage audience groups and their members.",
};

export default function GroupsPage() {
  return <GroupsClient />;
}
