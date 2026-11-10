import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-[var(--radius)] border px-3 py-2.5 text-sm", {
  variants: {
    variant: {
      default:
        "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
      destructive:
        "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]",
      success:
        "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

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
