import {
  BookOpen,
  Building2,
  ClipboardList,
  Download,
  GraduationCap,
  KeyRound,
  Settings2,
  ShieldAlert,
  Target,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/landing/reveal";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    icon: Building2,
    title: "MSP organizations",
    body: "Manage many client tenants from one workspace — open an org, review status, and keep training posture visible across accounts.",
  },
  {
    icon: GraduationCap,
    title: "Training LMS & campaigns",
    body: "Build courses with lessons and quizzes, assign them to audiences, and run campaigns with email reminders and sending profiles.",
  },
  {
    icon: ClipboardList,
    title: "HR checklists",
    body: "Admin templates for onboarding, offboarding, IT access, and more — versioned builders and instances filled against targets.",
  },
  {
    icon: Ticket,
    title: "ITIL ticketing",
    body: "Incidents, service requests, and changes with desks, stages, SLA, inbound email, search, and technician queues.",
  },
  {
    icon: BookOpen,
    title: "Service portal & KB",
    body: "Give employees a place to submit tickets, add notes, and browse published knowledge base articles.",
  },
  {
    icon: Target,
    title: "Employees & groups",
    body: "Maintain employees and departments, then organize them into Groups for training and checklist assignment — imports, member pickers, and risk-aware targeting.",
  },
  {
    icon: Users,
    title: "Users & roles",
    body: "Separate operator accounts from learners with custom RBAC so each team only sees the tools they need.",
  },
  {
    icon: KeyRound,
    title: "Operator permissions",
    body: "Fine-grained permissions for training, checklists, ticketing, reports, and settings — aligned with real org workflows.",
  },
  {
    icon: ShieldAlert,
    title: "Reporting",
    body: "Campaign analytics and scheduled email reports so MSPs and security leads see completion and posture over time.",
  },
  {
    icon: Download,
    title: "PDF export",
    body: "Export monthly or quarterly PDF archives for business rollups and filtered reviews.",
  },
  {
    icon: GraduationCap,
    title: "Learner portal",
    body: "Employees open assigned courses, track progress, and complete quizzes in a focused learner experience.",
  },
  {
    icon: Settings2,
    title: "Settings & security",
    body: "White-label branding, SMTP and sending profiles, MFA, and org settings that keep delivery and access under control.",
  },
];

export function LandingFeatures() {
  return (
    <section
      id="features"
      className="scroll-mt-24 border-t border-[var(--border)]"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <Reveal className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight md:text-4xl">
            Everything in one platform
          </h2>
          <p className="mt-4 text-[var(--muted-foreground)]">
            Security awareness, HR process, and service desk — explained with
            the modules you actually get.
          </p>
        </Reveal>
        <ul className="mt-14 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal
                key={feature.title}
                as="li"
                delayMs={(index % 3) * 70}
                className="group"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-[var(--brand)] transition-colors duration-[var(--motion)] group-hover:bg-[color-mix(in_srgb,var(--brand)_16%,transparent)]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {feature.body}
                </p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
