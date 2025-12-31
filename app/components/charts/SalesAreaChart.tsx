"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type SalesAreaPoint = {
  date: string; // ISO ou YYYY-MM-DD
  gross: number;
  net: number;
};

const chartConfig = {
  gross: {
    label: "Bruto",
    color: "var(--chart-gross)",
  },
  net: {
    label: "Líquido",
    color: "var(--chart-net)",
  },
} satisfies ChartConfig;

type Props = {
  data: SalesAreaPoint[];
  periodLabel: string;
  height?: number;
};

const formatEuro = (value: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(value);

export function SalesAreaChart({ data, periodLabel, height = 260 }: Props) {
  const parsed = React.useMemo(
    () =>
      data
        .map((p) => ({
          ...p,
          dateObj: new Date(p.date),
        }))
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()),
    [data],
  );

  return (
    <ChartContainer
      config={chartConfig}
      className="relative h-full w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2"
      style={
        {
          "--chart-gross": "#6BFFFF",
          "--chart-net": "#1646F5",
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between px-2 pb-2">
        <div>
          <p className="text-[12px] font-semibold text-white">Evolução de vendas</p>
          <p className="text-[11px] text-white/60">{periodLabel}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={parsed} margin={{ top: 10, left: 0, right: 0 }}>
          <defs>
            <linearGradient id="fillGross" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-gross)" stopOpacity={0.65} />
              <stop offset="95%" stopColor="var(--chart-gross)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-net)" stopOpacity={0.65} />
              <stop offset="95%" stopColor="var(--chart-net)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={22}
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString("pt-PT", {
                day: "2-digit",
                month: "short",
              })
            }
            style={{ fontSize: "11px", fill: "rgba(255,255,255,0.65)" }}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(value) =>
                  new Date(value as string).toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                }
                formatter={(value, name) => {
                  const label = name === "gross" ? "Bruto" : "Líquido";
                  return `${label}: ${formatEuro(value as number)}`;
                }}
              />
            }
          />
          <Area
            dataKey="gross"
            type="monotone"
            stroke="var(--chart-gross)"
            fill="url(#fillGross)"
            strokeWidth={2.4}
            activeDot={{ r: 5, strokeWidth: 0 }}
            dot={false}
          />
          <Area
            dataKey="net"
            type="monotone"
            stroke="var(--chart-net)"
            fill="url(#fillNet)"
            strokeWidth={2.4}
            activeDot={{ r: 5, strokeWidth: 0 }}
            dot={false}
          />
          <Legend content={<ChartLegendContent />} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
