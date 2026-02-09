import "@testing-library/jest-native/extend-expect";
import "react-native-gesture-handler/jestSetup";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@expo/vector-icons", () => ({
  createIconSet: () => () => null,
}));

// Silence reanimated warnings in tests.
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

// Provide __DEV__ global for analytics/stubs.
// eslint-disable-next-line no-underscore-dangle
global.__DEV__ = true;
