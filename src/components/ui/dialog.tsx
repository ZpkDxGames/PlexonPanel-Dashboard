"use client";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogTitle = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Title>) => (
  <Primitive.Title
    className={cn("text-lg font-semibold tracking-tight", className)}
    {...props}
  />
);
export const DialogDescription = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Description>) => (
  <Primitive.Description
    className={cn(
      "mt-2 text-xs leading-relaxed text-muted-foreground",
      className,
    )}
    {...props}
  />
);
export function DialogContent({
  children,
  className,
  hideClose = false,
  ...props
}: ComponentProps<typeof Primitive.Content> & { hideClose?: boolean }) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" />
      <Primitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl",
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <Primitive.Close
            aria-label="Close dialog"
            className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </Primitive.Close>
        )}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
