import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MFA",
  description: "Verify your multi-factor authentication code to finish signing in.",
};

export default function MfaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
