import type { Metadata } from "next";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "White-label branding, timezone, and custom sending domain DNS guidance.",
};

export default function SettingsPage() {
  return <SettingsClient />;
}
