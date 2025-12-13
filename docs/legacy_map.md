# Legacy / cleanup map (estado atual)

- Removidos/sem referências ativas:
  - Roles antigos (`CHECKIN_ONLY`, enums desatualizados) – não há refs em código.
  - `organizers.user_id` para auth – não usado; fallback apenas comentado como legacy (não usar).
  - `event_sales_agg` – não usado em código; reporting usa `sale_summaries`/`sale_lines`.
- Mantidos como LEGACY (read-only) para compatibilidade:
  - `promo_redemptions` – fonte de verdade é `sale_summaries`/`sale_lines` com snapshots; previsto remover se não houver dependências escondidas.
- Boas práticas:
  - Qualquer rota/ficheiro que dependa de algo legacy deve trazer comentário `// TODO legacy – remover quando ...` indicando a condição.
