import { LinkButton } from "@/components/ui/link-button";

export default function NotFound() {
  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-16"
    >
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        404
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Page not found
      </h1>
      <p className="text-[var(--muted-foreground)]">
        The page you requested does not exist or is no longer available.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <LinkButton href="/" variant="primary">
          Back to home
        </LinkButton>
        <LinkButton href="/login" variant="secondary">
          Sign in
        </LinkButton>
      </div>
    </div>
  );
}
