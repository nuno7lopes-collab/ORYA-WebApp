# Official Email — Política Canónica

Data: 27 Jan 2026

## Normalização (canónica)
- `trim()` + `NFKC` + `lowercase`.
- Guardado em `Organization.officialEmail` **já normalizado** (não existe `officialEmailNormalized`).
- Não aplicamos punycode/IDN nesta iteração; se surgirem domínios unicode reais, adicionar conversão para ASCII antes de guardar.

## Verificação
- Email está verificado se **`officialEmail` normalizado** existe **e** `officialEmailVerifiedAt` != null.
- Alterar `officialEmail` limpa automaticamente `officialEmailVerifiedAt`.
- Método atual: **EMAIL_TOKEN** (link com token).
- Audit log guarda apenas **email mascarado** e `verifiedDomain` (sem payload sensível).
- Se já verificado, endpoints devem responder `200 ok` com `status:"VERIFIED"` (sem erro legacy).

## Gates (regra única)
- Se ação exige email verificado:
  - Sem `officialEmail` → `OFFICIAL_EMAIL_REQUIRED`.
  - Com `officialEmail` mas sem `officialEmailVerifiedAt` → `OFFICIAL_EMAIL_NOT_VERIFIED`.

### Payload canónico (erro)
```json
{
  "ok": false,
  "requestId": "<uuid>",
  "correlationId": "<uuid>",
  "error": "OFFICIAL_EMAIL_NOT_VERIFIED",
  "message": "Email oficial por verificar para esta ação.",
  "email": "foo@bar.com",
  "verifyUrl": "/organizacao/settings?tab=official-email",
  "nextStepUrl": "/organizacao/settings?tab=official-email",
  "reasonCode": "CREATE_SERVICE"
}
```

## Observabilidade
- `requestId` e `correlationId` obrigatorios em payload + headers (`x-orya-request-id`, `x-orya-correlation-id`).
- `correlationId` presente em mutações com side-effects (request/confirm/resend/verify).

## Notas de cache/UI
- Após pedir verificação ou confirmar email, UI deve `mutate()`/`router.refresh()`.
- Shell do dashboard usa `/api/organizacao/me` para revalidar estado.
