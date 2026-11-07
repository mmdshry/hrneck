"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  GuidesSearchProvider,
  useGuidesSearch,
} from "@/components/guides/guides-search-context";
import { Input } from "@/components/ui/input";
import { guideIcon, guidesHubIcon, guidesSearchIcon } from "@/lib/guides/icons";
import { guideHref, listGuides, searchGuides } from "@/lib/guides/registry";
import { cn } from "@/lib/utils";

export function DocsChrome({ children }: { children: ReactNode }) {
  return (
    <GuidesSearchProvider>
      <DocsChromeInner>{children}</DocsChromeInner>
    </GuidesSearchProvider>
  );
}

function DocsChromeInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { query, setQuery } = useGuidesSearch();
  const guides = useMemo(() => searchGuides(query), [query]);
  const allCount = listGuides().length;
  const SearchIcon = guidesSearchIcon;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-20 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="docs-nav-search"
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]"
            >
              <SearchIcon className="h-3.5 w-3.5" aria-hidden />
              Search guides
            </label>
            <Input
              id="docs-nav-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Training, SMTP…"
              autoComplete="off"
            />
          </div>
          <nav aria-label="Guides" className="space-y-1">
            <SideLink
              href="/docs"
              active={pathname === "/docs"}
              icon={guidesHubIcon}
            >
              All guides
            </SideLink>
            {guides.map((guide) => {
              const href = guideHref(guide.slug);
              return (
                <SideLink
                  key={guide.slug}
                  href={href}
                  active={pathname === href}
                  icon={guideIcon(guide.slug)}
                >
                  {guide.title}
                </SideLink>
              );
            })}
            {guides.length === 0 ? (
              <p className="px-2 py-2 text-xs text-[var(--muted-foreground)]">
                No guides match “{query}”.
              </p>
            ) : null}
          </nav>
          <p className="px-2 text-[10px] text-[var(--muted-foreground)]">
            Showing {guides.length} of {allCount}
          </p>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SideLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors duration-[var(--motion)]",
        active
          ? "bg-[var(--muted)] font-semibold text-[var(--foreground)]"
          : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}
