# PR #5 — Formal

## Título
`feat(admin-bookings): field booking duration catalog 30/60/90/120 + per-service duration pricing`

## Descrição
Fecho de produto para reservas de campos com política canónica de duração por organização e pricing por duração por serviço `COURT`.

Inclui:
- catálogo fixo de duração `[30,60,90,120]`;
- `activeDurations` como subconjunto por organização;
- `allowCustomDuration=false` obrigatório para campos;
- tabela canónica `ServiceDurationPrice`;
- validação server-side em calendário e reservar (`INVALID_DURATION_POLICY`, `DURATION_NOT_PRICED`);
- paridade de UX web/mobile;
- reforço de contrato nos endpoints admin e públicos.

## QA Checklist
- [ ] `GET /api/org/[orgId]/reservas/config` devolve `durationCatalog`, `activeDurations`, `allowCustomDuration:false`, `presetDurations`.
- [ ] `PATCH /api/org/[orgId]/reservas/config` aceita apenas subset não vazio de `[30,60,90,120]`.
- [ ] `PATCH` com `allowCustomDuration=true` devolve `INVALID_BOOKING_CONFIG`.
- [ ] `GET/PUT /api/org/[orgId]/servicos/[id]/duration-prices` funcionam para `COURT`.
- [ ] `PUT duration-prices` exige preço para todas as durações ativas da organização.
- [ ] `/api/servicos/[id]/calendario` recusa duração fora da policy.
- [ ] `/api/servicos/[id]/reservar` recusa duração sem preço (`DURATION_NOT_PRICED`).
- [ ] UI web mostra chips conforme `activeDurations` e preço por duração.
- [ ] UI mobile mostra as mesmas durações/preços e envia `durationMinutes` no payload.
- [ ] Torneios bulk-block/override sem regressão.

## Critérios de aceitação
- [ ] Política de duração de campos canónica, sem ambiguidades.
- [ ] Preço por duração por serviço `COURT` ativo e auditável.
- [ ] Write-path público não usa `ServicePackage` para preço de `COURT`.
- [ ] Sem feature flags; hard-cut completo.

