import { redirect } from "next/navigation";

type UsersRedirectPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Employee management lives at /org/targets. Keep old /org/users links working
 * by forwarding them, including query params such as ?tenant=.
 */
export default async function UsersRedirectPage({ searchParams }: UsersRedirectPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
    }
  }
  const suffix = query.toString();
  redirect(suffix ? `/org/targets?${suffix}` : "/org/targets");
}
