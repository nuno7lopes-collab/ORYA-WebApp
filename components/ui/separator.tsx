import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
};

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(function Separator(
  { className, orientation = "horizontal", role = "separator", ...props },
  ref,
) {
  const isVertical = orientation === "vertical";

  return (
    <div
      ref={ref}
      role={role}
      className={cn(
        "shrink-0 bg-border",
        isVertical ? "h-full w-px" : "h-px w-full",
        className,
      )}
      {...props}
    />
  );
});

Separator.displayName = "Separator";
