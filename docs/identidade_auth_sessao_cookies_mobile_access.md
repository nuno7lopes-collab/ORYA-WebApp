# G03 Fecho Normativo Final (2026-02-16)
Estado documental: `NORMATIVO_TRANSICAO_B1_B9`

## 0) Objetivo
- Fechar integralmente G03 (Identidade/Auth/Sessao-Cookies/Mobile Access) sem dupla verdade.
- Converter o questionario historico Q01..Q63 em texto normativo fechado.
- Propagar 1:1 para o SSOT durante B1..B9.

## 1) Estado de fecho
- Estado de decisao: `FECHADO_FINAL`.
- Estado de implementacao: `EM_EXECUCAO_CONTROLADA`.
- Nao existem decisoes em aberto neste documento.

## 2) Regras normativas fechadas (com racional)

### 2.1 Identidade e claim
1. O conceito canónico externo continua a ser `Identity`; a persistencia canónica MVP e `EmailIdentity`.
Racional: preserva `customerIdentityId/ownerIdentityId` como vocabulario canónico sem reabrir migracao estrutural.

2. `USER`/`GUEST_EMAIL` deixam de ser enum normativo externo; passam a semantica de identidade por email com estado.
Racional: elimina conflito estrutural entre contrato e runtime.

3. Normalizacao canonica de email: `trim + NFKC + lowercase`, sempre no backend.
Racional: dedupe deterministico e sem dependencia de comportamento de cliente.

4. `rawEmail` e mantido para display/auditoria; `emailNormalized` e apenas para lookup/dedupe.
Racional: evita perda de fidelidade visual e previne uso errado no dominio.

5. Regras provider-specific (`remove dots`, `remove +tag`) sao proibidas como normalizacao global.
Racional: evita falsos merges entre providers diferentes.

6. Hash HMAC de email e obrigatorio neste fecho (`emailHashHmac`).
Racional: dedupe/abuse control e idempotencia robusta sem expor dado sensivel.

7. Formula canonica: `email_hmac = HMAC(key_vN, emailNormalized)` com `keyVersion`.
Racional: permite rotacao de segredo sem quebrar dedupe.

8. Rotacao de chave: aceitar `vN` e `vN-1` durante migracao, com backfill gradual.
Racional: evita duplicados em massa durante key rotation.

9. Claim sem email verificado e proibido (fail-closed).
Racional: reduz risco de takeover e claims indevidos.

10. Definicao de verificado forte: confirmacao do IdP (`email_confirmed_at`) validada server-side.
Racional: remove divergencia web/mobile/provider.

11. Claim manual permanece `system-only`; sem endpoint publico de claim manual.
Racional: reduz superficie de abuso e centraliza controlo.

12. Um servico unico de claim/merge e o caminho canónico.
Racional: idempotencia e auditoria centralizadas.

13. Contrato de idempotencia do claim: dedupe por `correlationId + emailHashHmac`.
Racional: protege contra replays concorrentes.

14. `IdentityMergeLog` e obrigatorio e auditavel, com campos minimos definidos no SSOT.
Racional: rastreabilidade operacional e forense.

15. `IdentityTombstone` explicito e obrigatorio na identidade subsumida.
Racional: impede reativacao silenciosa e garante resolucao para target.

16. Em conflito raro de identidade: bloquear e abrir caso manual auditado.
Racional: evita auto-resolucao incorreta em cenarios de alto risco.

17. Concurrency guard obrigatorio: unique por identidade de email + get-or-create transacional.
Racional: previne duplicados sob carga concorrente.

18. Ownership pos-claim deve atualizar consistentemente `Ticket` e `TournamentEntry`.
Racional: elimina heterogeneidade cross-domain.

19. `ownerIdentityId` e canónico para ownership; `ownerUserId` pode existir como auxiliar nao-autoritativo.
Racional: modelo unificado de ownership.

20. `ownerKey` canónico de escrita: `identity:<ownerIdentityId>`.
Racional: evita deriva entre `identity/user/email` no write-path.

21. `ownerKey` legacy (`user:` / `email:`) fica apenas como compatibilidade de leitura temporaria ate hard-cut final.
Racional: transicao segura sem dupla verdade de escrita.

22. Claim no callback de auth nao e canónico; side effects vao para worker/evento pos-login.
Racional: callbacks/clientes ficam previsiveis e read-only.

23. `useUser` so pode disparar claim quando ha verificado forte.
Racional: reduz ruido operacional e tentativas invalidas.

24. Runbook de "claim stuck" com replay idempotente e obrigatorio.
Racional: recuperacao operacional padronizada.

### 2.2 Auth API e contratos
25. `/api/auth/me` em 401/500 devolve erro canónico (nao body de sucesso).
Racional: semantica consistente para FE/QA.

26. `/api/auth/me` e estritamente read-only.
Racional: GET sem side effects evita regressao de comportamento.

27. Side effects de bootstrap/auth vao para workers/eventos dedicados.
Racional: separacao clara read/write.

28. CAUTH.02 explicita split de consumo:
- Web/server: `/api/auth/*` baseline canónico.
- Mobile app: auth direta via Supabase SDK, fora do baseline `/api/auth/*`.
Racional: elimina ambiguidade contratual.

29. Set 03.6 de `errorCode` e canónico minimo e extensivel.
Racional: compatibilidade evolutiva sem breaking desnecessario.

30. Mapeamentos canonicos obrigatorios em auth scope:
- `THROTTLED`/`RATE_LIMIT_ERROR` -> `RATE_LIMITED`
- `INTERNAL_ERROR` -> `SERVER_ERROR`
Racional: remove codigos paralelos.

31. Login por username mantem resolucao via registry + admin lookup nesta fase.
Racional: menor risco de regressao funcional no B1.

32. `/api/auth/check-email` mantem resposta generica anti-enumeracao.
Racional: nao vazar existencia de conta.

33. `/api/auth/clear` limpa so allowlist de estado auth; nao apaga cookies nao-auth.
Racional: evita side effects indevidos em contexto/carrinho.

34. Nao ha contrato publico novo de idempotencia para `/send-otp` e `/reset-request`; internamente deve existir dedupe por janela e retry seguro.
Racional: sem expor contrato extra ao cliente e mantendo robustez operacional.

35. Tabela oficial endpoint -> errorCode -> status e obrigatoria para G03.
Racional: reduz ambiguidades de implementacao/QA.

36. Regra de cliente: UX deve depender de `errorCode`; `message` e apenas texto auxiliar.
Racional: robustez a localizacao e mudanca textual.

### 2.3 Sessao e cookies
37. Politica de cookies por classe (`auth/context/cart/preferences`) e normativa.
Racional: governanca de seguranca por classe.

38. `orya_organization` e cookie de UI nao-sensivel, nunca fonte de authz.
Racional: C13 fail-closed.

39. `orya_organization` em `stage/prod` exige `secure=true` e pode manter `httpOnly=false` por requisito de UI.
Racional: equilibrio entre seguranca e uso client-side legitimo.

40. `orya_store_cart` e cookies de preferencias exigem `secure=true` em `stage/prod`.
Racional: baseline de transporte seguro.

41. Rotacao/expiracao por classe de cookie e obrigatoria.
Racional: minimiza janela de risco por tipo de dado.

42. Matriz de flags por ambiente (`dev/stage/prod`) e obrigatoria no SSOT.
Racional: evita drift operacional.

43. WS org-scope exige contexto explicito; fallback por cookie e proibido para authz.
Racional: alinhamento com C13 fail-closed.

44. Sem org explicito em WS org-scope: `ORG_CONTEXT_REQUIRED` fail-closed.
Racional: nao assumir membership implicita.

45. `lastUsedOrg` nunca pode fundamentar autorizacao.
Racional: so UX/redirect.

46. Logout canónico limpa auth cookies e cookies de contexto UI conforme allowlist.
Racional: encerramento completo de sessao/contexto.

47. `factory reset local` e fluxo separado com step-up, fora do caminho normal.
Racional: reduz risco de uso acidental em UX primaria.

48. Teste automatico anti-regressao e obrigatorio para garantir que nenhuma rota mutavel usa cookie fallback para authz (inclui WS org-scope).
Racional: seguranca verificavel por CI.

### 2.4 Mobile access (HTTP/WS) e mensagens
49. Em b2c, gate mobile-only por headers/query mantem-se nesta fase, com logging e rate limiting obrigatorios.
Racional: contrato atual preservado, com mitigacoes operacionais.

50. Paridade de gate HTTP/WS e obrigatoria (`MOBILE_APP_REQUIRED`/`UPGRADE_REQUIRED` e codigos associados).
Racional: comportamento consistente cross-transport.

51. Handshake WS canónico: payload JSON com `auth`, `app_version`, `context`; `device_attestation` opcional.
Racional: contrato explicito e auditavel.

52. Auth WS por token em subprotocol deixa de ser caminho canónico.
Racional: evita coexistencia de mecanismos concorrentes.

53. `app_version` semver invalido bloqueia fail-closed com `UPGRADE_REQUIRED` e reason `APP_VERSION_INVALID`.
Racional: impede bypass por versao malformada.

54. `MIN_SUPPORTED_MOBILE_VERSION` deve ser configurado por ambiente (sem default permissivo).
Racional: evita abertura acidental em producao.

55. Kill switch de versao por plataforma (`ios`/`android`) e obrigatorio.
Racional: resposta cirurgica a incidentes por plataforma.

56. Mensagens b2c mantem anexos e links permitidos nesta fase, sob guardrails.
Racional: alinhamento com D01.02 fechado no SSOT.

57. Guardrails obrigatorios antes de entrega/acesso a anexo: `virus scan + DLP + quotas`.
Racional: seguranca e compliance.

58. Contrato explicito "mobile login-only" aplica-se a rotas b2c atuais e futuras.
Racional: fecha interpretacao ambigua de cliente autorizado.

59. Mobile app permanece sem consumir `/api/auth/*` para login de utilizador final.
Racional: alinhamento com split CAUTH.02.

60. E2E obrigatorio de gate mobile:
- web -> `MOBILE_APP_REQUIRED`
- mobile antiga -> `UPGRADE_REQUIRED`
- mobile suportada -> `200`
Racional: regressao critica coberta automaticamente.

### 2.5 Apple, perfil mobile, qualidade e operacao
61. D17 universal links so fecha com evidencia de entitlements iOS e teste em device real.
Racional: validacao ponta-a-ponta real.

62. Sign in with Apple permanece obrigatorio em iOS quando existirem logins de terceiros.
Racional: conformidade de plataforma.

63. APNs token-based auth e baseline suficiente para v1.
Racional: maturidade adequada ao ciclo atual.

64. PassKit em v1.x permanece com validacao online por `tokenHash`; offline QR fica fora de v1.x.
Racional: reduz risco operacional em fase atual.

65. DORG.09 (perfil mobile) permanece em review UX separada e nao bloqueia fecho arquitetural de G03.
Racional: separacao de escopo tecnico vs visual.

66. SLOs minimos de auth/mobile access sao obrigatorios (`login_success`, `refresh_success`, `ws_connect_success`).
Racional: operacao mensuravel.

67. Painel de observabilidade G03 com metricas minimas por `errorCode` canónico e obrigatorio.
Racional: triagem e diagnostico rapido.

68. Runbook unico de incidente G03 e obrigatorio (`auth outage`, `session drift`, `claim backlog`, `ws gate`).
Racional: resposta operacional consistente.

69. Release gate deve bloquear deploy quando houver drift SSOT x runtime em `C12`, `CAUTH.02`, `DORG.08`.
Racional: impede fecho apenas documental.

70. Hard-cut de ambiguidades e obrigatorio: apos fecho, nao pode coexistir versao contraditoria ativa.
Racional: canonicidade unica e previsivel.

## 3) Tabela oficial endpoint -> errorCode -> status (G03)
| Endpoint | Status | errorCode canonicos minimos |
|---|---:|---|
| `POST /api/auth/login` | `200/400/401/403/429/500` | `MISSING_CREDENTIALS`, `INVALID_CREDENTIALS`, `EMAIL_NOT_CONFIRMED`, `FORBIDDEN`, `RATE_LIMITED`, `SERVER_ERROR` |
| `POST /api/auth/send-otp` | `200/400/429/500` | `INVALID_EMAIL`, `RATE_LIMITED`, `OTP_GENERATION_FAILED`, `EMAIL_SEND_FAILED`, `SERVER_ERROR` |
| `POST /api/auth/password/reset-request` | `200/400/429/500` | `INVALID_EMAIL`, `RATE_LIMITED`, `RESET_LINK_FAILED`, `EMAIL_SEND_FAILED`, `SERVER_ERROR` |
| `POST /api/auth/refresh` | `200/401/403/500` | `MISSING_TOKENS`, `INVALID_SESSION`, `UNAUTHENTICATED`, `FORBIDDEN`, `SERVER_ERROR` |
| `POST /api/auth/apple/link` | `200/400/401/409/500` | `APPLE_IDENTITY_MISSING`, `APPLE_IDENTITY_INVALID`, `UNAUTHENTICATED`, `ALREADY_LINKED`, `SERVER_ERROR` |
| `GET /api/auth/me` | `200/401/500` | `UNAUTHENTICATED`, `INVALID_SESSION`, `SERVER_ERROR` |
| `POST /api/auth/logout` | `200/401/500` | `UNAUTHENTICATED`, `LOGOUT_FAILED`, `SERVER_ERROR` |
| `POST /api/auth/clear` | `200/401/500` | `UNAUTHENTICATED`, `CLEAR_FAILED`, `SERVER_ERROR` |
| `GET|POST /api/auth/check-email` | `200/400/429/500` | `INVALID_EMAIL`, `RATE_LIMITED`, `SERVER_ERROR` |

## 4) Gate de fecho B1 (obrigatorio)
- `SSOT_NORMATIVE_MODE=DOMAIN_TRANSITION npm run gate:ssot-normative`
- `npm run typecheck`
- `npm run test`

## 5) Nota de propagacao
- Este documento e autoridade normativa por area em B1..B9.
- O mesmo texto normativo deve estar propagado no `docs/ssot_registry_v1.md` sem contradicoes.
