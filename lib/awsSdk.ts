import { fromIni } from "@aws-sdk/credential-providers";

export function getAwsRegion() {
  return process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-west-1";
}

export function getAwsCredentials() {
  const profile = process.env.AWS_PROFILE;
  if (profile) {
    return fromIni({ profile });
  }
  return undefined;
}

export function getAwsConfig() {
  return {
    region: getAwsRegion(),
    credentials: getAwsCredentials(),
  };
}
