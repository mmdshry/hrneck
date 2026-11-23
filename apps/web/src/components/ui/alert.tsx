import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "rounded-[var(--radius)] border px-[var(--space-md)] py-[var(--space-sm)] text-sm",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
        destructive:
          "border-[var(--destructive)]/40 bg-[var(--destructive)]/10 text-[var(--destructive)]",
        success:
          "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants>;

export function Alert({ className, variant, role, ...props }: AlertProps) {
  return (
    <div
      role={role ?? (variant === "destructive" ? "alert" : undefined)}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
