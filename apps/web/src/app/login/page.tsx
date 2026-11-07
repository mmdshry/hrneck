import { Suspense } from "react";
import { LinkButton } from "@/components/ui/link-button";
import { MinimalLoader } from "@/components/ui/minimal-loader";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in",
  description: "Sign in to the HRNECK Training Portal with email and password.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-6 flex items-center justify-end">
        <ThemeToggle />
      </div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Use your MSP or organization credentials.
        {process.env.NODE_ENV === "development"
          ? " Demo: admin@hrneck.test"
          : null}
      </p>
      <Suspense fallback={<MinimalLoader className="min-h-40 py-10" />}>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        <LinkButton href="/" variant="link" size="sm">
          Back to home
        </LinkButton>
      </p>
    </div>
  );
}
