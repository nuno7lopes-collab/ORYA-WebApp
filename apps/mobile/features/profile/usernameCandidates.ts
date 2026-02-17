import { normalizeUsernameInput } from "../../lib/username";

export const buildUsernameCandidates = (rawInput: string | null | undefined): string[] => {
  const raw = String(rawInput ?? "")
    .trim()
    .replace(/^@+/, "");
  const underscore = raw.replace(/\s+/g, "_");
  const hyphen = raw.replace(/\s+/g, "-");
  const compact = raw.replace(/\s+/g, "");

  return Array.from(
    new Set(
      [raw, underscore, hyphen, compact]
        .map((entry) => normalizeUsernameInput(entry))
        .filter((entry) => entry.length > 0),
    ),
  );
};
