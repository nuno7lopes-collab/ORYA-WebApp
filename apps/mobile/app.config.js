const appJson = require("./app.json");

module.exports = ({ config }) => {
  const expo = appJson.expo ?? {};
  const appVariant = process.env.APP_VARIANT ?? "prod";
  const isDev = appVariant === "dev";

  const scheme = isDev ? "orya-dev" : (expo.scheme ?? "orya");
  const iosBundleIdentifier = isDev ? "com.orya.app.dev" : (expo.ios?.bundleIdentifier ?? "com.orya.app.prod");
  const androidPackage = isDev ? "com.orya.app.dev" : (expo.android?.package ?? "com.orya.app.prod");

  const extra = {
    ...(expo.extra ?? {}),
    APP_VARIANT: appVariant,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV ?? (isDev ? "dev" : "prod"),
    EXPO_PUBLIC_API_BASE_URL:
      process.env.EXPO_PUBLIC_API_BASE_URL ?? expo.extra?.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_SUPABASE_URL:
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? expo.extra?.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      expo.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
      expo.extra?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_APPLE_MERCHANT_ID:
      process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID ??
      expo.extra?.EXPO_PUBLIC_APPLE_MERCHANT_ID,
  };

  return {
    ...config,
    ...expo,
    scheme,
    ios: {
      ...(expo.ios ?? {}),
      bundleIdentifier: iosBundleIdentifier,
    },
    android: {
      ...(expo.android ?? {}),
      package: androidPackage,
    },
    extra,
  };
};
