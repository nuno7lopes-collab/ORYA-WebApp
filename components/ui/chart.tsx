import * as React from "react";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label: string;
    color?: string;
  }
>;

type ChartContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  config: ChartConfig;
};

export function ChartContainer({ config, className, children, ...props }: ChartContainerProps) {
  return (
    <div
      data-chart-config={JSON.stringify(config)}
      className={cn(
        "relative flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type LegendProps = {
  payload?: Array<{ value: string; color?: string; dataKey?: string }>;
};

export function ChartLegend({ payload }: LegendProps) {
  if (!payload?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-white/80">
      {payload.map((item) => (
        <span key={item.dataKey || item.value} className="inline-flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: item.color || "var(--foreground)" }}
          />
          {item.value}
        </span>
      ))}
    </div>
  );
}

type TooltipContentProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name: string; value: number; color: string }>;
  labelFormatter?: (value: string | number) => React.ReactNode;
  formatter?: (value: number, name: string) => React.ReactNode;
};

export function ChartTooltipContent({
  active,
  label,
  payload,
  labelFormatter,
  formatter,
}: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;

  const labelText = labelFormatter ? labelFormatter(label ?? "") : label;

  return (
    <div className="rounded-xl border border-white/12 bg-black/80 px-3 py-2 text-[12px] shadow-lg">
      <div className="mb-2 text-white/90">{labelText}</div>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-white/80">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            <span className="flex-1">
              {formatter ? formatter(item.value, item.name) : `${item.name}: ${item.value}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ChartTooltip = (props: React.ComponentProps<"div">) => {
  return <div {...props} />;
};

export function ChartLegendContent(props: LegendProps) {
  return <ChartLegend {...props} />;
}
