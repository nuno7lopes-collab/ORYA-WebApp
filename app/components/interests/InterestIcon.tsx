"use client";

import { cn } from "@/lib/utils";
import type { InterestId } from "@/lib/interests";

type InterestIconProps = {
  id: InterestId;
  className?: string;
};

export default function InterestIcon({ id, className }: InterestIconProps) {
  const baseClass = cn("h-3.5 w-3.5", className);

  switch (id) {
    case "concertos":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 4v11a2.5 2.5 0 1 1-1.5-2.3V7l7-2v7.5a2.5 2.5 0 1 1-1.5-2.3V5.5l-4 1.1" />
        </svg>
      );
    case "festas":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l2.3 5.2 5.7.5-4.3 3.7 1.3 5.6-5-3-5 3 1.3-5.6L4 8.7l5.7-.5L12 3z" />
        </svg>
      );
    case "padel":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="10" cy="10" r="3.5" />
          <path d="M12.5 12.5l5 5" />
          <path d="M16.5 17.5l1.5 1.5" />
        </svg>
      );
    case "viagens":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 12l19-6-4.5 7 4.5 5-2 1-6-4-4 2-2 4-2-1 2-5-5-3z" />
        </svg>
      );
    case "bem_estar":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 14c6 0 10-6 16-10-1 9-7 16-16 16-3 0-4-2-4-4 0-2 2-2 4-2z" />
        </svg>
      );
    case "gastronomia":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3v9" />
          <path d="M9 3v9" />
          <path d="M12 3v9" />
          <path d="M7.5 12v9" />
          <path d="M16 3v18" />
          <path d="M16 3c2 0 3 2 3 4s-1 4-3 4" />
        </svg>
      );
    case "aulas":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h7a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V6z" />
          <path d="M13 8h6a2 2 0 0 1 2 2v10h-8" />
        </svg>
      );
    case "workshops":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M13 6l5 5-2 2-5-5-2 2-3-3 2-2a3 3 0 0 1 5 1z" />
          <path d="M10 10l-5 5a2 2 0 1 0 3 3l5-5" />
        </svg>
      );
    default:
      return null;
  }
}
