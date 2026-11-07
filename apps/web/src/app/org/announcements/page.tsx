import type { Metadata } from "next";
import { AnnouncementsClient } from "./announcements-client";

export const instant = false;

export const metadata: Metadata = {
  title: "Announcements",
  description: "Publish organization-wide news and announcements.",
};

export default function AnnouncementsPage() {
  return <AnnouncementsClient />;
}
