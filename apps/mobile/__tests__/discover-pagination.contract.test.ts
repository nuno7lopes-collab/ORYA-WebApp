const mockRequest = jest.fn();

jest.mock("@orya/shared", () => ({
  DiscoverResponseSchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
}));

jest.mock("../lib/api", () => {
  class MockApiError extends Error {
    status: number;
    code: string | null;

    constructor(status: number, message: string, code?: string | null) {
      super(message);
      this.status = status;
      this.code = code ?? null;
      this.name = "ApiError";
    }
  }

  return {
    api: {
      request: (...args: unknown[]) => mockRequest(...args),
    },
    ApiError: MockApiError,
    unwrapApiResponse: (value: unknown) => value,
  };
});

import { fetchDiscoverPage } from "../features/discover/api";

const makeEvent = (id: number) => ({
  id,
  type: "EVENT" as const,
  slug: `event-${id}`,
  title: `Evento ${id}`,
  startsAt: "2026-02-23T10:00:00.000Z",
  endsAt: "2026-02-23T12:00:00.000Z",
});

const makeService = (id: number) => ({
  id,
  title: `Servico ${id}`,
  durationMinutes: 60,
  unitPriceCents: 2000,
  currency: "EUR",
  kind: "GENERAL" as const,
  organization: {
    id: 9000 + id,
  },
});

const parsePositiveInt = (value: string | null, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
};

const setupDiscoverBackend = ({
  events,
  services,
}: {
  events: Array<ReturnType<typeof makeEvent>>;
  services: Array<ReturnType<typeof makeService>>;
}) => {
  mockRequest.mockImplementation(async (path: string) => {
    const url = new URL(path, "https://orya.local");
    const limit = parsePositiveInt(url.searchParams.get("limit"), 12);
    const cursor = parsePositiveInt(url.searchParams.get("cursor"), 0);
    const start = Math.max(0, cursor);
    const end = start + Math.max(0, limit);

    if (url.pathname === "/api/explorar/list") {
      const items = events.slice(start, end);
      const nextIndex = start + items.length;
      const hasMore = nextIndex < events.length;
      return {
        items,
        pagination: {
          nextCursor: hasMore ? String(nextIndex) : null,
          hasMore,
        },
      };
    }

    if (url.pathname === "/api/servicos/list") {
      const items = services.slice(start, end);
      const nextIndex = start + items.length;
      const hasMore = nextIndex < services.length;
      return {
        items,
        pagination: {
          nextCursor: hasMore ? String(nextIndex) : null,
          hasMore,
        },
      };
    }

    throw new Error(`Unexpected path: ${path}`);
  });
};

describe("discover pagination contract", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("não perde itens entre páginas quando ambas as fontes têm dados", async () => {
    setupDiscoverBackend({
      events: Array.from({ length: 6 }, (_, index) => makeEvent(index + 1)),
      services: Array.from({ length: 6 }, (_, index) => makeService(index + 1)),
    });

    const firstPage = await fetchDiscoverPage({ kind: "all", limit: 8, cursor: null });
    expect(firstPage.items).toHaveLength(8);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await fetchDiscoverPage({
      kind: "all",
      limit: 8,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.items).toHaveLength(4);
    expect(secondPage.hasMore).toBe(false);

    const totalUniqueKeys = new Set(
      [...firstPage.items, ...secondPage.items].map((item) => item.key),
    );
    expect(totalUniqueKeys.size).toBe(12);
  });

  it("faz top-up da fonte com mais oferta para preencher o limite", async () => {
    setupDiscoverBackend({
      events: [makeEvent(1)],
      services: Array.from({ length: 20 }, (_, index) => makeService(index + 1)),
    });

    const page = await fetchDiscoverPage({ kind: "all", limit: 8, cursor: null });
    expect(page.items).toHaveLength(8);
    expect(page.items.filter((item) => item.type === "event")).toHaveLength(1);
    expect(page.items.filter((item) => item.type === "service")).toHaveLength(7);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
  });

  it("não bloqueia serviços quando limit=1 e eventos existem", async () => {
    setupDiscoverBackend({
      events: [makeEvent(1)],
      services: [makeService(1), makeService(2)],
    });

    const firstPage = await fetchDiscoverPage({ kind: "all", limit: 1, cursor: null });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0]?.type).toBe("event");
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await fetchDiscoverPage({
      kind: "all",
      limit: 1,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.type).toBe("service");
  });
});
