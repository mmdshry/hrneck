"use client";

import { useState, type FormEvent } from "react";
import { Reveal } from "@/components/landing/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const contactEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@itneck.com";

export function LandingDemoForm() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const company = String(data.get("company") ?? "").trim();
    const role = String(data.get("role") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    const subject = encodeURIComponent(
      `HRNECK demo request — ${company || name || "prospect"}`,
    );
    const body = encodeURIComponent(
      [
        `Name: ${name}`,
        `Work email: ${email}`,
        `Company: ${company}`,
        `Role: ${role}`,
        "",
        message || "(No additional message)",
      ].join("\n"),
    );

    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  return (
    <section
      id="demo"
      className="scroll-mt-24 border-t border-[var(--border)]"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16 md:py-20">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight md:text-4xl">
            Request a demo
          </h2>
          <p className="mt-3 text-[var(--muted-foreground)]">
            Tell us whether you run an MSP or a single organization. We will
            follow up at your work email.
          </p>
          <p className="mt-6 text-sm text-[var(--muted-foreground)]">
            Opens your email client to{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-[var(--primary)] underline-offset-4 hover:underline"
            >
              {contactEmail}
            </a>
            .
          </p>
        </Reveal>

        <Reveal delayMs={60}>
          <form
            onSubmit={onSubmit}
            className="grid gap-4 sm:grid-cols-2"
            noValidate
          >
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="demo-name">Name</Label>
              <Input
                id="demo-name"
                name="name"
                autoComplete="name"
                required
                placeholder="Alex Morgan"
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="demo-email">Work email</Label>
              <Input
                id="demo-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="alex@company.com"
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="demo-company">Company</Label>
              <Input
                id="demo-company"
                name="company"
                autoComplete="organization"
                required
                placeholder="Acme MSP"
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="demo-role">I am with</Label>
              <Select id="demo-role" name="role" required defaultValue="msp">
                <option value="msp">An MSP (multi-organization)</option>
                <option value="organization">A single organization</option>
                <option value="other">Other / evaluating</option>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="demo-message">Message</Label>
              <Textarea
                id="demo-message"
                name="message"
                rows={4}
                placeholder="What would you like to see in a demo?"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" variant="default" size="lg">
                Send request
              </Button>
              {submitted ? (
                <p className="text-sm text-[var(--muted-foreground)]" role="status">
                  If your email app did not open, write to {contactEmail}.
                </p>
              ) : null}
            </div>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
