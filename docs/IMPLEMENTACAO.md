# IMPLEMENTACAO - Plano de Execucao Final (Rastreabilidade Tecnica)

> Estado documental: `RASTREABILIDADE_TECNICA` (`NAO_NORMATIVO`).
> Referencia normativa consolidada: `docs/ssot_registry_v1.md`.
> Ciclo atual: `EM_VERIFICACAO_EXECUCAO`.
> Regra de fecho: este ficheiro e temporario e sera removido no bloco B10.

## Bloco A - Objetivos finais e principios de corte

### A.0 Modelo de autoridade por fase (fechado)
- Fase de execucao (`B1..B9`): a autoridade por area permanece nos documentos de dominio:
  - `docs/dashboard_org_decisions.md` (Dashboard/Ferramentas)
  - `docs/identidade_auth_sessao_cookies_mobile_access.md` (Auth/Cookies)
  - `docs/identidade_auth_historico_pre_fecho.md` (historico revogado; nao normativo nesta transicao)
  - `docs/organizacoes_multiorg.md` (Governance Multi-org)
  - `docs/padel.md` (Padel)
  - `docs/SPLIT_V2.md` + `docs/split_v2_ssot.md` (Split)
  - `docs/reservas.md` (Reservas)
  - `docs/calendario_motor_unico.md` (Motor/Calendario)
- Papel do SSOT nesta fase: consolidar a propagacao sem contrariar o contrato fechado desses dominios.
- Fase final (`B10..B11`): cutover para SSOT unico; auxiliares sao removidos.

### A.1 Objetivo final
- SSOT como unico documento remanescente em `docs/`.
- Zero dualidade normativa fora do SSOT.
- Zero legado/deprecado no codigo, rotas, schema, DB de desenvolvimento e docs.

### A.2 Principios obrigatorios
- Implementacao por blocos B0..B11 sem saltar gates.
- Qualquer regra de negocio final vive no SSOT, nao neste ficheiro.
- Hard-cut direto permitido (fase de desenvolvimento, sem restricoes de compatibilidade prod nesta ronda).
- Nao deixar caminhos paralelos para o mesmo comportamento funcional.

### A.3 Definition of Done global
- `SSOT_NORMATIVE_MODE=DOMAIN_TRANSITION npm run gate:ssot-normative` verde durante `B1..B9`.
- `SSOT_NORMATIVE_MODE=SSOT_ONLY SSOT_ENFORCE_SINGLE_DOC=1 npm run gate:ssot-normative` verde no fecho `B10..B11`.
- `npm run typecheck` verde.
- `npm run test` verde.
- `docs/` fica apenas com `ssot_registry_v1.md` (e este ficheiro removido no B10).

### A.4 Baseline tecnico congelado (B0)
- Snapshot inicial desta ronda (2026-02-16):
  - API routes em `app/api/**`: `526`
  - Ficheiros `domain/** + lib/**`: `377`
  - Ficheiros de testes em `tests/**`: `215`
  - Markdown em `docs/` (top-level): `20`

## Bloco B - Matriz Documento -> SSOT -> Codigo -> Testes

| Documento de rastreabilidade | Secoes SSOT alvo | Codigo principal | Testes/gates |
|---|---|---|---|
| `docs/arbitration_service_spec.md` | C01/G07 arbitragem cross-org (`resourceKey`, `priorityRuleVersion`, prioridade canonica) | `domain/agenda/conflictEngine.ts`, `domain/agenda/conflictResponse.ts`, `app/api/padel/calendar/claims/commit/route.ts`, `app/api/internal/worker/operations/route.ts` | `tests/agenda/conflictEngine.test.ts`, `tests/agenda/conflictIntegration.test.ts`, `tests/ops/arbitrationCompensationRuntimeGuardrails.test.ts` |
| `docs/ws_handshake_and_jwt_claims.md` | Bloco WS handshake/claims/codigos canonicos | `scripts/chat-ws-server.js`, `app/org/_internal/core/(dashboard)/chat/ChatInternoV2Client.tsx`, `app/org/_internal/core/(dashboard)/chat/preview/useChatPreviewData.ts`, `apps/mobile/app/messages/[threadId].tsx` | `tests/ops/wsHandshakeRateLimitGuardrails.test.ts`, `tests/messages/mobileScopeAndAttachmentsContract.test.ts` |
| `docs/split_v2_ssot.md` + `docs/SPLIT_V2.md` | `SPLIT_GARANTIDO` (`S01..S09`) | `domain/bookings/splitGarantido.ts`, `app/api/cron/bookings/split-garantido/route.ts`, `app/api/internal/worker/operations/route.ts`, `lib/operations/fulfillServiceBooking.ts`, `app/api/org/[orgId]/reservas/[id]/split/route.ts`, `app/api/me/reservas/[id]/split/route.ts` | `tests/bookings/splitGarantido.test.ts`, `tests/ops/splitGarantidoHardcutGuardrails.test.ts`, `tests/ops/splitLateRefundMetricGuardrails.test.ts` |
| `docs/identity_merge_log_spec.md` | Contrato `IdentityMergeLog` + `IdentityTombstone` | `prisma/schema.prisma`, `lib/ownership/identity.ts`, `lib/ownership/claimIdentity.ts`, `app/api/email/verified/route.ts` | testes de identidade e rbac relacionados + `npm run typecheck` |
| `docs/identidade_auth_sessao_cookies_mobile_access.md` | Auth/cookies/bootstrap/logout/clear | `app/api/auth/me/route.ts`, `app/api/auth/bootstrap/route.ts`, `app/api/auth/logout/route.ts`, `app/api/auth/clear/route.ts`, `lib/supabaseServer.ts`, `lib/utils/email.ts` | suites auth/rbac + gate normativo |
| `docs/identidade_auth_historico_pre_fecho.md` | Historico revogado (nao normativo); mantido apenas para rastreabilidade | `app/api/auth/*`, `lib/ownership/*`, `lib/supabaseServer.ts`, `scripts/chat-ws-server.js` | gate normativo + testes auth/ws/identity aplicaveis |
| `docs/policies_organizacao_fechado.md` | Policies/defaults/clamps + HP-11 | `lib/organizationPolicies.ts`, `lib/organizationStepUp.ts`, `lib/organizationSuspension.ts`, `app/api/org-hub/organizations/[id]/suspend/route.ts`, `app/api/org-hub/organizations/[id]/route.ts` | `tests/ops/orgDangerZoneStepUpGuardrails.test.ts` |
| `docs/dashboard_org_decisions.md` | Naming canonico `Ferramentas` + visibilidade UI por org | `lib/organizationDashboardToolVisibility.ts`, `lib/organizationDashboardTools.ts`, `app/org/_internal/core/objectiveNav.ts`, `app/org/_internal/core/OrganizationDashboardShell.tsx` | `tests/ops/dashboardFerramentasNamingGuardrails.test.ts` |
| `docs/calendario_motor_unico.md` | Motor unico calendario + federacao leitura + lock/arbitragem | `app/api/org/[orgId]/agenda/route.ts`, `app/api/public/agenda/route.ts`, `domain/agendaReadModel/*`, `domain/agenda/*` | `tests/agenda/*`, `tests/ops/agendaDriftGuardrails.test.ts` |
| `docs/reservas.md` | Booking lifecycle + politica + timeline + canonicidade API | `app/api/org/[orgId]/reservas/*`, `app/api/me/reservas/*`, `lib/reservas/*`, `domain/bookings/commands.ts` | `tests/agenda/booking*.test.ts`, `tests/ops/bookingGuardrails.test.ts` |
| `docs/padel.md` | Torneios/pairings/competicao em curso/partnership/ranking integrados | `app/api/padel/*`, `app/api/org/[orgId]/padel/*`, `domain/padel/*` | `tests/padel/*`, `tests/ops/padel*Guardrails.test.ts` |
| `docs/organizacoes_multiorg.md` | Multi-org governance + hard-cut de rotas antigas | `proxy.ts`, `app/api/org-hub/*`, `lib/organization*` | `tests/ops/orgCanonicalProxyAlias.test.ts`, `tests/ops/noLegacyApiReexportGuardrails.test.ts` |
| `docs/legacy_cut_plan.md` + `docs/fecho_unificado_normativo.md` | Hard-cut global + zero legacy | `proxy.ts`, `scripts/v9_inventory.mjs`, `scripts/v9_parity_gate.mjs`, rotas `410` | `tests/ops/*legacy*`, `tests/ops/*hardcut*` |

## Bloco C - Backlog executavel por blocos B0..B11

| Bloco | Objetivo | Owner tecnico | Deliverables obrigatorios | Gate de saida |
|---|---|---|---|---|
| B0 | Baseline controlado | Core Platform | Inventario inicial de rotas/handlers/schema/docs; matriz atualizada no Bloco B | Baseline registado neste ficheiro |
| B1 | Fecho documental SSOT | Architecture + Docs | Propagacao total para SSOT; gate em modo `DOMAIN_TRANSITION`; estado SSOT em `EM_VERIFICACAO_EXECUCAO` | `SSOT_NORMATIVE_MODE=DOMAIN_TRANSITION npm run gate:ssot-normative` verde |
| B2 | Calendario + Reservas | Agenda/Bookings | Motor unico write-path; 3 tipos alinhados; remocao de duplicacoes funcionais | suites `tests/agenda/*` verdes |
| B3 | Padel | Padel Domain | lifecycle completo, parcerias, audit, read-models de jogador | suites `tests/padel/*` verdes |
| B4 | Ranking | Ranking Domain | rating canonico + projecoes + merge de jogador provisoriamente anonimo | `tests/ranking/*` verdes |
| B5 | Split | Payments Domain | offsession e retries canonicos, settle/debt atomico, observabilidade completa | suites split e guardrails verdes |
| B6 | Chat unificado | Messaging | arquitetura unica web/mobile, sem rotas/clientes legados | suites ws/messages guardrails verdes |
| B7 | Mobile user-side | Mobile | chat + reservas + padel/ranking + timeline pessoal completos | suites mobile guardrails verdes |
| B8 | UI/UX excelencia | Frontend Platform | design QA, consistencia, A11y AA e responsividade | checklist UI/UX assinado + e2e criticos verdes |
| B9 | Higienizacao total legacy | Platform | apagar rotas/reexports/codigo/schema legacy; reset DB dev | guardrails anti-legacy verdes |
| B10 | Fecho documental final | Architecture + Docs | estado SSOT `SEM_GAPS_NORMATIVOS`; apagar auxiliares + planning/checklist + este ficheiro | `docs/` com SSOT unico |
| B11 | Certificacao final | Release Engineering | evidencia consolidada CI/gates | `gate:ssot-normative`, `typecheck`, `test` verdes |

## Bloco D - Checklist de hard-cut legado

### D.1 Codigo e rotas
- [ ] Sem handlers legacy re-exportados para caminhos canonicos.
- [ ] Sem rotas antigas ativas alem de tombstones `410` explicitamente necessarias para corte.
- [ ] Sem alias funcional concorrente para o mesmo dominio.

### D.2 Dados e schema (dev)
- [ ] Sem tabelas/colunas legacy no schema final.
- [ ] Sem enums antigos sem uso.
- [ ] DB desenvolvimento resetada/recriada no modelo final (quando B9 fechar).

### D.3 Documentacao
- [ ] Durante `B1..B9`, autoridade por dominio ativa nos blocos fechados (Dashboard/Ferramentas, Auth/Cookies, Multi-org, Padel, Split, Reservas, Motor/Calendario); historico Identity/Auth permanece revogado.
- [ ] Em `B10..B11`, sem autoridade normativa fora do SSOT.
- [ ] Sem referencias no codigo/scripts/tests para docs auxiliares removidos.

## Bloco E - Evidencias de gate por execucao

| Data | Bloco | Comando | Resultado | Evidencia |
|---|---|---|---|---|
| 2026-02-16 | B1 | `SSOT_NORMATIVE_MODE=DOMAIN_TRANSITION npm run gate:ssot-normative` | OK | Gate de transicao por dominio ativo |
| 2026-02-16 | B10 (precheck) | `SSOT_NORMATIVE_MODE=SSOT_ONLY SSOT_ENFORCE_SINGLE_DOC=1 npm run gate:ssot-normative` | EXPECTED_FAIL | Guardrail final preparado; reprova enquanto existirem auxiliares |

## Bloco F - Checklist de remocao final deste ficheiro
- [ ] B10 concluido e SSOT em `SEM_GAPS_NORMATIVOS`.
- [ ] Todos os auxiliares removidos do `docs/`.
- [ ] Nenhuma referencia restante a `docs/IMPLEMENTACAO.md`.
- [ ] Apagar `docs/IMPLEMENTACAO.md` no PR final de certificacao.

## Bloco G - QA smoke (Perfil publico automatico + Loja)

### G.1 Data e ambiente
- Data: `2026-02-16`
- Ambiente: local (`next dev` em `http://localhost:3000`)
- Organizacao validada: `top_padel` (`orgId=51`)

### G.2 Correcoes operacionais antes do smoke
- Reinicio do processo `next dev` para carregar Prisma Client atualizado (processo antigo estava com cliente em memoria desatualizado).
- Aplicacao de migracoes pendentes com `npm run -s db:deploy` (incluindo `20260216110000_public_profile_social_cleanup`).

### G.3 Checklist de validacao (resultado)

| ID | Cenario | Esperado | Resultado |
|---|---|---|---|
| G3.1 | `GET /top_padel` | Perfil publico responde `200` | PASS |
| G3.2 | Secoes fixas no perfil | `Agenda pública`, `Reservas`, `Formulários` renderizam | PASS |
| G3.3 | Blocos removidos | `Hero`, `Sobre`, `Galeria`, `FAQ`, `Contacto`, `PADEL oficial`, `Treinadores` nao renderizam | PASS |
| G3.4 | Loja baseline | Com loja `ACTIVE + show_on_profile=true + >=1 PUBLIC`, secao da loja renderiza | PASS |
| G3.5 | Esconder loja | Com `show_on_profile=false`, loja desaparece do perfil | PASS |
| G3.6 | Loja sem produtos publicos | Com `show_on_profile=true + status=ACTIVE + publicProducts=0`, loja nao renderiza | PASS |
| G3.7 | Restauracao | Repor estado inicial volta a mostrar loja no perfil | PASS |
| G3.8 | API publish gate | `PATCH /api/org/[orgId]/store` bloqueia publish sem produtos publicos | PASS (`tests/store/orgStorePatchPaymentsGate.test.ts`) |
| G3.9 | Regra helper de loja publica | Estado publico exige `ACTIVE + showOnProfile + >=1 PUBLIC` | PASS (`tests/store/storeAccess.test.ts`) |

### G.4 Evidencia de comandos executados
- `curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/top_padel`
- `npm run -s db:deploy`
- `curl -sS 'http://localhost:3000/api/public/profile?username=top_padel'`
- `curl -sS 'http://localhost:3000/api/public/store/catalog?username=top_padel'`
- Smoke controlado com SQL em `app_v3.stores`/`app_v3.store_products` (toggle + restore) para validar regra `ACTIVE + show_on_profile + >=1 PUBLIC`.
- `npm test -- tests/store/orgStorePatchPaymentsGate.test.ts`
- `npm test -- tests/store/storeAccess.test.ts`

### G.5 Notas
- O endpoint `api/public/profile/events` devolve payload por tipo (`upcoming`/`past`), mas a apresentacao de agenda no perfil publico web esta ordenada do mais recente para o mais antigo no bloco de agenda.
