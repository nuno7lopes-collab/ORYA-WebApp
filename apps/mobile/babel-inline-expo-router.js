module.exports = function inlineExpoRouterEnv({ types: t }) {
  return {
    name: "inline-expo-router-env",
    visitor: {
      MemberExpression(path) {
        if (path.matchesPattern("process.env.EXPO_ROUTER_APP_ROOT")) {
          path.replaceWith(t.stringLiteral("app"));
          return;
        }
        if (path.matchesPattern("process.env.EXPO_ROUTER_IMPORT_MODE")) {
          path.replaceWith(t.stringLiteral("sync"));
        }
      },
    },
  };
};
