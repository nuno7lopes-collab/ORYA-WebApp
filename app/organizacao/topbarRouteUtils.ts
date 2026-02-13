export function normalizeOrganizationPathname(pathname: string | null): string | null {
  if (!pathname) return pathname;
  if (pathname === "/organizacao/overview") return "/organizacao";
  if (pathname.startsWith("/organizacao")) return pathname;

  const canonicalMatch = pathname.match(/^\/org\/\d+(?:\/(.*))?$/i);
  if (!canonicalMatch) return pathname;

  const rest = `/${canonicalMatch[1] ?? ""}`.replace(/\/+$/, "") || "/";
  if (rest === "/" || rest === "/overview") return "/organizacao";
  if (rest === "/operations" || rest === "/manage") return "/organizacao/manage";
  if (rest === "/marketing" || rest === "/promote" || rest === "/promo") return "/organizacao/promote";
  if (rest === "/profile" || rest === "/perfil/seguidores") return "/organizacao/profile";
  if (rest === "/profile/followers") return "/organizacao/profile/seguidores";
  if (rest === "/analytics" || rest === "/financas" || rest === "/finance") return "/organizacao/analyze";
  if (rest === "/finance/invoices") return "/organizacao/pagamentos/invoices";
  if (rest === "/checkin" || rest === "/check-in") return "/organizacao/scan";
  if (rest === "/servicos" || rest === "/bookings" || rest.startsWith("/bookings/")) {
    return `/organizacao${rest.replace("/bookings", "/reservas")}`;
  }
  if (rest === "/events" || rest.startsWith("/events/")) return `/organizacao${rest.replace("/events", "/eventos")}`;
  if (rest === "/forms" || rest.startsWith("/forms/")) return `/organizacao${rest.replace("/forms", "/inscricoes")}`;
  if (rest === "/team") return "/organizacao/staff";
  if (rest === "/trainers") return "/organizacao/treinadores";
  if (rest === "/club/members") return "/organizacao/clube/membros";
  if (rest === "/club/cash") return "/organizacao/clube/caixa";
  if (rest === "/chat" || rest === "/chat/preview") return `/organizacao${rest}`;
  if (rest === "/crm") return "/organizacao/crm";
  if (rest === "/crm/customers") return "/organizacao/crm/clientes";
  if (rest.startsWith("/crm/customers/")) return `/organizacao/crm/clientes/${rest.slice("/crm/customers/".length)}`;
  if (rest === "/crm/segments") return "/organizacao/crm/segmentos";
  if (rest.startsWith("/crm/segments/")) return `/organizacao/crm/segmentos/${rest.slice("/crm/segments/".length)}`;
  if (rest === "/crm/campaigns") return "/organizacao/crm/campanhas";
  if (rest === "/crm/reports") return "/organizacao/crm/relatorios";
  if (rest === "/crm/loyalty") return "/organizacao/crm/loyalty";
  if (rest === "/padel") return "/organizacao/padel";
  if (rest === "/padel/clubs") return "/organizacao/padel/clube";
  if (rest === "/padel/tournaments") return "/organizacao/padel/torneios";
  if (rest === "/padel/tournaments/new") return "/organizacao/padel/torneios/novo";
  if (rest.startsWith("/padel/tournaments/")) return `/organizacao/padel/torneios/${rest.slice("/padel/tournaments/".length)}`;
  if (rest === "/tournaments") return "/organizacao/torneios";
  if (rest === "/tournaments/new") return "/organizacao/torneios/novo";
  if (rest.startsWith("/tournaments/")) return `/organizacao/torneios/${rest.slice("/tournaments/".length)}`;
  if (rest === "/store") return "/organizacao/loja";
  if (rest.startsWith("/store/")) return `/organizacao/loja/${rest.slice("/store/".length)}`;
  if (rest === "/settings" || rest.startsWith("/settings/")) return `/organizacao${rest}`;

  return pathname;
}
