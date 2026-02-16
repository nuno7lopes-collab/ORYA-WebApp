# Legacy Cut Plan (Recovered)
Estado documental: `RASTREABILIDADE_TECNICA` (`NAO_NORMATIVO`)

## Objetivo
Registar regras de hard-cut de legado ja propagadas para o SSOT.

## Regras consolidadas
- Hard-cut imediato de legacy no runtime (sem redirects de compatibilidade).
- Rotas legacy removidas devem responder `410`.
- Nao manter duas formas ativas para o mesmo contrato.
- Remover aliases, reexports e write-paths paralelos.
- Eliminar convivio legacy no runtime e na base de desenvolvimento.

## Exemplos relevantes
- `/org/:orgId/profile*` removido com `410` (sem redirect para settings).
- Endpoints de disponibilidade legacy (`/slots`, `/disponibilidade`) removidos do runtime funcional, com tombstone `410`.

## Fonte de verdade
- `docs/ssot_registry_v1.md` (aditamento owner + regras de hard-cut e subnav/rotas).

## Nota
Documento de rastreabilidade tecnica; norma ativa apenas no SSOT.
