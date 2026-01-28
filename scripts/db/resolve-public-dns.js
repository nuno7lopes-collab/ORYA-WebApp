const DEFAULT_TIMEOUT_MS = 2000;

async function fetchDnsJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, code: `HTTP_${res.status}` };
    }
    const data = await res.json();
    const answers = Array.isArray(data.Answer) ? data.Answer : [];
    const ips = answers
      .filter((a) => a && a.type === 1 && typeof a.data === "string")
      .map((a) => a.data);
    if (ips.length === 0) return { ok: false, code: "NO_ANSWER" };
    return { ok: true, ips };
  } catch (err) {
    const code = err && err.name === "AbortError" ? "FETCH_TIMEOUT" : "FETCH_FAIL";
    return { ok: false, code };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolvePublicDNS(hostname, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const cf = await fetchDnsJson(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
    timeoutMs,
  );
  if (cf.ok) return { ok: true, ips: cf.ips, code: null, provider: "cloudflare" };

  const gg = await fetchDnsJson(
    `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
    timeoutMs,
  );
  if (gg.ok) return { ok: true, ips: gg.ips, code: null, provider: "google" };

  return { ok: false, ips: [], code: `CF_${cf.code}|GG_${gg.code}`, provider: null };
}

module.exports = { resolvePublicDNS };
