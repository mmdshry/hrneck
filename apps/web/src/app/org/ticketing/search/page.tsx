import { SearchClient } from "./search-client";

export const instant = false;

export const metadata = {
  title: "Search all",
  description: "Search tickets and knowledge base articles.",
};

export default function SearchPage() {
  return <SearchClient />;
}
