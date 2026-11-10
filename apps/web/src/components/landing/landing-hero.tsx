import { LinkButton } from "@/components/ui/link-button";
import { ProductMock } from "@/components/landing/product-mock";

const brand = process.env.NEXT_PUBLIC_BRAND_SHORT ?? "HRNECK";

export function LandingHero() {
  return (
    <section
      className="relative overflow-hidden border-t-2"
      style={{ borderTopColor: "var(--spark)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,color-mix(in_srgb,var(--brand)_14%,transparent),transparent_50%),radial-gradient(ellipse_at_90%_20%,color-mix(in_srgb,var(--brand)_22%,transparent),transparent_48%),linear-gradient(180deg,color-mix(in_srgb,var(--brand)_6%,transparent),transparent_55%)]"
      />
      <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-6 pb-16 pt-14 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:items-center md:gap-16 md:pb-20 md:pt-16">
        <div className="landing-hero-enter flex flex-col gap-8">
          <p className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-[var(--foreground)] md:text-6xl lg:text-7xl">
            {brand}
          </p>
          <h1 className="max-w-xl font-[family-name:var(--font-display)] text-2xl leading-snug tracking-tight text-[var(--foreground)] md:text-3xl">
            Security awareness training for MSPs and every client organization.
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-[var(--muted-foreground)]">
            Train people, run HR checklists, operate an ITIL service desk, and
            measure risk — from one calm, modern workspace.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <LinkButton href="/login" variant="primary" size="lg">
              Sign in
            </LinkButton>
            <LinkButton href="#demo" variant="secondary" size="lg">
              Request a demo
            </LinkButton>
          </div>
        </div>
        <ProductMock className="landing-hero-enter landing-hero-enter-delay" />
      </div>
    </section>
  );
}
