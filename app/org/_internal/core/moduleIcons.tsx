import type { ComponentType, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
type IconComponent = ComponentType<IconProps>;

function IconCalendar(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 9h18" />
    </svg>
  );
}

function IconClock(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function IconTrophy(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4V2h6v2" />
      <path d="M9 9h6M9 13h6" />
    </svg>
  );
}

function IconChat(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function IconTeam(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="9" r="3" />
      <circle cx="16" cy="11" r="3" />
      <path d="M2.5 20c.5-3 3-5 5.5-5" />
      <path d="M13 16c3 0 5.5 2 6 4" />
    </svg>
  );
}

function IconCard(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

function IconChart(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11l10-4v10L3 13v-2z" />
      <path d="M13 7l7-3v16l-7-3" />
      <path d="M6 14l1 4a2 2 0 0 0 2 1h1" />
    </svg>
  );
}

function IconOrbit(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M3 12c2.5-4.5 15.5-4.5 18 0" />
      <path d="M5 6c4.5 2.5 9.5 8.5 10 12" />
      <path d="M19 6c-4.5 2.5-9.5 8.5-10 12" />
    </svg>
  );
}

function IconBag(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function IconProfile(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20c1.5-3.5 5-5.5 8-5.5s6.5 2 8 5.5" />
    </svg>
  );
}

function IconSliders(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16" />
      <circle cx="9" cy="7" r="2" />
      <path d="M4 17h16" />
      <circle cx="15" cy="17" r="2" />
    </svg>
  );
}

function IconScan(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function IconToolEventos(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V9z" />
      <path d="M12 7v10" />
      <path d="M9 11h6" />
    </svg>
  );
}

function IconToolReservas(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function IconToolCalendario(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 9h18" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
    </svg>
  );
}

function IconToolPadelClube(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 4a4 4 0 0 1 4 4v5a3 3 0 1 1-6 0V8a4 4 0 0 1 2-4z" />
      <path d="M11 16l5 5" />
      <path d="M5 9h2M5 12h2M8 7h2" />
    </svg>
  );
}

function IconToolPadelTorneios(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" />
      <path d="M12 11v4M9 19h6" />
      <path d="M5 7H3v2a3 3 0 0 0 3 3M19 7h2v2a3 3 0 0 1-3 3" />
      <path d="M18 4l2-2" />
    </svg>
  );
}

function IconToolCheckin(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 3H4a1 1 0 0 0-1 1v3M17 3h3a1 1 0 0 1 1 1v3M21 17v3a1 1 0 0 1-1 1h-3M3 17v3a1 1 0 0 0 1 1h3" />
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M9.5 12.5l1.8 1.8 3.2-3.2" />
    </svg>
  );
}

function IconToolFormularios(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4V2h6v2M9 10h6M9 14h4" />
      <path d="M15.5 15.5l2.5 2.5M14 17l2-2" />
    </svg>
  );
}

function IconToolChatInterno(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 6h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-3 2v-2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="M14 9h4a2 2 0 0 1 2 2v5l-2-1.5h-2" />
    </svg>
  );
}

function IconToolFinancas(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 8h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
      <path d="M6 8V6a2 2 0 0 1 2-2h10" />
      <circle cx="15" cy="13.5" r="1.5" />
    </svg>
  );
}

function IconToolAnalytics(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20h16" />
      <path d="M7 16v-4M12 16V8M17 16v-6" />
      <path d="M5 11l4-3 3 2 5-4" />
    </svg>
  );
}

function IconToolPromocoes(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12l9-9 9 9-9 9-9-9z" />
      <circle cx="9" cy="9" r="1" />
      <path d="M8 16l8-8" />
    </svg>
  );
}

function IconToolCrm(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10" cy="9" r="3" />
      <path d="M4 19c1.2-2.8 3.8-4.5 6-4.5s4.8 1.7 6 4.5" />
      <path d="M18.5 6.5l.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z" />
    </svg>
  );
}

function IconToolLoja(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <path d="M12 12l.7 1.3 1.5.2-1.1 1 .2 1.5-1.3-.7-1.3.7.2-1.5-1.1-1 1.5-.2z" />
    </svg>
  );
}

function IconToolEquipa(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="9" r="2.5" />
      <circle cx="16" cy="9.5" r="2.5" />
      <circle cx="12" cy="6.5" r="2.5" />
      <path d="M3.5 19c.9-2.5 3-4 4.5-4M16 15c2 0 4 1.5 4.5 4M8 16c1-.8 2.5-1.3 4-1.3s3 .5 4 1.3" />
    </svg>
  );
}

function IconToolDefinicoes(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5L9.2 6a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 3h5l.3-3a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z" />
    </svg>
  );
}

function IconToolPoliticas(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 4h10a2 2 0 0 1 2 2v13l-2-1-2 1-2-1-2 1-2-1-2 1V6a2 2 0 0 1 2-2z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
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
  TOOL_EVENTOS: IconToolEventos,
  TOOL_RESERVAS: IconToolReservas,
  TOOL_CALENDARIO: IconToolCalendario,
  TOOL_PADEL_CLUBE: IconToolPadelClube,
  TOOL_PADEL_TORNEIOS: IconToolPadelTorneios,
  TOOL_CHECKIN: IconToolCheckin,
  TOOL_FORMULARIOS: IconToolFormularios,
  TOOL_CHAT_INTERNO: IconToolChatInterno,
  TOOL_FINANCAS: IconToolFinancas,
  TOOL_ANALYTICS: IconToolAnalytics,
  TOOL_PROMOCOES: IconToolPromocoes,
  TOOL_CRM: IconToolCrm,
  TOOL_LOJA: IconToolLoja,
  TOOL_EQUIPA: IconToolEquipa,
  TOOL_DEFINICOES: IconToolDefinicoes,
  TOOL_POLITICAS: IconToolPoliticas,
};

export function ModuleIcon({ moduleKey, ...props }: { moduleKey: string } & IconProps) {
  const Icon = MODULE_ICONS[moduleKey] ?? IconDefault;
  return <Icon {...props} />;
}
