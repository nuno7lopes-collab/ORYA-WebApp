import { AsyncLocalStorage } from "node:async_hooks";
import { type AppEnv } from "@/lib/appEnvShared";

type Store = { env: AppEnv };

const storage = new AsyncLocalStorage<Store>();

export function setRequestAppEnv(env: AppEnv) {
  storage.enterWith({ env });
}

export function getRequestAppEnv(): AppEnv | null {
  return storage.getStore()?.env ?? null;
}

export function runWithRequestAppEnv<T>(env: AppEnv, fn: () => T): T {
  return storage.run({ env }, fn);
}
