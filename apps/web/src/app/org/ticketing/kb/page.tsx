import { KbClient } from "./kb-client";

export const metadata = {
  title: "Knowledge Base",
  description: "Ticketing knowledge base articles.",
};

export default function KbPage() {
  return <KbClient />;
}
