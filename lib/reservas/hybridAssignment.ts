import {
  getAvailableSlotsForScope,
  type BookingBlock,
} from "@/lib/reservas/availabilitySelect";
import type { AvailabilitySlot } from "@/lib/reservas/availability";
import type {
  AvailabilityScopeType,
  ScopedOverride,
  ScopedTemplate,
} from "@/lib/reservas/scopedAvailability";

export type HybridProfessionalScope = {
  id: number;
  priority: number;
};

export type HybridResourceScope = {
  id: number;
  capacity: number;
  priority: number;
  courtId: number | null;
};

export type HybridSlotInputs = {
  rangeStart: Date;
  rangeEnd: Date;
  timezone: string;
  durationMinutes: number;
  stepMinutes?: number;
  now: Date;
  professionals: HybridProfessionalScope[];
  resources: HybridResourceScope[];
  orgTemplates: ScopedTemplate[];
  orgOverrides: ScopedOverride[];
  templatesByScope: Map<string, ScopedTemplate[]>;
  overridesByScope: Map<string, ScopedOverride[]>;
  blocks: BookingBlock[];
};

export type HybridSlotMatrix = {
  slots: AvailabilitySlot[];
  professionalSlotKeysById: Map<number, Set<string>>;
  resourceSlotKeysById: Map<number, Set<string>>;
  slotByKey: Map<string, AvailabilitySlot>;
};

function sortProfessionals(items: HybridProfessionalScope[]) {
  return [...items].sort((a, b) => a.priority - b.priority || a.id - b.id);
}

function sortResources(items: HybridResourceScope[]) {
  return [...items].sort(
    (a, b) => a.capacity - b.capacity || a.priority - b.priority || a.id - b.id,
  );
}

function buildScopeSlotSet(params: {
  scopeType: AvailabilityScopeType;
  scopeId: number;
  input: HybridSlotInputs;
  slotByKey: Map<string, AvailabilitySlot>;
}) {
  const slots = getAvailableSlotsForScope({
    rangeStart: params.input.rangeStart,
    rangeEnd: params.input.rangeEnd,
    timezone: params.input.timezone,
    durationMinutes: params.input.durationMinutes,
    stepMinutes: params.input.stepMinutes,
    now: params.input.now,
    scopeType: params.scopeType,
    scopeId: params.scopeId,
    orgTemplates: params.input.orgTemplates,
    orgOverrides: params.input.orgOverrides,
    templatesByScope: params.input.templatesByScope,
    overridesByScope: params.input.overridesByScope,
    blocks: params.input.blocks,
  });

  const keys = new Set<string>();
  slots.forEach((slot) => {
    const slotKey = slot.startsAt.toISOString();
    keys.add(slotKey);
    if (!params.slotByKey.has(slotKey)) {
      params.slotByKey.set(slotKey, slot);
    }
  });

  return keys;
}

export function buildHybridSlotMatrix(input: HybridSlotInputs): HybridSlotMatrix {
  const slotByKey = new Map<string, AvailabilitySlot>();
  const professionalSlotKeysById = new Map<number, Set<string>>();
  const resourceSlotKeysById = new Map<number, Set<string>>();

  const professionals = sortProfessionals(input.professionals);
  const resources = sortResources(input.resources);

  professionals.forEach((professional) => {
    professionalSlotKeysById.set(
      professional.id,
      buildScopeSlotSet({
        scopeType: "PROFESSIONAL",
        scopeId: professional.id,
        input,
        slotByKey,
      }),
    );
  });

  resources.forEach((resource) => {
    resourceSlotKeysById.set(
      resource.id,
      buildScopeSlotSet({
        scopeType: "RESOURCE",
        scopeId: resource.id,
        input,
        slotByKey,
      }),
    );
  });

  const hybridKeys = new Set<string>();
  for (const professional of professionals) {
    const proSet = professionalSlotKeysById.get(professional.id);
    if (!proSet || proSet.size === 0) continue;
    for (const resource of resources) {
      const resourceSet = resourceSlotKeysById.get(resource.id);
      if (!resourceSet || resourceSet.size === 0) continue;
      const [smaller, larger] =
        proSet.size <= resourceSet.size ? [proSet, resourceSet] : [resourceSet, proSet];
      for (const key of smaller) {
        if (larger.has(key)) {
          hybridKeys.add(key);
        }
      }
    }
  }

  const slots = Array.from(hybridKeys)
    .map((key) => slotByKey.get(key))
    .filter((slot): slot is AvailabilitySlot => Boolean(slot))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return {
    slots,
    professionalSlotKeysById,
    resourceSlotKeysById,
    slotByKey,
  };
}

export function selectBestHybridPairForSlot(params: {
  slotKey: string;
  professionals: HybridProfessionalScope[];
  resources: HybridResourceScope[];
  professionalSlotKeysById: Map<number, Set<string>>;
  resourceSlotKeysById: Map<number, Set<string>>;
}) {
  const professionals = sortProfessionals(params.professionals);
  const resources = sortResources(params.resources);

  for (const professional of professionals) {
    const proSet = params.professionalSlotKeysById.get(professional.id);
    if (!proSet || !proSet.has(params.slotKey)) continue;
    for (const resource of resources) {
      const resourceSet = params.resourceSlotKeysById.get(resource.id);
      if (!resourceSet || !resourceSet.has(params.slotKey)) continue;
      return {
        professionalId: professional.id,
        resourceId: resource.id,
        courtId: resource.courtId ?? null,
      };
    }
  }

  return null;
}
