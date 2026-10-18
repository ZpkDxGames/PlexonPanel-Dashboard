import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:brightness-110",
        outline: "border-border bg-card text-foreground hover:bg-muted",
        secondary:
          "border-transparent bg-muted text-foreground hover:brightness-110",
        ghost:
          "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "border-rose-500/25 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300",
      },
      size: {
        default: "h-10 px-3.5",
        sm: "h-8 px-3",
        icon: "size-10",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
