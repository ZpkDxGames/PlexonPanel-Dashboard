"use client";
import { Switch as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
export function Switch(props: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className="inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent bg-muted transition-colors data-[state=checked]:bg-primary disabled:opacity-40"
      {...props}
    >
      <Primitive.Thumb className="block size-4 translate-x-1 rounded-full bg-foreground shadow-sm transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground" />
    </Primitive.Root>
  );
}
