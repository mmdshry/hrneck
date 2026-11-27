"use client";

import { usePathname } from "next/navigation";

export function SkipLink() {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return null;
  return (
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
  );
}
