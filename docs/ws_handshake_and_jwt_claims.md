# WS Handshake and JWT Claims (Recovered)
Estado documental: `RASTREABILIDADE_TECNICA` (`NAO_NORMATIVO`)

## Objetivo
Registar as regras de handshake WS e autorizacao por JWT que foram propagadas para o SSOT.

## Regras consolidadas
- Fonte canonica: `docs/ssot_registry_v1.md` em `G03.003`.
- Handshake exige payload JSON com `auth`, `app_version`, `context` (`device_attestation` opcional).
- Ausencia de `auth|app_version|context` implica rejeicao imediata.
- Servidor valida autorizacao explicita do token para `context.id`.
- Token revogado implica encerramento ativo do socket.
- Namespaces canonicos:
  - `org:{org_id}:channel:{channel_id}`
  - `dm:user:{u1}:{u2}`
  - `public:global:{id}`
  - `cross-org:{authority_org_id}:{channel_id}`
- Logs estruturados obrigatorios no handshake, authz, rejeicao e revogacao.

## Nota
Este documento e rastreabilidade tecnica. Norma ativa apenas no SSOT.
