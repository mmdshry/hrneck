import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppToaster } from "@/components/app-toaster";
import { BrandingProvider } from "@/components/branding-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SkipLink } from "@/components/ui/skip-link";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  // Plus Jakarta Sans covers Latin + Latin Ext; Cyrillic falls back to system UI.
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const brand = process.env.NEXT_PUBLIC_BRAND_SHORT ?? "HRneck";
const brandName =
  process.env.NEXT_PUBLIC_BRAND_NAME ?? "HRneck Training Portal";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir="ltr"
      className={`${sans.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
        <SkipLink />
        {/* Keep the main landmark outside Suspense so axe/SSR always see it. */}
        <main id="main-content" className="flex min-h-full flex-1 flex-col">
          <Suspense fallback={null}>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <ThemeProvider>
                <BrandingProvider>
                  {children}
                  <AppToaster />
                </BrandingProvider>
              </ThemeProvider>
            </NextIntlClientProvider>
          </Suspense>
        </main>
      </body>
    </html>
  );
}
