"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AssetItem = {
  id: number;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  maxDownloads: number | null;
};

type GrantItem = {
  id: number;
  downloadsCount: number;
  expiresAt: string | null;
  createdAt: string;
  order: {
    id: number;
    orderNumber: string | null;
    createdAt: string;
  };
  store: {
    id: number;
    displayName: string;
    username: string | null;
  };
  product: {
    id: number;
    name: string;
    slug: string;
  };
  assets: AssetItem[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function StoreDownloadsPage() {
  const [items, setItems] = useState<GrantItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/store/digital/grants", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Erro ao carregar downloads.");
        }
        setItems(Array.isArray(json.grants) ? json.grants : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleDownload = async (grantId: number, assetId: number) => {
    setDownloadingId(`${grantId}-${assetId}`);
    setError(null);
    try {
      const res = await fetch("/api/store/digital/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId, assetId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || "Erro ao preparar download.");
      }
      window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="relative orya-page-width flex flex-col gap-6 px-4 pb-16 pt-10">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-white/5 px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-white/55">Area pessoal</p>
            <h1 className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-3xl font-bold leading-tight text-transparent">
              Downloads da Loja
            </h1>
            <p className="text-sm text-white/70">Acede aos produtos digitais das tuas compras.</p>
          </div>
          <Link
            href="/me/compras"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
          >
            Voltar a compras
          </Link>
        </header>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
            A carregar downloads...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {!loading && items.length === 0 ? (
          <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            <p className="text-lg font-semibold text-white">Sem downloads por agora.</p>
            <p className="mt-2 text-sm text-white/70">
              Quando comprares um produto digital, os ficheiros vao aparecer aqui.
            </p>
          </div>
        ) : null}

        <div className="space-y-4">
          {items.map((grant) => {
            const storeLink = grant.store.username ? `/${grant.store.username}/loja` : null;
            return (
              <div
                key={grant.id}
                className="rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(2,6,16,0.88))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/80">
                        {grant.store.displayName}
                      </span>
                      {storeLink ? (
                        <Link
                          href={storeLink}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                        >
                          Ver loja
                        </Link>
                      ) : null}
                    </div>
                    <p className="text-sm text-white/70">
                      {grant.product.name} · {formatDate(grant.order.createdAt)}
                    </p>
                    <p className="text-xs text-white/50">Encomenda {grant.order.orderNumber ?? grant.order.id}</p>
                  </div>
                  <div className="text-xs text-white/60">Downloads usados: {grant.downloadsCount}</div>
                </div>

                {grant.assets.length === 0 ? (
                  <p className="mt-3 text-xs text-white/50">Sem ficheiros ativos.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {grant.assets.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm text-white">{asset.filename}</p>
                          <p className="text-xs text-white/60">
                            {formatSize(asset.sizeBytes)} · {asset.mimeType}
                            {asset.maxDownloads ? ` · Max ${asset.maxDownloads}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={downloadingId === `${grant.id}-${asset.id}`}
                          onClick={() => handleDownload(grant.id, asset.id)}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 hover:border-white/40 disabled:opacity-60"
                        >
                          {downloadingId === `${grant.id}-${asset.id}` ? "A preparar..." : "Download"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
