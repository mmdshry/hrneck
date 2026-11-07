import type { Metadata } from "next";
import { LandingAudiences } from "@/components/landing/landing-audiences";
import { LandingDemoForm } from "@/components/landing/landing-demo-form";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";

const brandName =
  process.env.NEXT_PUBLIC_BRAND_NAME ?? "HRNECK Training Portal";

export const metadata: Metadata = {
  title: brandName,
  description:
    "Security awareness training for MSPs and organizations — LMS campaigns, HR checklists, ITIL ticketing, reporting, and learner portals in one workspace.",
  openGraph: {
    title: brandName,
    description:
      "Train people and track risk across every client organization — from one calm, modern workspace.",
  },
};

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHeader />
      <LandingHero />
      <LandingHowItWorks />
      <LandingFeatures />
      <LandingAudiences />
      <LandingDemoForm />
      <LandingFooter />
    </div>
  );
}
