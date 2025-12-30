"use client";

import { useId, useMemo, useState } from "react";

type InputPoint = {
  date: string | Date;
  value: number;
  grossCents?: number;
  discountCents?: number;
  platformFeeCents?: number;
  netCents?: number;
};
type Point = {
  date: Date;
  value: number;
  grossCents?: number;
  discountCents?: number;
  platformFeeCents?: number;
  netCents?: number;
};

type Props = {
  data: InputPoint[];
  unit?: "eur" | "tickets";
  periodLabel?: string;
  metricLabel?: string;
  accentColor?: string;
  className?: string;
  rangeDays?: number | "all";
  startDate?: Date;
  endDate?: Date;
};

/**
 * Gráfico de linha/área responsivo, sem overflow fora do card.
 * Usa viewBox normalizada (0..100) e preserveAspectRatio default para manter proporções dentro do container.
 */
export function SalesLineChart({
  data,
  unit = "eur",
  periodLabel,
  metricLabel,
  accentColor = "#6BFFFF",
  className,
  rangeDays,
  startDate,
  endDate,
}: Props) {
  const gradientId = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const processed: Point[] = useMemo(() => {
    return data.map((d) => ({
      date: typeof d.date === "string" ? new Date(d.date) : d.date,
      value: Number.isFinite(d.value) ? d.value : 0,
      grossCents: d.grossCents ?? undefined,
      discountCents: d.discountCents ?? undefined,
      platformFeeCents: d.platformFeeCents ?? undefined,
      netCents: d.netCents ?? undefined,
    }));
  }, [data]);

  // Preencher datas em falta para ter linha contínua desde o início do período
  const derivedEnd =
    endDate ??
    (processed.length ? processed.reduce((latest, p) => (p.date > latest ? p.date : latest), processed[0].date) : new Date());
  const derivedStart = (() => {
    if (startDate) return startDate;
    if (rangeDays && rangeDays !== "all") {
      const d = new Date(derivedEnd);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (rangeDays - 1));
      return d;
    }
    if (processed.length) {
      return processed.reduce((earliest, p) => (p.date < earliest ? p.date : earliest), processed[0].date);
    }
    const d = new Date(derivedEnd);
    d.setDate(d.getDate() - 6);
    return d;
  })();

  const dateMap = new Map<
    string,
    {
      value: number;
      grossCents?: number;
      discountCents?: number;
      platformFeeCents?: number;
      netCents?: number;
    }
  >();
  processed.forEach((p) => {
    const key = p.date.toISOString().slice(0, 10);
    const prev = dateMap.get(key) ?? { value: 0, grossCents: 0, discountCents: 0, platformFeeCents: 0, netCents: 0 };
    dateMap.set(key, {
      value: prev.value + p.value,
      grossCents: (prev.grossCents ?? 0) + (p.grossCents ?? 0),
      discountCents: (prev.discountCents ?? 0) + (p.discountCents ?? 0),
      platformFeeCents: (prev.platformFeeCents ?? 0) + (p.platformFeeCents ?? 0),
      netCents: (prev.netCents ?? 0) + (p.netCents ?? p.value),
    });
  });

  const filled: Point[] = [];
  const cursor = new Date(derivedStart);
  cursor.setHours(0, 0, 0, 0);
  const endCursor = new Date(derivedEnd);
  endCursor.setHours(0, 0, 0, 0);
  while (cursor <= endCursor) {
    const key = cursor.toISOString().slice(0, 10);
    const entry = dateMap.get(key);
    filled.push({
      date: new Date(cursor),
      value: entry?.value ?? 0,
      grossCents: entry?.grossCents ?? 0,
      discountCents: entry?.discountCents ?? 0,
      platformFeeCents: entry?.platformFeeCents ?? 0,
      netCents: entry?.netCents ?? entry?.value ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const values = filled.map((p) => p.value);
  const maxVal = values.length ? Math.max(...values, 0) : 0;
  const paddedMax = maxVal <= 0 ? 10 : Math.ceil(maxVal * 1.2) + 1; // 20% headroom
  const minVal = 0;

  // ViewBox mais achatado para evitar distorção de texto/linha
  const viewW = 100;
  const viewH = 50;
  const padX = 8;
  const padY = 8;
  const innerW = viewW - padX * 2;
  const innerH = viewH - padY * 2;

  const minTime = derivedStart.getTime();
  const maxTime = endCursor.getTime() === minTime ? endCursor.getTime() + 24 * 3600 * 1000 : endCursor.getTime();

  const toXY = (p: Point, index: number) => {
    const t = p.date.getTime();
    const ratioX = (t - minTime) / (maxTime - minTime || 1);
    const x = padX + ratioX * innerW;
    const ratio = paddedMax === minVal ? 0 : (p.value - minVal) / (paddedMax - minVal);
    const y = viewH - padY - ratio * innerH;
    return { x, y };
  };

  const path = filled.length
    ? filled
        .map((p, i) => {
          const { x, y } = toXY(p, i);
          return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ")
    : "";

  const baseXStart = padX;
  const baseXEnd = padX + innerW;
  const baseY = viewH - padY;
  const firstPoint = filled.length ? toXY(filled[0], 0) : { x: baseXStart, y: baseY };
  const lastPoint = filled.length ? toXY(filled[filled.length - 1], filled.length - 1) : { x: baseXEnd, y: baseY };
  const areaPath = filled.length
    ? `${path} L ${lastPoint.x.toFixed(2)} ${baseY.toFixed(2)} L ${firstPoint.x.toFixed(2)} ${baseY.toFixed(2)} Z`
    : "";

  const last = filled[filled.length - 1];
  const lastLabel = (() => {
    if (!last) return "—";
    if (unit === "tickets") return `${last.value} bilhetes`;
    return `${last.value.toFixed(2)} €`;
  })();

  const formatDate = (d: Date) =>
    d.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
    });

  const positions = useMemo(() => {
    return filled.map((p, idx) => {
      const { x, y } = toXY(p, idx);
      return { x, y };
    });
  }, [filled]);

  const handleMove = (evt: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = (evt.currentTarget as SVGSVGElement).getBoundingClientRect();
    const relX = ((evt.clientX - rect.left) / rect.width) * viewW;
    if (!positions.length) return;
    let nearestIdx = 0;
    let nearestDist = Math.abs(relX - positions[0].x);
    for (let i = 1; i < positions.length; i++) {
      const dist = Math.abs(relX - positions[i].x);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    setHoverIdx(nearestIdx);
  };

  const handleLeave = () => setHoverIdx(null);

  const activePoint = hoverIdx != null ? filled[hoverIdx] : filled[filled.length - 1];
  const activePos = hoverIdx != null ? positions[hoverIdx] : positions[positions.length - 1];
  const toEuros = (cents?: number) => `${((cents ?? 0) / 100).toFixed(2)} €`;

  return (
    <div className={`relative w-full h-full overflow-hidden ${className ?? ""}`}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${metricLabel ?? "Gráfico"} ${periodLabel ?? ""} · último ${lastLabel}`}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <defs>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {filled.length > 0 && (
          <>
            <path d={areaPath} fill={`url(#${gradientId}-fill)`} stroke="none" />
            <path d={path} fill="none" stroke={accentColor} strokeWidth={1} strokeLinecap="round" />
            {filled.length > 0 && (
              (() => {
                const lastIdx = filled.length - 1;
                const { x, y } = toXY(filled[lastIdx], lastIdx);
                return (
                  <g>
                    <circle cx={x} cy={y} r={1} fill={accentColor} opacity={0.2} />
                    <circle cx={x} cy={y} r={1} fill={accentColor} stroke={accentColor} strokeWidth={0.4} />
                  </g>
                );
              })()
            )}
          </>
        )}

        {filled.length >= 1 && (
          <g fontSize="2.4" fontFamily="Inter, system-ui, sans-serif" fill="#ffffff">
            {filled.map((p, idx) => {
              const total = filled.length;
              const step = total > 14 ? Math.ceil(total / 8) : 1;
              if (total > 14 && idx % step !== 0 && idx !== total - 1 && idx !== 0) return null;
              const { x } = toXY(p, idx);
              return (
                <g key={`${p.date.toISOString()}-tick`}>
                  <line x1={x} x2={x} y1={viewH - 6} y2={viewH - 3} stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
                  <text x={x} y={viewH - 1} textAnchor="middle" fill="#ffffff">
                    {formatDate(p.date)}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
      {activePoint && activePos && (
        <div
          className="pointer-events-none absolute rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-[11px] text-white/80 shadow-lg backdrop-blur"
          style={{
            left: `${(activePos.x / viewW) * 100}%`,
            top: `${(activePos.y / viewH) * 100}%`,
            transform: "translate(-50%, -110%)",
            minWidth: 140,
          }}
        >
          <div className="text-white font-semibold">
            {formatDate(activePoint.date)} · {unit === "tickets" ? `${activePoint.value} bilhetes` : `${activePoint.value.toFixed(2)} €`}
          </div>
          {unit !== "tickets" && (
            <div className="mt-1 space-y-0.5">
              <div className="flex justify-between gap-3">
                <span>Bruto</span>
                <span>{toEuros(activePoint.grossCents)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Desconto</span>
                <span>-{toEuros(activePoint.discountCents)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Taxas</span>
                <span>-{toEuros(activePoint.platformFeeCents)}</span>
              </div>
              <div className="flex justify-between gap-3 text-white">
                <span>Líquido</span>
                <span>{toEuros(activePoint.netCents ?? activePoint.value * 100)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
