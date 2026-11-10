import { EmailClient } from "./email-client";

export const instant = false;

export const metadata = {
  title: "Ticketing email",
  description: "Inbound email readers for ticketing.",
};

export default function EmailPage() {
  return <EmailClient />;
}
