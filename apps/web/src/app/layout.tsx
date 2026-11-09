import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { AppToaster } from "@/components/app-toaster";
import { BrandingProvider } from "@/components/branding-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SkipLink } from "@/components/ui/skip-link";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const brand = process.env.NEXT_PUBLIC_BRAND_SHORT ?? "HRNECK";
const brandName =
  process.env.NEXT_PUBLIC_BRAND_NAME ?? "HRNECK Training Portal";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://hrneck.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: brandName,
    template: `%s · ${brand}`,
  },
  description:
    "Security awareness training for MSPs and organizations — LMS, HR checklists, ITIL ticketing, and reporting in one workspace.",
  openGraph: {
    title: brandName,
    description:
      "Security awareness training for MSPs and organizations — LMS, HR checklists, ITIL ticketing, and reporting in one workspace.",
    type: "website",
    siteName: brand,
  },
  robots: {
    index: true,
    follow: true,
  },
};

/** ThemeProvider is a client boundary; skip instant-nav validation for this tree. */
export const instant = false;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${sans.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
        <SkipLink />
        <Suspense fallback={null}>
          <ThemeProvider>
            <BrandingProvider>
              <main id="main-content" className="flex min-h-full flex-1 flex-col">
                {children}
              </main>
              <AppToaster />
            </BrandingProvider>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
