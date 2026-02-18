"use client";

import { DatePickerTwoMonths } from "./DatePickerTwoMonths";
import { SearchableEntitySelect, type SearchableEntityOption } from "./SearchableEntitySelect";
import type { CalendarTimezoneOption } from "../timezones";

type CalendarHeaderProps = {
  date: Date;
  timezone: string;
  timezoneOptions: CalendarTimezoneOption[];
  onTimezoneChange: (timezone: string) => void;
  datePickerOpen: boolean;
  onDatePickerOpenChange: (open: boolean) => void;
  onSelectDate: (date: Date) => void;
  onToday: () => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  professionalOptions: SearchableEntityOption[];
  resourceOptions: SearchableEntityOption[];
  selectedProfessionalIds: string[];
  selectedResourceIds: string[];
  onSelectProfessional: (ids: string[]) => void;
  onSelectResource: (ids: string[]) => void;
  onResetSelections: () => void;
  hasActiveSelection: boolean;
  onOpenFilters: () => void;
  activeFilterCount: number;
};

export function CalendarHeader({
  date,
  timezone,
  timezoneOptions,
  onTimezoneChange,
  datePickerOpen,
  onDatePickerOpenChange,
  onSelectDate,
  onToday,
  onPreviousDay,
  onNextDay,
  professionalOptions,
  resourceOptions,
  selectedProfessionalIds,
  selectedResourceIds,
  onSelectProfessional,
  onSelectResource,
  onResetSelections,
  hasActiveSelection,
  onOpenFilters,
  activeFilterCount,
}: CalendarHeaderProps) {
  return (
    <header className="rounded-2xl border border-white/10 bg-[rgba(8,12,24,0.85)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPreviousDay}
          className="inline-flex h-10 items-center rounded-full border border-white/20 bg-white/5 px-3 text-sm text-white/85 transition hover:border-white/40 hover:text-white"
          aria-label="Dia anterior"
        >
          ←
        </button>

        <button
          type="button"
          onClick={onToday}
          className="inline-flex h-10 items-center rounded-full border border-white/20 bg-white/5 px-4 text-sm text-white/85 transition hover:border-white/40 hover:text-white"
        >
          Hoje
        </button>

        <button
          type="button"
          onClick={onNextDay}
          className="inline-flex h-10 items-center rounded-full border border-white/20 bg-white/5 px-3 text-sm text-white/85 transition hover:border-white/40 hover:text-white"
          aria-label="Dia seguinte"
        >
          →
        </button>

        <DatePickerTwoMonths
          selectedDate={date}
          timezone={timezone}
          open={datePickerOpen}
          onOpenChange={onDatePickerOpenChange}
          onSelectDate={onSelectDate}
        />

        <label className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 text-xs text-white/80">
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/55">Fuso</span>
          <select
            value={timezone}
            onChange={(event) => onTimezoneChange(event.target.value)}
            className="bg-transparent text-xs text-white/90 outline-none"
            aria-label="Selecionar fuso horário"
          >
            {timezoneOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-900 text-white">
                {option.label}
              </option>
            ))}
          </select>
        </label>

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
          onClick={onResetSelections}
          className="inline-flex h-10 items-center rounded-full border border-white/20 bg-white/5 px-4 text-sm text-white/85 transition hover:border-white/40 hover:text-white"
          aria-label="Mostrar calendário geral"
        >
          Geral
          {!hasActiveSelection ? <span className="ml-2 text-[10px] text-cyan-100">ativo</span> : null}
        </button>

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
        <p className="text-xs text-white/50">
          Catálogo de serviços definido pela organização; profissionais associados a serviços existentes.
        </p>
      </div>
    </header>
  );
}
