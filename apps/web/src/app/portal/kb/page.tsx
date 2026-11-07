import { PortalKbClient } from "./portal-kb-client";

export const metadata = {
  title: "Knowledge base",
  description: "Published help articles.",
};

export default function PortalKbPage() {
  return <PortalKbClient />;
}
