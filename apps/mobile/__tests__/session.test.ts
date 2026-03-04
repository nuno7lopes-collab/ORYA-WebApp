const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();
const mockSignOut = jest.fn();

jest.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

import { getActiveSession, refreshSessionIfPossible } from "../lib/session";

type SessionLike = {
  access_token: string;
  expires_at?: number | null;
  refresh_token?: string | null;
};

const buildSession = (
  expiresAtSeconds: number,
  refreshToken: string | null = "refresh-token",
): SessionLike => ({
  access_token: "token",
  expires_at: expiresAtSeconds,
  refresh_token: refreshToken,
});

describe("getActiveSession", () => {
  const fixedNow = 1_700_000_000_000;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(fixedNow);
    mockGetSession.mockReset();
    mockRefreshSession.mockReset();
    mockSignOut.mockReset();
  });

  it("não tenta refresh quando não há sessão e refreshIfNearExpiry=false", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await getActiveSession({ refreshIfNearExpiry: false });

    expect(result).toBeNull();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it("não tenta refresh quando não há sessão, mesmo com refresh ativo", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await getActiveSession();

    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("serializa getSession concorrente para evitar refresh implícito duplicado", async () => {
    let resolveGetSession:
      | ((value: { data: { session: SessionLike | null }; error?: null }) => void)
      | null = null;
    const pendingGetSession = new Promise<{
      data: { session: SessionLike | null };
      error?: null;
    }>((resolve) => {
      resolveGetSession = resolve;
    });
    mockGetSession.mockReturnValue(pendingGetSession);

    const first = getActiveSession({ refreshIfNearExpiry: false });
    const second = getActiveSession({ refreshIfNearExpiry: false });

    expect(mockGetSession).toHaveBeenCalledTimes(1);

    resolveGetSession?.({ data: { session: null }, error: null });

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBeNull();
  });

  it("devolve sessão atual sem refresh quando TTL ainda é suficiente", async () => {
    const current = buildSession(Math.floor((fixedNow + 5 * 60_000) / 1000));
    mockGetSession.mockResolvedValue({ data: { session: current } });

    const result = await getActiveSession({ minTtlMs: 60_000, refreshIfNearExpiry: true });

    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(result).toEqual(current);
  });

  it("faz refresh quando sessão está perto de expirar e usa sessão renovada", async () => {
    const current = buildSession(Math.floor((fixedNow + 10_000) / 1000));
    const refreshed = buildSession(Math.floor((fixedNow + 180_000) / 1000));
    mockGetSession.mockResolvedValue({ data: { session: current } });
    mockRefreshSession.mockResolvedValue({ data: { session: refreshed } });

    const result = await getActiveSession({ minTtlMs: 60_000, refreshIfNearExpiry: true });

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual(refreshed);
  });

  it("mantém sessão atual quando refresh falha mas sessão ainda é válida", async () => {
    const current = buildSession(Math.floor((fixedNow + 10_000) / 1000));
    mockGetSession.mockResolvedValue({ data: { session: current } });
    mockRefreshSession.mockResolvedValue({ data: { session: null } });

    const result = await getActiveSession({ minTtlMs: 60_000, refreshIfNearExpiry: true });

    expect(result).toEqual(current);
  });

  it("não tenta refresh quando falta refresh_token e sessão ainda é válida", async () => {
    const current = buildSession(Math.floor((fixedNow + 10_000) / 1000), null);
    mockGetSession.mockResolvedValue({ data: { session: current } });

    const result = await getActiveSession({ minTtlMs: 60_000, refreshIfNearExpiry: true });

    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(result).toEqual(current);
  });

  it("devolve null quando sessão expira e não existe refresh_token", async () => {
    const expired = buildSession(Math.floor((fixedNow - 10_000) / 1000), null);
    mockGetSession.mockResolvedValue({ data: { session: expired } });

    const result = await getActiveSession({ minTtlMs: 60_000, refreshIfNearExpiry: true });

    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("devolve null quando refresh falha e sessão já expirou", async () => {
    const expired = buildSession(Math.floor((fixedNow - 10_000) / 1000));
    mockGetSession.mockResolvedValue({ data: { session: expired } });
    mockRefreshSession.mockResolvedValue({ data: { session: null } });

    const result = await getActiveSession({ minTtlMs: 60_000, refreshIfNearExpiry: true });

    expect(result).toBeNull();
  });

  it("limpa sessão local quando o refresh token é inválido", async () => {
    const current = buildSession(Math.floor((fixedNow + 10_000) / 1000));
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid Refresh Token: Refresh Token Not Found" },
    });

    const result = await refreshSessionIfPossible(
      current as Parameters<typeof refreshSessionIfPossible>[0],
    );

    expect(result).toBeNull();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("serializa refresh concorrente para evitar race de refresh token", async () => {
    const current = buildSession(Math.floor((fixedNow + 10_000) / 1000));
    let resolveRefresh:
      | ((value: { data: { session: SessionLike }; error?: null }) => void)
      | null = null;
    const pendingRefresh = new Promise<{ data: { session: SessionLike }; error?: null }>(
      (resolve) => {
        resolveRefresh = resolve;
      },
    );
    mockRefreshSession.mockReturnValue(pendingRefresh);

    const first = refreshSessionIfPossible(
      current as Parameters<typeof refreshSessionIfPossible>[0],
    );
    const second = refreshSessionIfPossible(
      current as Parameters<typeof refreshSessionIfPossible>[0],
    );

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);

    resolveRefresh?.({ data: { session: current }, error: null });

    await expect(first).resolves.toEqual(current);
    await expect(second).resolves.toEqual(current);
  });

  it("limpa sessão local quando getSession devolve refresh token inválido", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid Refresh Token: Refresh Token Not Found" },
    });

    const result = await getActiveSession();

    expect(result).toBeNull();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("devolve null em erro inesperado", async () => {
    mockGetSession.mockRejectedValue(new Error("boom"));

    const result = await getActiveSession();

    expect(result).toBeNull();
  });
});
