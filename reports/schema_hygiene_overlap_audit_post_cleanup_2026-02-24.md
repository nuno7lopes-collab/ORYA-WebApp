# Schema Overlap Audit (Post-Cleanup, 2026-02-24)

- GeneratedAtUTC: 2026-02-24T16:30:00Z
- Fonte estrutural: `reports/schema_hygiene_table_overlap_post_cleanup_2026-02-24.csv`
- Princípio: overlap de colunas **não** implica redundância funcional.

## Critério de decisão

1. overlap alto + domínios diferentes + runtime ativo em ambos -> `KEEP_DISTINCT`;
2. overlap alto + semântica convergente + roadmap de unificação -> `CONVERGE_LATER`;
3. overlap alto sem uso real -> `MONITOR_DEV`.

## Decisão por pares relevantes

1. `organization_member_invites` <-> `padel_team_member_invites` (0.875)
   - decisão: `KEEP_DISTINCT`
   - motivo: convites de membership geral vs convites de equipa padel (contextos e regras de negócio distintos).
2. `crm_contact_consents` <-> `user_consents` (0.8462)
   - decisão: `CONVERGE_LATER`
   - motivo: domínio de consentimento potencialmente convergente; ambos ativos e com dados.
3. `organization_group_owner_transfers` <-> `organization_owner_transfers` (0.8333)
   - decisão: `MONITOR_DEV`
   - motivo: ambos sem dados no snapshot atual; não justificar merge/drop nesta fase.
4. `organization_member_invites` <-> `padel_club_staff_invites` (0.8235)
   - decisão: `KEEP_DISTINCT`
   - motivo: fluxo organizacional geral vs staff de clube padel.
5. `padel_club_staff_invites` <-> `padel_team_member_invites` (0.8235)
   - decisão: `KEEP_DISTINCT`
   - motivo: staff operacional do clube vs membership de equipa.
6. `service_duration_prices` <-> `service_packages` (0.6667)
   - decisão: `KEEP_DISTINCT`
   - motivo: pricing unitário/duração vs bundles/composição de serviço.
7. `follows` <-> `organization_follows` (0.6667)
   - decisão: `KEEP_DISTINCT`
   - motivo: grafo user-user vs user-organization.
8. `service_professionals` <-> `service_resources` (0.6667)
   - decisão: `KEEP_DISTINCT`
   - motivo: relação serviço-profissional vs serviço-recurso.

## Conclusão operacional

- Não há par com base suficiente para merge/drop imediato nesta fase.
- Único candidato de convergência com valor potencial: `crm_contact_consents` + `user_consents`.
- Próximo passo seguro: desenhar contrato canónico de consentimento antes de qualquer migração de dados.
