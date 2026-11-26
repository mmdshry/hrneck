"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Reveal } from "@/components/landing/reveal";
import { TurnstileWidget } from "@/components/landing/turnstile-widget";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

const contactEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@hrneck.com";
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export function LandingDemoForm() {
  const t = useTranslations("landing");
  const tLegal = useTranslations("legal");
  const locale = useLocale();
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (status === "success") {
      successHeadingRef.current?.focus();
    }
  }, [status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || turnstileToken === null) return;

    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const company = String(data.get("company") ?? "").trim();
    const role = String(data.get("role") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const website = String(data.get("website") ?? "");

    setStatus("submitting");
    try {
      await api("/api/v1/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          work_email: email,
          company,
          role,
          message,
          locale,
          website,
          "cf-turnstile-response": turnstileToken,
        }),
      });
      setSubmittedEmail(email);
      setStatus("success");
    } catch {
      setStatus("error");
      // A Turnstile token can be used only once, so the next attempt needs a fresh challenge.
      setTurnstileToken(null);
      setCaptchaKey((key) => key + 1);
    }
  }

  return (
    <section
      id="demo"
      className="scroll-mt-24 border-t border-[var(--border)]"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16 md:py-20">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight md:text-4xl">
            {t("demoTitle")}
          </h2>
          <p className="mt-3 text-[var(--muted-foreground)]">
            {t("demoBody")}
          </p>
        </Reveal>

        <Reveal delayMs={60}>
          {status === "success" ? (
            <Alert variant="success" role="status" className="space-y-2 py-[var(--space-md)]">
              <h3
                ref={successHeadingRef}
                tabIndex={-1}
                className="font-[family-name:var(--font-display)] text-xl tracking-tight outline-none"
              >
                {t("demoSuccessTitle")}
              </h3>
              <p>{t("demoSuccessBody", { email: submittedEmail })}</p>
            </Alert>
          ) : (
            <form
              onSubmit={onSubmit}
              className="relative grid gap-4 sm:grid-cols-2"
            >
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="demo-name">{t("name")}</Label>
                <Input
                  id="demo-name"
                  name="name"
                  autoComplete="name"
                  required
                  placeholder={t("namePlaceholder")}
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="demo-email">{t("workEmail")}</Label>
                <Input
                  id="demo-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t("workEmailPlaceholder")}
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="demo-company">{t("company")}</Label>
                <Input
                  id="demo-company"
                  name="company"
                  autoComplete="organization"
                  required
                  placeholder={t("companyPlaceholder")}
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="demo-role">{t("iAmWith")}</Label>
                <Select id="demo-role" name="role" required defaultValue="msp">
                  <option value="msp">{t("roleMsp")}</option>
                  <option value="organization">{t("roleOrganization")}</option>
                  <option value="other">{t("roleOther")}</option>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="demo-message">{t("message")}</Label>
                <Textarea
                  id="demo-message"
                  name="message"
                  rows={4}
                  placeholder={t("messagePlaceholder")}
                />
              </div>

              {/* Honeypot: hidden from people and screen readers; bots tend to fill every input. */}
              <div
                aria-hidden="true"
                className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
              >
                <input
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-label="Website"
                />
              </div>

              {turnstileSiteKey ? (
                <div className="sm:col-span-2">
                  <TurnstileWidget
                    key={captchaKey}
                    siteKey={turnstileSiteKey}
                    onTokenChange={setTurnstileToken}
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  disabled={status === "submitting" || turnstileToken === null}
                  aria-busy={status === "submitting"}
                >
                  {t("sendRequest")}
                </Button>
              </div>
              {status === "error" ? (
                <Alert variant="destructive" role="alert" className="sm:col-span-2">
                  {t("demoSubmitError", { email: contactEmail })}
                </Alert>
              ) : null}
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)] sm:col-span-2">
                {tLegal.rich("demoConsent", {
                  privacy: (chunks) => (
                    <Link
                      href="/privacy"
                      className="font-medium text-[var(--link)] underline-offset-4 hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                  terms: (chunks) => (
                    <Link
                      href="/terms"
                      className="font-medium text-[var(--link)] underline-offset-4 hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
