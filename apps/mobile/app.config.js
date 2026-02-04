const appJson = require("./app.json");

module.exports = ({ config }) => {
  const expo = appJson.expo ?? {};
  const extra = {
    ...(expo.extra ?? {}),
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV ?? "prod",
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
    extra,
  };
};
