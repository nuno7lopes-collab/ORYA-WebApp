module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|expo|expo-.*|expo-modules-core|@expo|expo-router|react-native-gesture-handler|react-native-reanimated|react-native-safe-area-context|nativewind)/)",
  ],
  moduleNameMapper: {
    "\\.(ttf|png|jpg|jpeg|svg)$": "<rootDir>/__mocks__/fileMock.js",
    ".*/components/icons/Ionicons$": "<rootDir>/__mocks__/IoniconsMock.js",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testPathIgnorePatterns: ["/node_modules/", "__tests__/username.test.ts"],
};
