# Regras rápidas de performance

- Todas as listas usam paginação ou cursor. Default take/limit: 50 (até 200 em listas de membros/convites onde é aceitável).
- Nunca devolver tudo sem limite por defeito (eventos, bilhetes, participantes, sale_lines, invites/members).
- Evitar `include` gigante; preferir `select` do necessário.
- Índices críticos confirmados: `events.organizer_id`, `tickets.event_id`, `sale_lines.event_id`, `sale_lines.sale_summary_id`, `organizer_members.organizer_id`, `organizer_members.user_id`.
- Preferir SWR/SSR com revalidação em páginas grandes; evitar múltiplos fetches duplicados.
