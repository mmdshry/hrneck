import { SectionHeading } from "@/components/guides/section-heading";
import { guidesExampleIcon } from "@/lib/guides/icons";
import type { GuideExample } from "@/lib/guides/types";
import { cn } from "@/lib/utils";

export function ExampleCallout({
  example,
  className,
}: {
  example: GuideExample;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "rounded-xl border border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))] p-4",
        className,
      )}
    >
      <SectionHeading
        icon={guidesExampleIcon}
        as="p"
        className="text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]"
      >
        Real example
      </SectionHeading>
      <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">
        {example.title}
      </h3>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{example.narrative}</p>
    </aside>
  );
}
