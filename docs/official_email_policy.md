# Official Email Policy (Org)

## SSOT
- Organization.officialEmail + Organization.officialEmailVerifiedAt sao a verdade do estado.
- PlatformSetting key `platform.officialEmail` guarda o email oficial da plataforma.

## Normalizacao
- `normalizeOfficialEmail(input)` = NFKC + trim + lowercase.
- Guardar sempre normalizado.

## Validacao
- Email deve passar regex basico (formato local@dominio).

## Verificacao
- Alterar officialEmail limpa officialEmailVerifiedAt.
- Endpoints de request/confirm devolvem estado estavel (ex.: `status: "VERIFIED"` quando ja verificado).

## Enforcement
- Acoes org-scoped de escrita exigem `officialEmailVerifiedAt` (fail-closed).

## Observabilidade
- requestId/correlationId sempre presentes em respostas de verificacao.

## Platform email
- Getter canonico: `getPlatformOfficialEmail()` (DB -> env -> fallback).
- Default final: `admin@orya.pt` com warning.
