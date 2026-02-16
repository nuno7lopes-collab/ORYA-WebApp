# Dashboard Org Decisions (Recovered)
Estado documental: `NORMATIVO_TRANSICAO_B1_B9`

## Escopo
Autoridade de transicao (B1..B9) para dashboard/ferramentas de organizacao.

## Decisoes fechadas
- Ferramenta `profile` foi removida do dashboard como ferramenta separada.
- Administracao de perfil publico da organizacao foi fundida em `settings`.
- Perfil publico por username da organizacao continua disponivel para utilizadores.
- Visibilidade de ferramenta no dashboard e preferencia de UI por organizacao; nao altera capacidade de dominio.
- Capacidade funcional continua governada por modulo ativo (`enabled=true`) e RBAC.
- Alteracao de visibilidade no dashboard permitida a `OWNER`, `CO_OWNER`, `ADMIN`.
- Ferramentas estruturais nao ocultaveis: `settings`, `finance`, `staff`.
- Rotas legacy de perfil (`/org/:orgId/profile*`) sao hard-cut com `410` (sem redirect).
- `settings/verify` permanece rota tecnica de token, sem item proprio na subnav.
- Official email e gerido em `settings/general` por `OWNER` e `CO_OWNER`.

## Referencias no SSOT
- `docs/ssot_registry_v1.md`: `G03.004`, `G03.005`, `G03.006` e bloco de rotas/subnav.
