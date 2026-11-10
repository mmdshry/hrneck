"use client";

import { useMemo } from "react";
import { GuideIconBadge, SectionHeading } from "@/components/guides/section-heading";
import { useGuidesSearch } from "@/components/guides/guides-search-context";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  guideIcon,
  guidesHubIcon,
  guidesSearchIcon,
  guidesStepsIcon,
} from "@/lib/guides/icons";
import { guideHref, listGuides, searchGuides } from "@/lib/guides/registry";
import type { GuideModule } from "@/lib/guides/types";

const START_HERE = [
  "getting-started",
  "targets-groups",
  "settings",
  "training",
  "reporting",
] as const;

export function GuidesHub() {
  const { query, setQuery } = useGuidesSearch();
  const guides = useMemo(() => searchGuides(query), [query]);
  const startHere = useMemo((): GuideModule[] => {
    return START_HERE.map((slug) =>
      listGuides().find((guide) => guide.slug === slug),
    ).filter((guide): guide is GuideModule => Boolean(guide));
  }, []);
  const SearchIcon = guidesSearchIcon;
  const HubIcon = guidesHubIcon;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Guides"
        description="Illustrated guides for org operators, learners, the service portal, and MSP staff—diagrams, annotated mock screens, and real scenarios. No live API calls."
        actions={
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] bg-[var(--muted)] text-[var(--primary)]"
            aria-hidden
          >
            <HubIcon className="h-5 w-5" />
          </span>
        }
      />

      <div className="space-y-2 lg:hidden">
        <label
          htmlFor="docs-hub-search"
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]"
        >
          <SearchIcon className="h-3.5 w-3.5" aria-hidden />
          Search guides
        </label>
        <Input
          id="docs-hub-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search training, ticketing, SMTP…"
          autoComplete="off"
        />
      </div>

      {!query ? (
        <section className="space-y-4">
          <SectionHeading icon={guidesStepsIcon}>Start here</SectionHeading>
          <ol className="grid gap-3 sm:grid-cols-2">
            {startHere.map((guide, index) => {
              const Icon = guideIcon(guide.slug);
              return (
                <li key={guide.slug}>
                  <LinkButton
                    href={guideHref(guide.slug)}
                    variant="outline"
                    className="h-auto w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <GuideIconBadge icon={Icon} />
                    <span className="flex min-w-0 flex-col items-start gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                        Step {index + 1}
                      </span>
                      <span className="font-semibold">{guide.title}</span>
                      <span className="text-xs font-normal text-[var(--muted-foreground)]">
                        {guide.summary}
                      </span>
                    </span>
                  </LinkButton>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <SectionHeading icon={guidesHubIcon}>All capabilities</SectionHeading>
          <p className="text-xs text-[var(--muted-foreground)]">
            {guides.length} guide{guides.length === 1 ? "" : "s"}
          </p>
        </div>
        {guides.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No guides match “{query}”. Try training, portal, MFA, or SMTP.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {guides.map((guide) => {
              const Icon = guideIcon(guide.slug);
              return (
                <li key={guide.slug}>
                  <LinkButton
                    href={guideHref(guide.slug)}
                    variant="secondary"
                    className="h-auto w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <GuideIconBadge icon={Icon} />
                    <span className="flex min-w-0 flex-col items-start gap-1">
                      <span className="font-semibold">{guide.title}</span>
                      <span className="text-xs font-normal text-[var(--muted-foreground)]">
                        {guide.summary}
                      </span>
                    </span>
                  </LinkButton>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
