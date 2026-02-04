import { AsyncLocalStorage } from "node:async_hooks";

type Store = { authorization: string | null };

const storage = new AsyncLocalStorage<Store>();

type HeaderSource = {
  get(name: string): string | null;
};

export function setRequestAuthHeader(headers?: HeaderSource | null) {
  if (!headers) {
    storage.enterWith({ authorization: null });
    return;
  }
  const authorization = headers.get("authorization") ?? headers.get("Authorization");
  storage.enterWith({ authorization: authorization ?? null });
}

export function getRequestAuthHeader(): string | null {
  return storage.getStore()?.authorization ?? null;
}
