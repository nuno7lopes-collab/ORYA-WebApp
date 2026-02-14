import type { ComponentType, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
type IconComponent = ComponentType<IconProps>;

function IconCalendar(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 9h18" />
    </svg>
  );
}

function IconClock(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function IconTrophy(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" />
      <path d="M5 6h2v2a4 4 0 0 1-4 4V7a1 1 0 0 1 1-1z" />
      <path d="M17 6h2a1 1 0 0 1 1 1v5a4 4 0 0 1-4-4V6z" />
      <path d="M12 11v4" />
      <path d="M9 19h6" />
      <path d="M10 15h4" />
    </svg>
  );
}

function IconClipboard(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4V2h6v2" />
      <path d="M9 9h6M9 13h6" />
    </svg>
  );
}

function IconChat(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function IconTeam(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="9" r="3" />
      <circle cx="16" cy="11" r="3" />
      <path d="M2.5 20c.5-3 3-5 5.5-5" />
      <path d="M13 16c3 0 5.5 2 6 4" />
    </svg>
  );
}

function IconCard(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

function IconChart(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V8" />
      <path d="M17 16v-3" />
      <path d="M7 11l5-3 5 2" />
    </svg>
  );
}

function IconMegaphone(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11l10-4v10L3 13v-2z" />
      <path d="M13 7l7-3v16l-7-3" />
      <path d="M6 14l1 4a2 2 0 0 0 2 1h1" />
    </svg>
  );
}

function IconOrbit(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M3 12c2.5-4.5 15.5-4.5 18 0" />
      <path d="M5 6c4.5 2.5 9.5 8.5 10 12" />
      <path d="M19 6c-4.5 2.5-9.5 8.5-10 12" />
    </svg>
  );
}

function IconBag(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function IconProfile(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20c1.5-3.5 5-5.5 8-5.5s6.5 2 8 5.5" />
    </svg>
  );
}

function IconSliders(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16" />
      <circle cx="9" cy="7" r="2" />
      <path d="M4 17h16" />
      <circle cx="15" cy="17" r="2" />
    </svg>
  );
}

function IconScan(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 3H4a1 1 0 0 0-1 1v3" />
      <path d="M17 3h3a1 1 0 0 1 1 1v3" />
      <path d="M21 17v3a1 1 0 0 1-1 1h-3" />
      <path d="M3 17v3a1 1 0 0 0 1 1h3" />
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}

function IconDefault(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

const MODULE_ICONS: Record<string, IconComponent> = {
  EVENTOS: IconCalendar,
  RESERVAS: IconClock,
  TORNEIOS: IconTrophy,
  INSCRICOES: IconClipboard,
  MENSAGENS: IconChat,
  STAFF: IconTeam,
  FINANCEIRO: IconCard,
  ANALYTICS: IconChart,
  CRM: IconOrbit,
  MARKETING: IconMegaphone,
  LOJA: IconBag,
  PERFIL_PUBLICO: IconProfile,
  DEFINICOES: IconSliders,
  CHECKIN: IconScan,
};

export function ModuleIcon({ moduleKey, ...props }: { moduleKey: string } & IconProps) {
  const Icon = MODULE_ICONS[moduleKey] ?? IconDefault;
  return <Icon {...props} />;
}
