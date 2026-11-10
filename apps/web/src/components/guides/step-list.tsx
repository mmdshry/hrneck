import { LinkButton } from "@/components/ui/link-button";
import { guidesOpenInAppIcon } from "@/lib/guides/icons";
import type { GuideStep } from "@/lib/guides/types";
import { cn } from "@/lib/utils";

export function StepList({
  steps,
  className,
}: {
  steps: GuideStep[];
  className?: string;
}) {
  const OpenIcon = guidesOpenInAppIcon;

  return (
    <ol className={cn("space-y-4", className)}>
      {steps.map((step, index) => (
        <li
          key={`${index}-${step.title}`}
          className="flex gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]"
            aria-hidden
          >
            {index + 1}
          </span>
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              {step.title}
            </h3>
            <p className="text-sm text-[var(--muted-foreground)]">{step.body}</p>
            {step.href ? (
              <LinkButton href={step.href} variant="link" className="inline-flex w-fit px-0">
                <OpenIcon className="h-3.5 w-3.5" aria-hidden />
                Open in app
              </LinkButton>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
