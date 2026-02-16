"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ContextDrawer } from "@/components/ui/context-drawer";
import { cn } from "@/lib/utils";
import {
  BOOKING_STATUS_OPTIONS,
  BOOKING_TYPE_OPTIONS,
  CHANNEL_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from "./filterConfig";
import type { CalendarFilters, ProfessionalItem, ServiceItem } from "./types";

type FiltersDrawerProps = {
  open: boolean;
  onClose: () => void;
  draftFilters: CalendarFilters;
  onDraftFiltersChange: (next: CalendarFilters) => void;
  onApply: () => void;
  onClear: () => void;
  services: ServiceItem[];
  professionals: ProfessionalItem[];
};

type SectionKey =
  | "status"
  | "type"
  | "channel"
  | "payment"
  | "services"
  | "createdAt"
  | "requestedProfessional";

const SECTION_ORDER: SectionKey[] = [
  "status",
  "type",
  "channel",
  "payment",
  "services",
  "createdAt",
  "requestedProfessional",
];

const SECTION_LABELS: Record<SectionKey, string> = {
  status: "Situação do agendamento",
  type: "Tipo",
  channel: "Canal",
  payment: "Status do pagamento",
  services: "Serviços",
  createdAt: "Data de criação do agendamento",
  requestedProfessional: "Colaborador solicitado",
};

function toggleString(values: string[], target: string) {
  const next = new Set(values);
  if (next.has(target)) next.delete(target);
  else next.add(target);
  return [...next];
}

function toggleNumber(values: number[], target: number) {
  const next = new Set(values);
  if (next.has(target)) next.delete(target);
  else next.add(target);
  return [...next].sort((a, b) => a - b);
}

function Section({
  section,
  title,
  open,
  onToggle,
  children,
}: {
  section: SectionKey;
  title: string;
  open: boolean;
  onToggle: (section: SectionKey) => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-white/10 py-1">
      <button
        type="button"
        onClick={() => onToggle(section)}
        className="flex w-full items-center justify-between gap-2 px-1 py-3 text-left text-sm text-white"
      >
        <span>{title}</span>
        <span className="text-white/60">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="pb-3">{children}</div> : null}
    </section>
  );
}

export function FiltersDrawer({
  open,
  onClose,
  draftFilters,
  onDraftFiltersChange,
  onApply,
  onClear,
  services,
  professionals,
}: FiltersDrawerProps) {
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    status: true,
    type: false,
    channel: false,
    payment: false,
    services: false,
    createdAt: false,
    requestedProfessional: false,
  });
  const [serviceQuery, setServiceQuery] = useState("");

  const filteredServices = useMemo(() => {
    const normalized = serviceQuery.trim().toLowerCase();
    if (!normalized) return services;
    return services.filter((service) => service.title.toLowerCase().includes(normalized));
  }, [serviceQuery, services]);

  const toggleSection = (section: SectionKey) => {
    setExpanded((current) => ({ ...current, [section]: !current[section] }));
  };

  return (
    <ContextDrawer open={open} onClose={onClose} title="Todos os filtros" widthClassName="max-w-[360px]">
      <div className="space-y-1">
        {SECTION_ORDER.map((section) => (
          <Section
            key={section}
            section={section}
            title={SECTION_LABELS[section]}
            open={expanded[section]}
            onToggle={toggleSection}
          >
            {section === "status" && (
              <div className="space-y-2">
                {BOOKING_STATUS_OPTIONS.map((option) => {
                  const checked = draftFilters.statuses.includes(option.value);
                  return (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onDraftFiltersChange({
                            ...draftFilters,
                            statuses: toggleString(draftFilters.statuses, option.value),
                          })
                        }
                        className="h-4 w-4 rounded border-white/20 bg-white/5"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {section === "type" && (
              <div className="space-y-2">
                {BOOKING_TYPE_OPTIONS.map((option) => {
                  const checked = draftFilters.bookingTypes.includes(option.value);
                  return (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onDraftFiltersChange({
                            ...draftFilters,
                            bookingTypes: checked
                              ? draftFilters.bookingTypes.filter((value) => value !== option.value)
                              : [...draftFilters.bookingTypes, option.value],
                          })
                        }
                        className="h-4 w-4 rounded border-white/20 bg-white/5"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {section === "channel" && (
              <div className="space-y-2">
                {CHANNEL_OPTIONS.map((option) => {
                  const checked = draftFilters.channels.includes(option.value);
                  return (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onDraftFiltersChange({
                            ...draftFilters,
                            channels: checked
                              ? draftFilters.channels.filter((value) => value !== option.value)
                              : [...draftFilters.channels, option.value],
                          })
                        }
                        className="h-4 w-4 rounded border-white/20 bg-white/5"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {section === "payment" && (
              <div className="space-y-2">
                {PAYMENT_STATUS_OPTIONS.map((option) => {
                  const checked = draftFilters.paymentStatuses.includes(option.value);
                  return (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onDraftFiltersChange({
                            ...draftFilters,
                            paymentStatuses: checked
                              ? draftFilters.paymentStatuses.filter((value) => value !== option.value)
                              : [...draftFilters.paymentStatuses, option.value],
                          })
                        }
                        className="h-4 w-4 rounded border-white/20 bg-white/5"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {section === "services" && (
              <div>
                <input
                  value={serviceQuery}
                  onChange={(event) => setServiceQuery(event.target.value)}
                  placeholder="Pesquisar serviço"
                  className="mb-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                />
                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {filteredServices.map((service) => {
                    const checked = draftFilters.serviceIds.includes(service.id);
                    return (
                      <label key={service.id} className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            onDraftFiltersChange({
                              ...draftFilters,
                              serviceIds: toggleNumber(draftFilters.serviceIds, service.id),
                            })
                          }
                          className="h-4 w-4 rounded border-white/20 bg-white/5"
                        />
                        <span className="truncate">{service.title}</span>
                      </label>
                    );
                  })}
                  {filteredServices.length === 0 && <p className="text-xs text-white/50">Sem serviços encontrados.</p>}
                </div>
              </div>
            )}

            {section === "createdAt" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-white/65">
                  <span>De</span>
                  <input
                    type="date"
                    value={draftFilters.createdFrom ?? ""}
                    onChange={(event) =>
                      onDraftFiltersChange({
                        ...draftFilters,
                        createdFrom: event.target.value || null,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-300/60"
                  />
                </label>
                <label className="text-xs text-white/65">
                  <span>Até</span>
                  <input
                    type="date"
                    value={draftFilters.createdTo ?? ""}
                    onChange={(event) =>
                      onDraftFiltersChange({
                        ...draftFilters,
                        createdTo: event.target.value || null,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-300/60"
                  />
                </label>
              </div>
            )}

            {section === "requestedProfessional" && (
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {professionals.map((professional) => {
                  const checked = draftFilters.requestedProfessionalIds.includes(professional.id);
                  return (
                    <label key={professional.id} className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onDraftFiltersChange({
                            ...draftFilters,
                            requestedProfessionalIds: toggleNumber(draftFilters.requestedProfessionalIds, professional.id),
                          })
                        }
                        className="h-4 w-4 rounded border-white/20 bg-white/5"
                      />
                      <span className="truncate">{professional.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </Section>
        ))}
      </div>

      <div className="sticky bottom-0 mt-4 border-t border-white/10 bg-[#070b15]/95 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "rounded-full border border-white/20 px-4 py-2 text-sm transition",
              "text-white/75 hover:border-white/35 hover:text-white",
            )}
          >
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={() => {
              onApply();
              onClose();
            }}
            className="rounded-full border border-cyan-300/45 bg-cyan-300/20 px-5 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/30"
          >
            Aplicar
          </button>
        </div>
      </div>
    </ContextDrawer>
  );
}
