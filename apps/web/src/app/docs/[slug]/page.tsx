import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GuideArticle } from "@/components/guides/guide-article";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  getGuide,
  isGuideSlug,
  listGuides,
} from "@/lib/guides/registry";

type DocsSlugPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: DocsSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) {
    return { title: "Guide not found" };
  }
  return {
    title: `${guide.title} · Guides`,
    description: guide.summary,
  };
}

export default function DocsSlugPage({ params }: DocsSlugPageProps) {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <DocsSlugContent params={params} />
    </Suspense>
  );
}

async function DocsSlugContent({ params }: DocsSlugPageProps) {
  const { slug } = await params;
  if (!isGuideSlug(slug)) {
    notFound();
  }
  const guide = getGuide(slug);
  if (!guide) {
    notFound();
  }
  return <GuideArticle guide={guide} />;
}
