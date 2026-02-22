# PR #6 — Formal

## Título
`chore(closeout): final hardening, mobile parity tests, runbook+ssot normative close`

## Descrição
Fecho final de qualidade e operação para o hard-cut de Reservas+Aulas+Torneios.

Inclui:
- suites de testes finais (policy/pricing/grid/torneios/wizard/mobile/e2e);
- gates técnicos (`typecheck`, `typecheck:mobile`, `vitest`);
- observabilidade operacional e alertas determinísticos no `ops/summary`;
- atualização final de runbook de cutover/rollback;
- atualização SSOT com norma canónica de duração/preço em campos;
- limpeza de contradições documentais históricas.

## QA Checklist
- [ ] `npm run typecheck -- --pretty false` verde.
- [ ] `npm run typecheck:mobile` verde.
- [ ] `npx vitest run tests/**/*.test.ts` verde.
- [ ] testes mobile de booking payload/policy verdes.
- [ ] testes de torneios bulk-block/override verdes.
- [ ] teste de wizard por formatos verde.
- [ ] smoke e2e treinador -> publish/approve -> `ReservationProfessional` -> aula recorrente -> calendar -> overlap recusado.
- [ ] `docs/runbooks/padel_live_ops_v1.md` alinhado com catálogo 30/60/90/120.
- [ ] `docs/ssot_registry_v1.md` sem contradições normativas no domínio.

## Critérios de aceitação
- [ ] Qualidade técnica final fechada e reproduzível.
- [ ] Paridade web/mobile confirmada para reservas de campos.
- [ ] Monitorização e alertas úteis em operação real.
- [ ] Runbook executável para cutover e rollback de aplicação.
- [ ] Sem feature flags e sem rollback de schema.

