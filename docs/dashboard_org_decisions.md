# Dashboard Org Decisions (Recovered)
Estado documental: `NORMATIVO_TRANSICAO_B1_B9`

## Escopo
Autoridade de transicao (B1..B9) para dashboard/ferramentas de organizacao.

## Decisoes fechadas
- Ferramenta `profile` foi removida do dashboard como ferramenta separada.
- Administracao de perfil publico da organizacao foi fundida em `settings`.
- Perfil publico por username da organizacao continua disponivel para utilizadores.
- Ferramenta `calendar` e canónica no dashboard como superfície operacional read-first.
- Ferramenta `bookings` e canónica como write-model de reservas (servicos/disponibilidade/profissionais/recursos/policies/precos/integracoes/clientes).
- Split funcional obrigatório: `calendar` (leitura operacional) vs `bookings` (escrita/configuração).
- Visibilidade de ferramenta no dashboard e preferencia de UI por organizacao; nao altera capacidade de dominio.
- Capacidade funcional continua governada por modulo ativo (`enabled=true`) e RBAC.
- Alteracao de visibilidade no dashboard permitida a `OWNER`, `CO_OWNER`, `ADMIN`.
- Ferramentas estruturais nao ocultaveis: `settings`, `finance`, `staff`, `calendar`.
- Rotas legacy de perfil (`/org/:orgId/profile*`) sao hard-cut com `410` (sem redirect).
- Rota de servicos canónica: `/org/:orgId/bookings`; `/org/:orgId/bookings/services` e removida (`410`).
- Query legacy de bookings e removida (`410`): `tab=availability`, `bookings=availability|prices|integrations`.
- `settings/verify` permanece rota tecnica de token, sem item proprio na subnav.
- Official email e gerido em `settings/general` por `OWNER` e `CO_OWNER`.

## Referencias no SSOT
- `docs/ssot_registry_v1.md`: `G03.004`, `G03.005`, `G03.006` e bloco de rotas/subnav.
