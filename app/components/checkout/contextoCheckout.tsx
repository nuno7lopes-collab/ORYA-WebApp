"use client";

import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

export type DadosCheckout = {
  slug: string;
  ticketId: string;
  quantity: number;
  price: number | null;
  ticketName: string | null;
  eventId: string | null;
  userId: string | null;
  pairingId?: number | null;
  pairingSlotId?: number | null;
  ticketTypeId?: number | null;
  waves?: unknown[];
  additional?: Record<string, unknown>;
  paymentScenario?: string | null;
};

export type CheckoutBreakdown = {
  lines: {
    ticketTypeId: number;
    name: string;
    quantity: number;
    unitPriceCents: number;
    currency: string;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  feeMode: string | null;
  platformFeeCents: number;
  platformFeeCombinedCents?: number;
  platformFeeOryaCents?: number;
  stripeFeeEstimateCents?: number;
  totalCents: number;
  currency: string;
  discountCents?: number;
  feeBpsApplied?: number;
  feeFixedApplied?: number;
} | null;

type CheckoutContextType = {
  isOpen: boolean;
  passo: 1 | 2 | 3;
  dados: DadosCheckout | null;
  breakdown: CheckoutBreakdown;
  abrirCheckout: (params: {
    slug: string;
    ticketId: string;
    quantity?: number;
    price?: number | null;
    ticketName?: string | null;
    eventId?: string | null;
    userId?: string | null;
    waves?: unknown[];
    additional?: Record<string, unknown>;
    pairingId?: number | null;
    pairingSlotId?: number | null;
    ticketTypeId?: number | null;
  }) => void;
  fecharCheckout: () => void;
  irParaPasso: (passo: 1 | 2 | 3) => void;
  atualizarDados: (patch: Partial<DadosCheckout>) => void;
  setBreakdown: (b: CheckoutContextType["breakdown"]) => void;
};

const CheckoutContext = createContext<CheckoutContextType | undefined>(
  undefined,
);

export function CheckoutProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [dados, setDados] = useState<DadosCheckout | null>(null);
  const [breakdown, setBreakdown] = useState<CheckoutBreakdown>(null);

  const abrirCheckout = useCallback(
    ({
      slug,
      ticketId,
      quantity = 1,
      price = null,
      ticketName = null,
      eventId = null,
      userId = null,
      waves,
      additional,
      pairingId = null,
      pairingSlotId = null,
      ticketTypeId = null,
    }: {
      slug: string;
      ticketId: string;
      quantity?: number;
      price?: number | null;
      ticketName?: string | null;
      eventId?: string | null;
      userId?: string | null;
      waves?: unknown[];
      additional?: Record<string, unknown>;
      pairingId?: number | null;
      pairingSlotId?: number | null;
      ticketTypeId?: number | null;
    }) => {
      setDados((prev) => {
        const safeWaves =
          Array.isArray(waves)
            ? waves
            : prev?.waves && Array.isArray(prev.waves)
            ? prev.waves
            : [];
        const safeAdditional =
          additional && typeof additional === "object"
            ? additional
            : prev?.additional ?? {};

        return {
          slug,
          ticketId,
          quantity,
          price,
          ticketName,
          eventId,
          userId,
          waves: safeWaves,
          pairingId,
          pairingSlotId,
          ticketTypeId,
          additional: safeAdditional,
        };
      });

      setPasso(1);
      setIsOpen(true);
    },
    [],
  );

  const fecharCheckout = useCallback(() => {
    setIsOpen(false);
    setPasso(1);
    setDados(null);
    setBreakdown(null);
  }, []);

  const irParaPasso = useCallback((novoPasso: 1 | 2 | 3) => {
    setPasso(novoPasso);
  }, []);

  const atualizarDados = useCallback((patch: Partial<DadosCheckout>) => {
    setDados((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      passo,
      dados,
      breakdown,
      setBreakdown,
      abrirCheckout,
      fecharCheckout,
      irParaPasso,
      atualizarDados,
    }),
    [isOpen, passo, dados, breakdown, abrirCheckout, fecharCheckout, irParaPasso, atualizarDados],
  );

  return (
    <CheckoutContext.Provider value={value}>
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
