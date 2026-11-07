import { DesksClient } from "./desks-client";

export const metadata = {
  title: "Ticketing desks",
  description: "Service desk definitions, stages, procedures, and SLA.",
};

export default function DesksPage() {
  return <DesksClient />;
}
