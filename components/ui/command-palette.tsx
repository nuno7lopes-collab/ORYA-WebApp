"use client";

import { useEffect, type ReactNode, type RefObject } from "react";
import { Modal } from "@/components/ui/modal";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  placeholder?: string;
  emptyMessage?: string;
  children: ReactNode;
};

export function CommandPalette({
  open,
  onClose,
  query,
  onQueryChange,
  inputRef,
  placeholder = "Pesquisar comando…",
  emptyMessage = "Sem comandos disponíveis para este contexto.",
  children,
}: CommandPaletteProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef?.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [inputRef, open]);

  return (
    <Modal open={open} onClose={onClose} title="Command Palette" description="Ações operacionais rápidas.">
      <div className="flex items-center gap-2">
        <label htmlFor="orya-command-palette-input" className="sr-only">
          Pesquisa de comandos
        </label>
        <input
          id="orya-command-palette-input"
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
        />
      </div>
      <div className="mt-3 max-h-80 space-y-2 overflow-auto">
        {children || <p className="text-[12px] text-white/60">{emptyMessage}</p>}
      </div>
    </Modal>
  );
}
