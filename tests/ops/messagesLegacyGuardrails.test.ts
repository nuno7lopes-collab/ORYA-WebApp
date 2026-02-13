import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function run(command: string, shell = "/bin/zsh") {
  try {
    return execSync(command, { stdio: "pipe", shell }).toString().trim();
  } catch (error: any) {
    if (typeof error?.status === "number" && error.status === 1) {
      return "";
    }
    throw error;
  }
}

function listRoutes(prefix: string) {
  if (!existsSync(prefix)) return [] as string[];
  const output = run(`rg --files ${prefix} -g "route.ts"`);
  if (!output) return [] as string[];
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

describe("messages legacy guardrails", () => {
  it("removes /api/chat namespace", () => {
    expect(listRoutes("app/api/chat")).toEqual([]);
  });

  it("removes /api/me/messages namespace", () => {
    expect(listRoutes("app/api/me/messages")).toEqual([]);
  });

  it("removes transitional /api/messages/threads namespace", () => {
    expect(listRoutes("app/api/messages/threads")).toEqual([]);
  });

  it("removes transitional /api/messages/bookings namespace", () => {
    expect(listRoutes("app/api/messages/bookings")).toEqual([]);
  });

  it("removes transitional /api/messages/contact-requests namespace", () => {
    expect(listRoutes("app/api/messages/contact-requests")).toEqual([]);
  });

  it("removes transitional /api/messages/channel-requests namespace", () => {
    expect(listRoutes("app/api/messages/channel-requests")).toEqual([]);
  });

  it("blocks legacy message API strings", () => {
    const output = run('rg -n "/api/chat|/api/me/messages" app apps components lib domain packages scripts -S');
    expect(output).toBe("");
  });

  it("blocks legacy chat tables in canonical message runtime", () => {
    const output = run(
      'rg -n "chat_event_invites|chat_conversation_requests|chat_channel_requests|chat_threads|chat_members|chat_messages" app apps components lib domain packages scripts -S',
    );
    expect(output).toBe("");
  });

  it("removes deprecated ChatThread component", () => {
    expect(existsSync("components/chat/ChatThread.tsx")).toBe(false);
  });
});
