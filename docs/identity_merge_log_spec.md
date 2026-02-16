# Identity Merge Log Spec (Recovered)
Estado documental: `RASTREABILIDADE_TECNICA` (`NAO_NORMATIVO`)

## Objetivo
Registar o contrato tecnico de merge de identidade e auditoria consolidado no SSOT.

## Regras consolidadas
- Fonte canonica: `docs/ssot_registry_v1.md` em `G03.001`.
- Quando conta verificada e criada com email ja associado a profissional, o historico deve ser mergeado para a conta verificada.
- Merge exige auditoria obrigatoria em `IdentityMergeLog`.
- Tombstone explicito e obrigatorio para trilha pos-merge.

## Campos minimos obrigatorios
- `mergeId`
- `fromIdentityId`
- `toIdentityId`
- `reason`
- `emailNormalized`
- `emailHashHmac`
- `triggerSource`
- `idempotencyKey`
- `mergedAt`
- `mergedBy`
- `artifactsMoved`
- `status`
- `failureCode?`

## Nota
Este documento e rastreabilidade tecnica. Norma ativa apenas no SSOT.
