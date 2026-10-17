"use client";
import { Dialog as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export const DialogClose = Primitive.Close;
export function DialogContent({
  children,
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="workbench-overlay" />
      <Primitive.Content
        className={cn("workbench-dialog", className)}
        {...props}
      >
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
