import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LinkButtonProps = ComponentProps<typeof Link> &
  Pick<ButtonProps, "variant" | "size">;

export function LinkButton({
  className,
  variant,
  size,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
