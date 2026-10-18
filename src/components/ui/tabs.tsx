"use client";
import { Tabs as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
export const Tabs = Primitive.Root;
export function TabsList({
  className,
  ...props
}: ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cn(
        "inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-background p-1",
        className,
      )}
      {...props}
    />
  );
}
export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        "inline-flex min-h-8 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}
export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content
      className={cn("mt-5 outline-none", className)}
      {...props}
    />
  );
}
