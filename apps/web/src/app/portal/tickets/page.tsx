import { PortalTicketsClient } from "./portal-tickets-client";

export const metadata = {
  title: "My tickets",
  description: "Submit and track service desk tickets.",
};

export default function PortalTicketsPage() {
  return <PortalTicketsClient />;
}
