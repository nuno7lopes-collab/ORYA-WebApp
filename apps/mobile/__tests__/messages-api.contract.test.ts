const mockRequestRaw = jest.fn();

jest.mock("../lib/api", () => {
  class ApiError extends Error {
    status: number;
    code: string | null;

    constructor(status: number, message: string, code?: string | null) {
      super(message);
      this.status = status;
      this.code =
        typeof code === "string" && code.trim().length > 0
          ? code.trim().toUpperCase()
          : null;
      this.name = "ApiError";
    }
  }

  return {
    ApiError,
    api: {
      requestRaw: (...args: unknown[]) => mockRequestRaw(...args),
    },
    unwrapApiResponse: <T>(payload: T) => payload,
  };
});

import { acceptMessageInvite, fetchMessageInvites } from "../features/messages/api";

const rawOk = (data: unknown, status = 200) => ({
  ok: true,
  status,
  data,
  errorText: "",
});

describe("messages api contract", () => {
  beforeEach(() => {
    mockRequestRaw.mockReset();
  });

  it("filtra grants inválidos e normaliza campos de EVENT_INVITE", async () => {
    mockRequestRaw.mockResolvedValue(
      rawOk({
        items: [
          {
            id: "g1",
            kind: "EVENT_INVITE",
            status: "PENDING",
            threadId: "conv_1",
            conversationId: "conv_1",
            expiresAt: "2026-01-01T00:00:00.000Z",
            event: {
              id: 10,
              slug: "evento-10",
              title: "Evento 10",
              startsAt: null,
              endsAt: null,
              coverImageUrl: null,
              addressId: null,
              locationFormattedAddress: null,
              status: null,
              threadId: "conv_1",
            },
          },
          {
            id: "g2",
            kind: "USER_DM_REQUEST",
            status: "PENDING",
            event: null,
          },
          {
            id: "g3",
            kind: "EVENT_INVITE",
            status: "ACCEPTED",
            threadId: "conv_3",
            conversationId: "conv_3",
            expiresAt: null,
            event: null,
          },
        ],
      }),
    );

    const result = await fetchMessageInvites(10, "token-1");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "g1",
      threadId: "conv_1",
      conversationId: "conv_1",
      status: "PENDING",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });

    const [, init] = mockRequestRaw.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-1");
  });

  it("normaliza resposta de accept com fallback para payload invite", async () => {
    mockRequestRaw.mockResolvedValue(
      rawOk({
        invite: {
          conversationId: "conv_fallback",
          threadId: "thread_fallback",
        },
      }),
    );

    const result = await acceptMessageInvite("grant_1", "token-2");

    expect(result).toEqual({
      conversationId: "conv_fallback",
      threadId: "thread_fallback",
      status: "ACCEPTED",
      expiresAt: null,
    });
  });

  it("normaliza status desconhecido para PENDING", async () => {
    mockRequestRaw.mockResolvedValue(
      rawOk({
        conversationId: "conv_2",
        status: "WAITING",
      }),
    );

    const result = await acceptMessageInvite("grant_2", "token-3");

    expect(result).toEqual({
      conversationId: "conv_2",
      threadId: "conv_2",
      status: "PENDING",
      expiresAt: null,
    });
  });
});
