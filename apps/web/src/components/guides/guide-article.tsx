import { ExampleCallout } from "@/components/guides/example-callout";
import { FlowDiagram } from "@/components/guides/flow-diagram";
import { GuideNav } from "@/components/guides/guide-nav";
import { MockScreen } from "@/components/guides/mock-screen";
import {
  GuideIconBadge,
  SectionHeading,
} from "@/components/guides/section-heading";
import { StepList } from "@/components/guides/step-list";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import {
  guideIcon,
  guidesOpenInAppIcon,
  guidesOverviewIcon,
  guidesRelatedIcon,
  guidesStepsIcon,
} from "@/lib/guides/icons";
import {
  getAdjacentGuides,
  getGuide,
  guideHref,
} from "@/lib/guides/registry";
import type { GuideModule } from "@/lib/guides/types";

export function GuideArticle({ guide }: { guide: GuideModule }) {
  const { previous, next } = getAdjacentGuides(guide.slug);
  const relatedGuides = guide.related
    .map((slug) => getGuide(slug))
    .filter((item): item is GuideModule => Boolean(item));
  const Icon = guideIcon(guide.slug);
  const OpenIcon = guidesOpenInAppIcon;
  const sections = guide.sections ?? [];

  return (
    <article className="space-y-8">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <GuideIconBadge icon={Icon} className="h-10 w-10" />
            <span>{guide.title}</span>
          </span>
        }
        description={guide.summary}
        actions={
          guide.openInAppHref ? (
            <LinkButton href={guide.openInAppHref} variant="default">
              <OpenIcon className="h-4 w-4" aria-hidden />
              Open in app
            </LinkButton>
          ) : null
        }
      />

      <section className="space-y-3">
        <SectionHeading icon={guidesOverviewIcon}>Overview</SectionHeading>
        <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
          {guide.overview}
        </p>
      </section>

      <ExampleCallout example={guide.example} />

      <div className="grid gap-6 lg:grid-cols-2">
        <FlowDiagram diagram={guide.diagram} />
        <MockScreen mock={guide.mock} />
      </div>

      <section className="space-y-4">
        <SectionHeading icon={guidesStepsIcon}>Step-by-step</SectionHeading>
        <StepList steps={guide.steps} />
      </section>

      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <SectionHeading icon={guidesStepsIcon}>{section.title}</SectionHeading>
          {section.body ? (
            <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
              {section.body}
            </p>
          ) : null}
          <StepList steps={section.steps} />
        </section>
      ))}

      {relatedGuides.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading icon={guidesRelatedIcon}>Related guides</SectionHeading>
          <ul className="flex flex-wrap gap-2">
            {relatedGuides.map((related) => {
              const RelatedIcon = guideIcon(related.slug);
              return (
                <li key={related.slug}>
                  <LinkButton
                    href={guideHref(related.slug)}
                    variant="outline"
                    size="sm"
                  >
                    <RelatedIcon className="h-3.5 w-3.5" aria-hidden />
                    {related.title}
                  </LinkButton>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <GuideNav previous={previous} next={next} />
    </article>
  );
}
