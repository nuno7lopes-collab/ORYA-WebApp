import { buildScopedSlotsForRange, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";

export type BookingBlock = {
  start: Date;
  end: Date;
  professionalId: number | null;
  resourceId: number | null;
};

export type ScopedAvailabilityParams = {
  rangeStart: Date;
  rangeEnd: Date;
  timezone: string;
  durationMinutes: number;
  stepMinutes?: number;
  now?: Date;
  scopeType: AvailabilityScopeType;
  scopeId: number;
  orgTemplates: ScopedTemplate[];
  orgOverrides: ScopedOverride[];
  templatesByScope: Map<string, ScopedTemplate[]>;
  overridesByScope: Map<string, ScopedOverride[]>;
  blocks: BookingBlock[];
};

function overlaps(slotStart: Date, slotEnd: Date, block: BookingBlock) {
  return slotStart < block.end && slotEnd > block.start;
}

function isBlockRelevant(scopeType: AvailabilityScopeType, scopeId: number, block: BookingBlock) {
  if (scopeType === "ORGANIZATION") {
    return true;
  }
  if (scopeType === "PROFESSIONAL") {
    if (block.professionalId) return block.professionalId === scopeId;
    if (block.resourceId) return false;
    return true;
  }
  if (block.resourceId) return block.resourceId === scopeId;
  if (block.professionalId) return false;
  return true;
}

export function getAvailableSlotsForScope(params: ScopedAvailabilityParams) {
  const slots = buildScopedSlotsForRange({
    rangeStart: params.rangeStart,
    rangeEnd: params.rangeEnd,
    timezone: params.timezone,
    durationMinutes: params.durationMinutes,
    stepMinutes: params.stepMinutes,
    now: params.now,
    scopeType: params.scopeType,
    scopeId: params.scopeId,
    orgTemplates: params.orgTemplates,
    orgOverrides: params.orgOverrides,
    templatesByScope: params.templatesByScope,
    overridesByScope: params.overridesByScope,
  });

  if (!params.blocks.length) return slots;

  return slots.filter((slot) => {
    const slotEnd = new Date(slot.startsAt.getTime() + slot.durationMinutes * 60 * 1000);
    return !params.blocks.some((block) => isBlockRelevant(params.scopeType, params.scopeId, block) && overlaps(slot.startsAt, slotEnd, block));
  });
}
