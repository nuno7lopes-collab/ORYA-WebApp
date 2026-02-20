import { resetNavigationGuardsForTests, safePush } from "../lib/navigation";

describe("safePush", () => {
  beforeEach(() => {
    resetNavigationGuardsForTests();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-20T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    resetNavigationGuardsForTests();
  });

  test("bloqueia push duplicado imediato para a mesma rota", () => {
    const push = jest.fn();
    const router = { push };

    expect(safePush(router as any, "/map")).toBe(true);
    expect(safePush(router as any, "/map")).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);
  });

  test("permite push para a mesma rota depois da janela de lock", () => {
    const push = jest.fn();
    const router = { push };

    expect(safePush(router as any, "/notifications")).toBe(true);

    jest.advanceTimersByTime(1000);
    expect(safePush(router as any, "/notifications")).toBe(false);

    jest.advanceTimersByTime(500);
    expect(safePush(router as any, "/notifications")).toBe(true);
    expect(push).toHaveBeenCalledTimes(2);
  });

  test("permite rotas iguais com params diferentes", () => {
    const push = jest.fn();
    const router = { push };

    expect(
      safePush(router as any, {
        pathname: "/event/[slug]",
        params: { slug: "evento-a" },
      }),
    ).toBe(true);

    expect(
      safePush(router as any, {
        pathname: "/event/[slug]",
        params: { slug: "evento-b" },
      }),
    ).toBe(true);

    expect(push).toHaveBeenCalledTimes(2);
  });
});
