const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "react-i18next": path.resolve(projectRoot, "node_modules/react-i18next"),
  i18next: path.resolve(projectRoot, "node_modules/i18next"),
};
const forceMobileDeps = ["react", "react-dom", "react-native", "react-i18next", "i18next"];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forcedDep = forceMobileDeps.find(
    (dep) => moduleName === dep || moduleName.startsWith(`${dep}/`)
  );
  if (forcedDep) {
    const remappedModuleName = path.resolve(projectRoot, "node_modules", moduleName);
    return context.resolveRequest(context, remappedModuleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.assetExts = Array.from(
  new Set([...(config.resolver.assetExts || []), "ttf"])
);

module.exports = withNativeWind(config, {
  input: "./global.css",
  configPath: "./tailwind.config.js",
});
