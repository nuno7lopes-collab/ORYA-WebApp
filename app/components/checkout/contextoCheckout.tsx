"use client";

import React, { createContext, useContext, useState } from "react";

export type DadosCheckout = {
  slug: string;
  ticketId: string;
  quantity: number;
  price: number | null;
  ticketName: string | null;
  eventId: string | null;
  userId: string | null;
  waves?: unknown[];
  additional?: Record<string, unknown>;
};

type CheckoutContextType = {
  isOpen: boolean;
  passo: 1 | 2 | 3;
  dados: DadosCheckout | null;
  abrirCheckout: (params: {
    slug: string;
    ticketId: string;
    quantity?: number;
    price?: number | null;
    ticketName?: string | null;
    eventId?: string | null;
    userId?: string | null;
    waves?: unknown[];
  }) => void;
  fecharCheckout: () => void;
  irParaPasso: (passo: 1 | 2 | 3) => void;
  atualizarDados: (patch: Partial<DadosCheckout>) => void;
};

const CheckoutContext = createContext<CheckoutContextType | undefined>(
  undefined,
);

export function CheckoutProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [dados, setDados] = useState<DadosCheckout | null>(null);

  function abrirCheckout({
    slug,
    ticketId,
    quantity = 1,
    price = null,
    ticketName = null,
    eventId = null,
    userId = null,
    waves,
  }: {
    slug: string;
    ticketId: string;
    quantity?: number;
    price?: number | null;
    ticketName?: string | null;
    eventId?: string | null;
    userId?: string | null;
    waves?: unknown[];
  }) {
    setDados((prev) => {
      const safeWaves =
        Array.isArray(waves)
          ? waves
          : prev?.waves && Array.isArray(prev.waves)
          ? prev.waves
          : [];

      return {
        slug,
        ticketId,
        quantity,
        price,
        ticketName,
        eventId,
        userId,
        waves: safeWaves,
        additional: prev?.additional ?? {},
      };
    });

    setPasso(1);
    setIsOpen(true);
  }

  function fecharCheckout() {
    setIsOpen(false);
    setPasso(1);
    setDados(null);
  }

  function irParaPasso(novoPasso: 1 | 2 | 3) {
    setPasso(novoPasso);
  }

  function atualizarDados(patch: Partial<DadosCheckout>) {
    setDados((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  return (
    <CheckoutContext.Provider
      value={{ isOpen, passo, dados, abrirCheckout, fecharCheckout, irParaPasso, atualizarDados }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) {
    throw new Error("useCheckout deve ser usado dentro de um CheckoutProvider");
  }
  return ctx;
}