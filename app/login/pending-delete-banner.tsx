export function PendingDeleteBanner() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const pending = params.get("pending_delete");
  if (!pending) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
      A tua conta está marcada para eliminação. Faz login para a reativar dentro do prazo.
    </div>
  );
}
