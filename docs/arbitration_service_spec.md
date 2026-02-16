# Arbitration Service Spec (Recovered)
Estado documental: `RASTREABILIDADE_TECNICA` (`NAO_NORMATIVO`)

## Objetivo
Registar o contrato tecnico de arbitragem cross-org propagado para o SSOT.

## Contrato consolidado no SSOT
- Fonte canonica: `docs/ssot_registry_v1.md` em `G07.001` (C01) e `G07.007` (ARB.01).
- Chave de recurso obrigatoria: `resourceKey = resourceType:authorityOrgId:resourceId`.
- `authorityOrgId` e obrigatoria e define a autoridade final da decisao.
- Prioridade v1 de claims: `HARD_BLOCK > MATCH(reasonCode=MATCH_SLOT) > BOOKING > SOFT_BLOCK`.
- `sourceType` canonicos: `MATCH`, `BOOKING`, `HARD_BLOCK` (`SOFT_BLOCK` reservado).
- `MATCH_SLOT` e `reasonCode` (nao e `sourceType`).
- `priorityRuleVersion` e obrigatoria no payload e no audit trail.
- Tipo fora da versao ativa deve falhar em modo fail-closed.

## Auditabilidade e observabilidade
- Campos minimos de auditoria: `arbitrationId`, `inputHash`, `priorityRuleVersion`, regra aplicada, decisao final, ator/org, timestamps.
- Logs estruturados obrigatorios por decisao/override com `correlationId`.

## Nota
Este documento e apenas rastreabilidade tecnica. A norma ativa esta no SSOT.
