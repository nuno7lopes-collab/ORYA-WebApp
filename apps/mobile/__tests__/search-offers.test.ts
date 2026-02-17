jest.mock("../lib/api", () => ({
  api: {
    request: jest.fn(),
  },
  unwrapApiResponse: (value: unknown) => value,
}));

jest.mock("../features/discover/api", () => ({
  fetchDiscoverPage: jest.fn(),
}));

import { searchOffers } from "../features/search/api";
import { fetchDiscoverPage } from "../features/discover/api";

const mockedFetchDiscoverPage = fetchDiscoverPage as jest.MockedFunction<typeof fetchDiscoverPage>;

describe("searchOffers", () => {
  beforeEach(() => {
    mockedFetchDiscoverPage.mockReset();
  });

  it("does not call discover endpoint when query is empty", async () => {
    const result = await searchOffers("   ");
    expect(result.items).toEqual([]);
    expect(mockedFetchDiscoverPage).not.toHaveBeenCalled();
  });

  it("forwards canonical kind and normalized query to discover", async () => {
    mockedFetchDiscoverPage.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      hasMore: false,
    });

    await searchOffers('  @"Padel"  ', { kind: "padel", limit: 6 });

    expect(mockedFetchDiscoverPage).toHaveBeenCalledWith({
      q: "Padel",
      kind: "padel",
      type: "all",
      limit: 6,
      cursor: null,
    });
  });
});
