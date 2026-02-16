"use client";

import { cn } from "@/lib/utils";
import type { CalendarScopeMode } from "./types";
import { DatePickerTwoMonths } from "./DatePickerTwoMonths";
import { SearchableEntitySelect, type SearchableEntityOption } from "./SearchableEntitySelect";

type CalendarHeaderProps = {
  date: Date;
  timezone: string;
  datePickerOpen: boolean;
  onDatePickerOpenChange: (open: boolean) => void;
  onSelectDate: (date: Date) => void;
  onToday: () => void;
  professionalOptions: SearchableEntityOption[];
  resourceOptions: SearchableEntityOption[];
  selectedProfessionalIds: string[];
  selectedResourceIds: string[];
  onSelectProfessional: (ids: string[]) => void;
  onSelectResource: (ids: string[]) => void;
  scopeMode: CalendarScopeMode;
  onScopeModeChange: (mode: CalendarScopeMode) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
};

export function CalendarHeader({
  date,
  timezone,
  datePickerOpen,
  onDatePickerOpenChange,
  onSelectDate,
  onToday,
  professionalOptions,
  resourceOptions,
  selectedProfessionalIds,
  selectedResourceIds,
  onSelectProfessional,
  onSelectResource,
  scopeMode,
  onScopeModeChange,
  onOpenFilters,
  activeFilterCount,
}: CalendarHeaderProps) {
  return (
    <header className="rounded-2xl border border-white/10 bg-[rgba(8,12,24,0.85)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToday}
          className="inline-flex h-10 items-center rounded-full border border-white/20 bg-white/5 px-4 text-sm text-white/85 transition hover:border-white/40 hover:text-white"
        >
          Hoje
        </button>

        <DatePickerTwoMonths
          selectedDate={date}
          timezone={timezone}
          open={datePickerOpen}
          onOpenChange={onDatePickerOpenChange}
          onSelectDate={onSelectDate}
        />

        <SearchableEntitySelect
          label="Equipa ou profissional"
          placeholder="Equipa/profissional"
          options={professionalOptions}
          selectedIds={selectedProfessionalIds}
          onChange={onSelectProfessional}
        />

        <SearchableEntitySelect
          label="Recurso"
          placeholder="Recurso"
          options={resourceOptions}
          selectedIds={selectedResourceIds}
          onChange={onSelectResource}
        />

        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 text-sm text-white/85 transition hover:border-white/40 hover:text-white"
          aria-label="Abrir todos os filtros"
        >
          Filtros
          {activeFilterCount > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-cyan-300/25 px-1.5 text-[11px] text-cyan-100">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => onScopeModeChange("exclusive")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs transition",
              scopeMode === "exclusive"
                ? "bg-cyan-300/25 text-cyan-100"
                : "text-white/60 hover:text-white/90",
            )}
          >
            Modo A (Exclusivo)
          </button>
          <button
            type="button"
            onClick={() => onScopeModeChange("hybrid")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs transition",
              scopeMode === "hybrid" ? "bg-cyan-300/25 text-cyan-100" : "text-white/60 hover:text-white/90",
            )}
          >
            Modo B (Híbrido)
          </button>
        </div>

        <p className="text-xs text-white/50">
          Catálogo de serviços definido pela organização; profissionais associados a serviços existentes.
        </p>
      </div>
    </header>
  );
}
