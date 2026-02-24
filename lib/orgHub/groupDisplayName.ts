export function resolveGroupDisplayName(groupName: string | null | undefined, groupId: number) {
  const normalized = typeof groupName === "string" ? groupName.trim() : "";
  if (normalized.length > 0) return normalized;
  return `Grupo #${groupId}`;
}
