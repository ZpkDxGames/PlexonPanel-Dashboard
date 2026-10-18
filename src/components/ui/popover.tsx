"use client";
import { Popover as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export function PopoverContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border bg-card p-4 text-xs shadow-xl shadow-black/30 outline-none",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
