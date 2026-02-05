export type GlobalSearchItem =
  | { type: "ORGANIZATION"; id: number; name: string; username?: string | null; city?: string | null; avatarUrl?: string | null }
  | { type: "EVENT"; id: string; slug: string; title: string; startsAt?: string | Date; coverImageUrl?: string | null; city?: string | null; templateType?: string | null }
  | { type: "USER"; id: string; name: string; username?: string | null; city?: string | null; avatarUrl?: string | null };

export type GlobalSearchResponse = {
  query: string;
  items: GlobalSearchItem[];
  groups: {
    organizations: GlobalSearchItem[];
    events: GlobalSearchItem[];
    users: GlobalSearchItem[];
  };
};

export async function globalSearch(query: string, limit = 10): Promise<GlobalSearchResponse> {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", String(limit));
  const res = await fetch(`/api/search?${params.toString()}`);
  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || json?.error || "Falha ao pesquisar.");
  }
  return json.data as GlobalSearchResponse;
}
