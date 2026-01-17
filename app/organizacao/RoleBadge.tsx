"use client";

type Role = "OWNER" | "CO_OWNER" | "ADMIN" | "STAFF" | "TRAINER" | "PROMOTER" | "VIEWER";

type Props = {
  role: Role;
  subtle?: boolean;
};

const ROLE_STYLES: Record<Role, string> = {
  OWNER: "border-amber-300/60 bg-amber-400/15 text-amber-50",
  CO_OWNER: "border-emerald-300/50 bg-emerald-400/10 text-emerald-50",
  ADMIN: "border-sky-300/50 bg-sky-400/10 text-sky-50",
  STAFF: "border-white/20 bg-white/10 text-white/80",
  TRAINER: "border-cyan-300/50 bg-cyan-400/10 text-cyan-50",
  PROMOTER: "border-lime-300/40 bg-lime-400/10 text-lime-50",
  VIEWER: "border-white/10 bg-white/5 text-white/60",
};

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  CO_OWNER: "Co-owner",
  ADMIN: "Admin",
  STAFF: "Staff",
  TRAINER: "Treinador",
  PROMOTER: "Promoter",
  VIEWER: "Viewer",
};

export function RoleBadge({ role, subtle }: Props) {
  const tone = ROLE_STYLES[role] ?? ROLE_STYLES.STAFF;
  const padding = subtle ? "px-2 py-[2px]" : "px-3 py-[6px]";
  return (
    <span
      className={`inline-flex items-center rounded-full border ${padding} text-[11px] uppercase tracking-[0.16em] ${tone}`}
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}
