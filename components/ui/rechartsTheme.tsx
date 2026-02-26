import * as React from "react";

type PieLabelProps = {
  cx?: number | string;
  cy?: number | string;
  midAngle?: number | string;
  outerRadius?: number | string;
  percent?: number;
};

function toNumber(value: number | string | undefined, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export const RECHARTS_AXIS_TICK_STYLE = {
  fill: "rgb(var(--theme-text-rgb) / 0.9)",
  fontSize: 12,
  fontWeight: 500,
} as const;

export const RECHARTS_TOOLTIP_CONTENT_STYLE = {
  background: "linear-gradient(155deg, rgba(10,16,32,0.95), rgba(6,11,22,0.99))",
  border: "1px solid rgba(226, 232, 240, 0.34)",
  borderRadius: 12,
  boxShadow: "0 16px 34px rgba(0,0,0,0.45)",
  color: "rgba(248, 250, 252, 0.95)",
  padding: "10px 12px",
} as const;

export const RECHARTS_TOOLTIP_ITEM_STYLE = {
  color: "rgba(248, 250, 252, 0.92)",
  fontSize: 12,
  fontWeight: 500,
  padding: 0,
  lineHeight: "1.42",
} as const;

export const RECHARTS_TOOLTIP_LABEL_STYLE = {
  color: "rgba(248, 250, 252, 0.96)",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 6,
} as const;

export const RECHARTS_TOOLTIP_CURSOR_STYLE = {
  fill: "rgba(148, 163, 184, 0.12)",
} as const;

export const RECHARTS_LEGEND_WRAPPER_STYLE = {
  paddingTop: 8,
} as const;

export function formatRechartsLegendLabel(value: string | number) {
  return (
    <span
      style={{
        color: "rgb(var(--theme-text-rgb) / 0.9)",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {value}
    </span>
  );
}

export function renderReadablePiePercentLabel(props: PieLabelProps) {
  const percent = Math.max(0, Number(props.percent ?? 0));
  if (percent < 0.035) return null;

  const cx = toNumber(props.cx);
  const cy = toNumber(props.cy);
  const midAngle = toNumber(props.midAngle);
  const outerRadius = toNumber(props.outerRadius);
  const radius = outerRadius + 13;
  const radian = Math.PI / 180;
  const x = cx + radius * Math.cos(-midAngle * radian);
  const y = cy + radius * Math.sin(-midAngle * radian);
  const anchor = x > cx ? "start" : "end";

  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      fill="rgba(248, 250, 252, 0.95)"
      fontSize={11}
      fontWeight={700}
      paintOrder="stroke"
      stroke="rgba(8, 12, 24, 0.78)"
      strokeWidth={1.2}
      strokeLinejoin="round"
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}
