"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AssetItem = {
  id: number;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  maxDownloads: number | null;
};

type GrantItem = {
  id: number;
  downloadToken?: string;
  downloadsCount: number;
  expiresAt: string | null;
  createdAt: string;
  order: {
    id: number;
    orderNumber: string | null;
    createdAt: string;
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

export default function StorefrontDownloadsClient({
  storeId,
  storeBaseHref,
}: {
  storeId: number;
  storeBaseHref: string;
}) {
  const [authGrants, setAuthGrants] = useState<GrantItem[]>([]);
  const [guestGrants, setGuestGrants] = useState<GrantItem[]>([]);
  const [authState, setAuthState] = useState<"idle" | "ready" | "unauth">("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestForm, setGuestForm] = useState({ email: "", orderNumber: "" });
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const hasAuthDownloads = useMemo(() => authGrants.length > 0, [authGrants]);
  const hasGuestDownloads = useMemo(() => guestGrants.length > 0, [guestGrants]);

  const loadAuthGrants = async () => {
    setLoadingAuth(true);
    setAuthError(null);
    try {
      const res = await fetch(`/api/store/digital/grants?storeId=${storeId}`, { cache: "no-store" });
      if (res.status === 401) {
        setAuthState("unauth");
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar downloads.");
      }
      setAuthGrants(Array.isArray(json.grants) ? json.grants : []);
      setAuthState("ready");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    void loadAuthGrants();
  }, [storeId]);

  const handleLookup = async () => {
    if (!guestForm.email.trim() || !guestForm.orderNumber.trim()) {
      setGuestError("Preenche email e numero da encomenda.");
      return;
    }
    setLoadingGuest(true);
    setGuestError(null);
    try {
      const res = await fetch(`/api/store/digital/lookup?storeId=${storeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: guestForm.email,
          orderNumber: guestForm.orderNumber,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao procurar encomenda.");
      }
      setGuestGrants(Array.isArray(json.grants) ? json.grants : []);
    } catch (err) {
      setGuestError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingGuest(false);
    }
  };

  const handleAuthDownload = async (grantId: number, assetId: number) => {
    setDownloadingId(`auth-${grantId}-${assetId}`);
    setAuthError(null);
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
      setAuthError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleGuestDownload = async (token: string, assetId: number) => {
    setDownloadingId(`guest-${assetId}`);
    setGuestError(null);
    try {
      const params = new URLSearchParams({ token, assetId: String(assetId) });
      const res = await fetch(`/api/store/digital/download?${params.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || "Erro ao preparar download.");
      }
      window.location.assign(json.url);
    } catch (err) {
      setGuestError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/55">Downloads</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Produtos digitais</h2>
            <p className="text-sm text-white/65">Descarrega os teus ficheiros com seguranca.</p>
          </div>
          <Link
            href={storeBaseHref}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 hover:border-white/40"
          >
            Voltar a loja
          </Link>
        </div>

        {loadingAuth ? (
          <p className="text-sm text-white/60">A carregar downloads...</p>
        ) : authState === "unauth" ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
            Inicia sessao para ver os teus downloads.
          </div>
        ) : hasAuthDownloads ? (
          <div className="space-y-3">
            {authGrants.map((grant) => (
              <div key={grant.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{grant.product.name}</p>
                    <p className="text-xs text-white/60">
                      Encomenda {grant.order.orderNumber ?? grant.order.id} · {formatDate(grant.order.createdAt)}
                    </p>
                  </div>
                  <span className="text-[11px] text-white/50">Downloads usados: {grant.downloadsCount}</span>
                </div>
                {grant.assets.length === 0 ? (
                  <p className="mt-3 text-xs text-white/50">Sem ficheiros ativos.</p>
                ) : (
                  <div className="mt-3 space-y-2">
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
                          disabled={downloadingId === `auth-${grant.id}-${asset.id}`}
                          onClick={() => handleAuthDownload(grant.id, asset.id)}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 hover:border-white/40 disabled:opacity-60"
                        >
                          {downloadingId === `auth-${grant.id}-${asset.id}` ? "A preparar..." : "Download"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : authState === "ready" ? (
          <p className="text-sm text-white/60">Sem downloads associados a esta loja.</p>
        ) : null}

        {authError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {authError}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/55">Sem login</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Encomenda + email</h2>
          <p className="text-sm text-white/65">Usa os dados da compra para desbloquear downloads.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={guestForm.email}
            onChange={(e) => setGuestForm((prev) => ({ ...prev, email: e.target.value }))}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="Email"
          />
          <input
            value={guestForm.orderNumber}
            onChange={(e) => setGuestForm((prev) => ({ ...prev, orderNumber: e.target.value }))}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            placeholder="Numero da encomenda"
          />
        </div>
        <button
          type="button"
          onClick={handleLookup}
          disabled={loadingGuest}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/90 px-5 py-2 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(255,255,255,0.2)] disabled:opacity-60"
        >
          {loadingGuest ? "A procurar..." : "Procurar"}
        </button>

        {guestError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {guestError}
          </div>
        )}

        {hasGuestDownloads ? (
          <div className="space-y-3">
            {guestGrants.map((grant) => (
              <div key={grant.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{grant.product.name}</p>
                    <p className="text-xs text-white/60">
                      Encomenda {grant.order.orderNumber ?? grant.order.id} · {formatDate(grant.order.createdAt)}
                    </p>
                  </div>
                </div>
                {grant.assets.length === 0 ? (
                  <p className="mt-3 text-xs text-white/50">Sem ficheiros ativos.</p>
                ) : (
                  <div className="mt-3 space-y-2">
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
                        {grant.downloadToken ? (
                          <button
                            type="button"
                            disabled={downloadingId === `guest-${asset.id}`}
                            onClick={() => handleGuestDownload(grant.downloadToken || "", asset.id)}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 hover:border-white/40 disabled:opacity-60"
                          >
                            {downloadingId === `guest-${asset.id}` ? "A preparar..." : "Download"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
