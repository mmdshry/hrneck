import { Building2, LineChart, Workflow } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

const STEPS = [
  {
    icon: Building2,
    title: "Onboard organizations",
    body: "Stand up client tenants from the MSP workspace, or configure a single organization with roles, targets, and branding.",
  },
  {
    icon: Workflow,
    title: "Run training, checklists, and tickets",
    body: "Assign LMS campaigns, fill HR checklist instances, and resolve service-desk work with desks, SLA, and knowledge base.",
  },
  {
    icon: LineChart,
    title: "Measure risk and export",
    body: "Watch completion and posture live, then schedule reports or export PDF archives for quarterly reviews.",
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-t border-[var(--border)] bg-[var(--background)]"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <Reveal className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight md:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-[var(--muted-foreground)]">
            Three steps from empty tenant to measurable security awareness
            posture.
          </p>
        </Reveal>
        <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} as="li" delayMs={index * 80}>
                <div className="flex h-full flex-col p-1">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    Step {index + 1}
                  </p>
                  <span className="mt-5 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand)]">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
