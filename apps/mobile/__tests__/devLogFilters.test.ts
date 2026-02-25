import { __testing } from "../lib/devLogFilters";

describe("devLogFilters", () => {
  it("ignora aviso SafeAreaView clássico", () => {
    expect(
      __testing.shouldIgnoreSafeAreaDeprecation([
        "SafeAreaView has been deprecated and will be removed in a future release.",
      ]),
    ).toBe(true);
  });

  it("ignora aviso SafeAreaView com placeholders separados", () => {
    expect(
      __testing.shouldIgnoreSafeAreaDeprecation([
        "%s has been deprecated and will be removed in a future release.",
        "SafeAreaView",
        "Please use react-native-safe-area-context instead.",
      ]),
    ).toBe(true);
  });

  it("não ignora warnings não relacionados", () => {
    expect(
      __testing.shouldIgnoreSafeAreaDeprecation([
        "Failed to fetch discover feed",
      ]),
    ).toBe(false);
  });
});

