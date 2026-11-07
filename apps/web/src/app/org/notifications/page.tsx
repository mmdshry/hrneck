import type { Metadata } from "next";
import { NotificationsClient } from "./notifications-client";

export const instant = false;

export const metadata: Metadata = {
  title: "Notifications",
  description: "Organization inbox for assignments, tickets, and announcements.",
};

export default function NotificationsPage() {
  return <NotificationsClient />;
}
