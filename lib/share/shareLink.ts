type ShareInput = {
  url: string;
  title?: string;
  text?: string;
};

export async function shareLink({ url, title, text }: ShareInput) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { ok: true as const, method: "share" as const };
    } catch {
      // ignore cancel
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return { ok: true as const, method: "clipboard" as const };
    } catch {
      // ignore
    }
  }

  if (typeof window !== "undefined") {
    window.prompt("Copia o link para partilhar", url);
    return { ok: true as const, method: "prompt" as const };
  }

  return { ok: false as const };
}
