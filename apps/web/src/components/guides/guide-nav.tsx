import { LinkButton } from "@/components/ui/link-button";
import { guideIcon } from "@/lib/guides/icons";
import { guideHref } from "@/lib/guides/registry";
import type { GuideModule } from "@/lib/guides/types";
import { cn } from "@/lib/utils";

export function GuideNav({
  previous,
  next,
  className,
}: {
  previous: GuideModule | null;
  next: GuideModule | null;
  className?: string;
}) {
  if (!previous && !next) {
    return null;
  }

  return (
    <nav
      aria-label="Adjacent guides"
      className={cn(
        "flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:justify-between",
        className,
      )}
    >
      {previous ? (
        <LinkButton
          href={guideHref(previous.slug)}
          variant="outline"
          className="justify-start sm:max-w-[45%]"
        >
          <PrevNextLabel guide={previous} direction="Previous" />
        </LinkButton>
      ) : (
        <span />
      )}
      {next ? (
        <LinkButton
          href={guideHref(next.slug)}
          variant="outline"
          className="justify-start sm:max-w-[45%] sm:ml-auto"
        >
          <PrevNextLabel guide={next} direction="Next" alignEnd />
        </LinkButton>
      ) : null}
    </nav>
  );
}

function PrevNextLabel({
  guide,
  direction,
  alignEnd = false,
}: {
  guide: GuideModule;
  direction: "Previous" | "Next";
  alignEnd?: boolean;
}) {
  const Icon = guideIcon(guide.slug);
  return (
    <span
      className={cn(
        "flex items-start gap-2",
        alignEnd && "sm:flex-row-reverse",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
      <span
        className={cn(
          "flex flex-col gap-0.5 text-left",
          alignEnd && "sm:items-end sm:text-right",
        )}
      >
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
          {direction}
        </span>
        <span>{guide.title}</span>
      </span>
    </span>
  );
}
