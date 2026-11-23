import { getTranslations } from "next-intl/server";
import { SearchClient } from "./search-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.ticketing");
  return {
    title: t("searchAll"),
    description: t("searchDescription"),
  };
}
export default function SearchPage() {
  return <SearchClient />;
}
