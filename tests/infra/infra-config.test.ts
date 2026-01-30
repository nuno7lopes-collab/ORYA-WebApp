import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(file: string) {
  return readFileSync(path.join(root, file), "utf8");
}

test("infra scripts exist", () => {
  const scripts = [
    "scripts/create-secrets-json.sh",
    "scripts/upload-secrets.sh",
    "scripts/build-and-push.sh",
    "scripts/deploy-cf.sh",
    "scripts/deploy-dev.sh",
    "scripts/healthcheck.sh",
  ];
  for (const script of scripts) {
    expect(existsSync(path.join(root, script))).toBe(true);
  }
});

test("CloudFormation uses cost-first defaults", () => {
  const template = read("infra/ecs/orya-ecs-stack.yaml");
  expect(template).toContain("Keep last 5 images");
  expect(template).toContain("LogsRetentionDays");
  expect(template).toContain("FARGATE_SPOT");
  expect(template).toContain("CreateALB");
});

test("Admin infra UI exists", () => {
  expect(existsSync(path.join(root, "app/admin/infra/page.tsx"))).toBe(true);
  expect(existsSync(path.join(root, "app/api/admin/infra/status/route.ts"))).toBe(true);
});
