"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ContextDrawer } from "@/components/ui/context-drawer";
import { cn } from "@/lib/utils";
import {
  areFiltersEqual,
  cloneFilters,
  BOOKING_STATUS_OPTIONS,
  BOOKING_TYPE_OPTIONS,
  CHANNEL_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from "./filterConfig";
import type { CalendarFilters, ProfessionalItem, ServiceItem } from "./types";

type FiltersDrawerProps = {
  open: boolean;
  onClose: () => void;
  appliedFilters: CalendarFilters;
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

function countAppliedSection(filters: CalendarFilters, section: SectionKey) {
  if (section === "status") return filters.statuses.length;
  if (section === "type") return filters.bookingTypes.length;
  if (section === "channel") return filters.channels.length;
  if (section === "payment") return filters.paymentStatuses.length;
  if (section === "services") return filters.serviceIds.length;
  if (section === "requestedProfessional") return filters.requestedProfessionalIds.length;
  return filters.createdFrom || filters.createdTo ? 1 : 0;
}

function countAppliedFiltersDraft(filters: CalendarFilters) {
  return (
    filters.statuses.length +
    filters.bookingTypes.length +
    filters.channels.length +
    filters.paymentStatuses.length +
    filters.serviceIds.length +
    filters.requestedProfessionalIds.length +
    (filters.createdFrom || filters.createdTo ? 1 : 0)
  );
}

function localIsoDateNow() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Section({
  section,
  title,
  activeCount,
  open,
  onToggle,
  children,
}: {
  section: SectionKey;
  title: string;
  activeCount: number;
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
        <span className="inline-flex items-center gap-2">
          <span>{title}</span>
          {activeCount > 0 ? (
            <span className="rounded-full border border-cyan-300/45 bg-cyan-300/16 px-2 py-0.5 text-[10px] text-cyan-100">
              {activeCount}
            </span>
          ) : null}
        </span>
        <span className="text-white/60">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="pb-3">{children}</div> : null}
    </section>
  );
}

export function FiltersDrawer({
  open,
  onClose,
  appliedFilters,
  draftFilters,
  onDraftFiltersChange,
  onApply,
  onClear,
  services,
  professionals,
}: FiltersDrawerProps) {
  const draftFiltersRef = useRef(draftFilters);
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
  const [professionalQuery, setProfessionalQuery] = useState("");

  useEffect(() => {
    if (open) return;
    setServiceQuery("");
    setProfessionalQuery("");
  }, [open]);
  useEffect(() => {
    draftFiltersRef.current = draftFilters;
  }, [draftFilters]);

  useEffect(() => {
    if (!open) return;
    const current = draftFiltersRef.current;
    setExpanded({
      status: true,
      type: current.bookingTypes.length > 0,
      channel: current.channels.length > 0,
      payment: current.paymentStatuses.length > 0,
      services: current.serviceIds.length > 0,
      createdAt: Boolean(current.createdFrom || current.createdTo),
      requestedProfessional: current.requestedProfessionalIds.length > 0,
    });
  }, [open]);

  const filteredServices = useMemo(() => {
    const normalized = serviceQuery.trim().toLowerCase();
    if (!normalized) return services;
    return services.filter((service) => service.title.toLowerCase().includes(normalized));
  }, [serviceQuery, services]);
  const sortedServices = useMemo(
    () => [...filteredServices].sort((left, right) => left.title.localeCompare(right.title, "pt-PT")),
    [filteredServices],
  );
  const filteredProfessionals = useMemo(() => {
    const normalized = professionalQuery.trim().toLowerCase();
    const source = [...professionals].sort((left, right) => left.name.localeCompare(right.name, "pt-PT"));
    if (!normalized) return source;
    return source.filter((professional) => professional.name.toLowerCase().includes(normalized));
  }, [professionalQuery, professionals]);
  const draftCount = useMemo(() => countAppliedFiltersDraft(draftFilters), [draftFilters]);
  const hasDraftChanges = useMemo(
    () => !areFiltersEqual(draftFilters, appliedFilters),
    [appliedFilters, draftFilters],
  );

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSubmitCombo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "enter";
      if (!isSubmitCombo || !hasDraftChanges) return;
      event.preventDefault();
      onApply();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasDraftChanges, onApply, onClose, open]);

  const toggleSection = (section: SectionKey) => {
    setExpanded((current) => ({ ...current, [section]: !current[section] }));
  };
  const setAllSections = (openValue: boolean) => {
    setExpanded({
      status: openValue,
      type: openValue,
      channel: openValue,
      payment: openValue,
      services: openValue,
      createdAt: openValue,
      requestedProfessional: openValue,
    });
  };

  return (
    <ContextDrawer open={open} onClose={onClose} title="Todos os filtros" widthClassName="max-w-[360px]">
      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-white/70">
            {draftCount > 0
              ? `${draftCount} filtro${draftCount > 1 ? "s" : ""} em preparação`
              : "Sem filtros ativos"}
            {hasDraftChanges ? " · alterações por aplicar" : ""}
          </p>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/75 transition hover:border-white/35 hover:text-white"
          >
            Limpar
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAllSections(true)}
            className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Expandir tudo
          </button>
          <button
            type="button"
            onClick={() => setAllSections(false)}
            className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Colapsar tudo
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onDraftFiltersChange({
                ...draftFilters,
                statuses: ["PENDING_CONFIRMATION", "PENDING"],
              })
            }
            className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-white/75 transition hover:border-white/30 hover:text-white"
          >
            Só pendentes
          </button>
          <button
            type="button"
            onClick={() => {
              const today = localIsoDateNow();
              onDraftFiltersChange({
                ...draftFilters,
                createdFrom: today,
                createdTo: today,
              });
            }}
            className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-white/75 transition hover:border-white/30 hover:text-white"
          >
            Criados hoje
          </button>
          <button
            type="button"
            onClick={() =>
              onDraftFiltersChange({
                ...draftFilters,
                paymentStatuses: ["PAID", "PARTIAL"],
              })
            }
            className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-white/75 transition hover:border-white/30 hover:text-white"
          >
            Só pagos
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {SECTION_ORDER.map((section) => (
          <Section
            key={section}
            section={section}
            title={SECTION_LABELS[section]}
            activeCount={countAppliedSection(draftFilters, section)}
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
                  {sortedServices.map((service) => {
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
                  {sortedServices.length === 0 && <p className="text-xs text-white/50">Sem serviços encontrados.</p>}
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
              <div>
                <input
                  value={professionalQuery}
                  onChange={(event) => setProfessionalQuery(event.target.value)}
                  placeholder="Pesquisar colaborador"
                  className="mb-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                />
                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {filteredProfessionals.map((professional) => {
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
                {filteredProfessionals.length === 0 ? (
                  <p className="text-xs text-white/50">Sem colaboradores encontrados.</p>
                ) : null}
                </div>
              </div>
            )}
          </Section>
        ))}
      </div>

      <div className="sticky bottom-0 mt-4 border-t border-white/10 bg-[#070b15]/95 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onDraftFiltersChange(cloneFilters(appliedFilters))}
            disabled={!hasDraftChanges}
            className={cn(
              "rounded-full border border-white/20 px-4 py-2 text-sm transition",
              "text-white/75 hover:border-white/35 hover:text-white disabled:opacity-50 disabled:hover:border-white/20",
            )}
          >
            Repor
          </button>
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
            disabled={!hasDraftChanges}
            className="rounded-full border border-cyan-300/45 bg-cyan-300/20 px-5 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/30 disabled:opacity-50 disabled:hover:bg-cyan-300/20"
          >
            Aplicar{draftCount > 0 ? ` (${draftCount})` : ""}
          </button>
        </div>
        <p className="mt-2 text-right text-[10px] uppercase tracking-[0.14em] text-white/45">Atalho: Ctrl/Cmd + Enter</p>
      </div>
    </ContextDrawer>
  );
}
