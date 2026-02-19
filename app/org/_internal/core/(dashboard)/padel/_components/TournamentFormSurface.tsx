"use client";

import type { ReactNode } from "react";
import styles from "./TournamentFormSurface.module.css";

type SurfaceTab = {
  id: string;
  label: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
};

type TournamentFormSurfaceProps = {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  tabs?: SurfaceTab[];
  footer?: ReactNode;
};

export function TournamentFormSurface({ leftColumn, rightColumn, tabs = [], footer }: TournamentFormSurfaceProps) {
  return (
    <section className={styles.surface}>
      {tabs.length > 0 ? (
        <div className={styles.tabs}>
          {tabs.map((tab) => {
            const className = `rounded-full border px-3 py-1 text-[12px] transition ${
              tab.active
                ? "border-white/40 bg-white/15 text-white"
                : "border-white/20 bg-white/[0.04] text-white/75 hover:border-white/35 hover:text-white"
            }`;
            if (tab.href) {
              return (
                <a key={tab.id} href={tab.href} className={className}>
                  {tab.label}
                </a>
              );
            }
            return (
              <button key={tab.id} type="button" onClick={tab.onClick} className={className}>
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={styles.grid}>
        <aside className={styles.left}>{leftColumn}</aside>
        <div className={styles.right}>{rightColumn}</div>
      </div>

      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </section>
  );
}
