"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type SegmentDetailResponse = {
  ok: boolean;
  segment: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    rules: unknown;
    sizeCache: number | null;
    lastComputedAt: string | null;
  };
};

type SegmentPreviewResponse = {
  ok: boolean;
  total: number;
  segment: { id: string; name: string };
  items: Array<{ id: string; userId: string; displayName: string | null; avatarUrl: string | null; lastActivityAt: string | null; totalSpentCents: number; tags: string[] }>;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

export default function CrmSegmentDetailPage() {
  const params = useParams();
  const segmentId = typeof params?.segmentId === "string" ? params.segmentId : "";

  const { data: detail, mutate: mutateDetail } = useSWR<SegmentDetailResponse>(
    segmentId ? `/api/organizacao/crm/segmentos/${segmentId}` : null,
    fetcher,
  );
  const { data: preview, isLoading, mutate: mutatePreview } = useSWR<SegmentPreviewResponse>(
    segmentId ? `/api/organizacao/crm/segmentos/${segmentId}/preview` : null,
    fetcher,
  );

  const segment = detail?.segment ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Segmento</h1>
        <p className={DASHBOARD_MUTED}>Pré-visualização e regras do segmento.</p>
      </header>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}
      >
        {segment ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{segment.name}</p>
                <p className="text-[12px] text-white/60">{segment.description || "Sem descrição"}</p>
              </div>
              <div className="text-right text-[12px] text-white/60">
                <p>Status: {segment.status}</p>
                <p>Atualizado: {formatDate(segment.lastComputedAt)}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/70">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Rules JSON</p>
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(segment.rules ?? {}, null, 2)}</pre>
            </div>
          </>
        ) : (
          <p className="text-[12px] text-white/60">A carregar segmento...</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Pré-visualização</h2>
          <button
            type="button"
            className={CTA_NEUTRAL}
            onClick={() => {
              mutateDetail();
              mutatePreview();
            }}
          >
            Recalcular
          </button>
        </div>
        <div className={cn(DASHBOARD_CARD, "p-4 space-y-3")}
        >
          <p className="text-[12px] text-white/60">
            {isLoading ? "A calcular..." : `${preview?.total ?? 0} clientes no segmento`}
          </p>
          <div className="grid gap-2">
            {preview?.items?.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[12px] font-semibold text-white">{item.displayName || "Cliente"}</p>
                <p className="text-[11px] text-white/50">Última atividade: {formatDate(item.lastActivityAt)}</p>
                {item.tags.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span
                        key={`${item.id}-${tag}`}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-white/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {!isLoading && preview?.items?.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem clientes no segmento.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
