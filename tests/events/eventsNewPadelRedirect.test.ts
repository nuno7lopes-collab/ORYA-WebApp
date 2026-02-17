import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("REDIRECT_TRIGGERED");
  }),
);
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND_TRIGGERED");
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));
vi.mock("@/app/org/_internal/core/(dashboard)/eventos/novo/page", () => ({
  default: () => null,
}));

let Page: typeof import("@/app/org/[orgId]/events/new/page").default;

beforeEach(async () => {
  vi.resetModules();
  redirectMock.mockClear();
  notFoundMock.mockClear();
  Page = (await import("@/app/org/[orgId]/events/new/page")).default;
});

describe("org events/new preset redirect", () => {
  it("redirects preset=padel to canonical padel create path preserving query", async () => {
    await expect(
      Page({
        params: Promise.resolve({ orgId: "12" }),
        searchParams: {
          preset: "padel",
          organizationId: "12",
          from: "calendar",
        },
      }),
    ).rejects.toThrow("REDIRECT_TRIGGERED");

    expect(redirectMock).toHaveBeenCalledWith(
      "/org/12/padel/tournaments/create?organizationId=12&from=calendar",
    );
  });

  it("keeps events flow when preset is not padel", async () => {
    await Page({
      params: Promise.resolve({ orgId: "12" }),
      searchParams: { preset: "default" },
    });

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
