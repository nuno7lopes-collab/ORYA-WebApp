type AppleUniversalLinksConfig = {
  appId: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value.trim();
}

export function getAppleUniversalLinksConfig(): AppleUniversalLinksConfig {
  const teamId = requireEnv("APPLE_SIGNIN_TEAM_ID");
  const serviceId = requireEnv("APPLE_SIGNIN_SERVICE_ID");
  return { appId: `${teamId}.${serviceId}` };
}
