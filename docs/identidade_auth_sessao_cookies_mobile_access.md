# G03 Master Review e Plano de Fecho (2026-02-15)

## 0) Objetivo deste documento
- Fechar 100% o dominio G03: Identidade, Auth, Sessao/Cookies e Mobile Access.
- Consolidar o que esta fechado no SSOT versus o que esta implementado no codigo.
- Expor ambiguidades, erros, duplas verdades e lacunas de contrato com evidencia tecnica.
- Produzir um questionario de fecho total para aprovar contigo, ponto a ponto.

## 0.1) Regra de autoridade
- O SSOT (`docs/ssot_registry_v1.md`) continua a fonte normativa.
- Este documento e de revisao profunda e fecho operacional/arquitetural.
- As decisoes aprovadas aqui devem ser refletidas no SSOT para evitar deriva.

## 1) Fontes analisadas
- Normativo:
  - `docs/ssot_registry_v1.md`:
    - `02.1.1 Authentication Security Controls`
    - `03.6 Auth errorCode Canonical Set`
    - `G03.001..G03.006`
    - `G04.001 (C13)` para regra de cookies de contexto org
- Formato de referencia:
  - `docs/padel.md`
  - `docs/reservas.md`
- Auth API / envelope / sessao:
  - `app/api/auth/login/route.ts`
  - `app/api/auth/send-otp/route.ts`
  - `app/api/auth/password/reset-request/route.ts`
  - `app/api/auth/refresh/route.ts`
  - `app/api/auth/apple/link/route.ts`
  - `app/api/auth/me/route.ts`
  - `app/api/auth/logout/route.ts`
  - `app/api/auth/clear/route.ts`
  - `app/api/auth/check-email/route.ts`
  - `lib/http/withApiEnvelope.ts`
  - `lib/api/wrapResponse.ts`
  - `lib/auth/requestValidation.ts`
  - `lib/supabaseServer.ts`
  - `lib/supabaseBrowser.ts`
  - `lib/auth/rateLimit.ts`
- Identidade/claim:
  - `prisma/schema.prisma`
  - `lib/utils/email.ts`
  - `lib/ownership/identity.ts`
  - `lib/ownership/claimIdentity.ts`
  - `lib/ownership/resolveOwner.ts`
  - `app/api/email/verified/route.ts`
  - `app/api/me/claim-guest/route.ts`
  - `app/api/internal/worker/operations/route.ts`
  - `app/hooks/useUser.ts`
  - `app/auth/callback/page.tsx`
- Mobile access / mensagens / WS:
  - `app/api/messages/_scope.ts`
  - `lib/http/mobileVersionGate.ts`
  - `app/api/messages/**`
  - `scripts/chat-ws-server.js`
  - `apps/mobile/lib/supabase.js`
  - `apps/mobile/lib/session.ts`
  - `apps/mobile/lib/auth.tsx`
  - `apps/mobile/lib/api.ts`
  - `apps/mobile/features/messages/api.ts`
  - `apps/mobile/app/messages/[threadId].tsx`
  - `apps/mobile/app/auth/email.tsx`
  - `apps/mobile/app/auth/index.tsx`
- Cookies de contexto org e cookies de carrinho:
  - `app/api/org-hub/organizations/switch/route.ts`
  - `lib/organizationId.ts`
  - `lib/organizationContext.ts`
  - `lib/organizationIdUtils.ts`
  - `app/org/_internal/core/_lib/dashboardAccess.ts`
  - `app/api/public/store/cart/route.ts`
  - `app/api/public/store/cart/items/route.ts`
  - `app/api/public/store/cart/bundles/route.ts`
- Username Registry:
  - `packages/shared/src/usernamePolicy.ts`
  - `lib/globalUsernames.ts`
  - `prisma/schema.prisma` (`model GlobalUsername`)
- Apple guardrails:
  - `apps/mobile/app.json`
  - `lib/push/apns.ts`
  - `app/.well-known/apple-app-site-association/route.ts`
  - `lib/apple/universalLinks.ts`
  - `lib/wallet/pass.ts`

## 2) Veredicto executivo (direto)
- Estado de decisao: **ABERTO_PARA_FECHO_FINAL**.
- Estado de implementacao: **PARCIALMENTE_ALINHADO**.
- O core funciona, mas existem divergencias normativas relevantes em C12, CAUTH.02, DORG.08 e parte de D01.02/C13 no WS.
- Existem pelo menos 5 duplas verdades ativas que precisam decisao explicita para evitar regressao futura.

## 3) Matriz SSOT x Codigo (G03)

| Bloco | SSOT | Codigo atual | Estado |
|---|---|---|---|
| 02.1.1 Authentication Security Controls | Anti-enumeracao, origin protection, `/auth/me` canonic read, `/auth/refresh` canonic sync | Regras quase todas presentes | Parcial |
| 03.6 Auth errorCode Canonical Set | Set minimo canonico de auth errors | Maioria em linha, mas existem codigos fora do set minimo | Parcial |
| G03.001 (C12) Identity/Auth claim/merge | USER/GUEST_EMAIL + normalize NFKC + email hash HMAC + merge record + tombstone | Modelo `EmailIdentity`, normalize `trim+lower`, sem merge record/tombstone explicito | Divergente |
| G03.002 (CAUTH.02) Public Auth API baseline | Endpoints + envelope canonico + anti-enumeracao + `/me` read-model + `/refresh` sync | Endpoints cobertos, anti-enumeracao presente, mas `/auth/me` devolve 401/500 com envelope de sucesso | Parcial |
| G03.003 (D01.02) Mensagens mobile-only b2c | HTTP + WS mobile-only, upgrade gate por versao, texto-only | HTTP em linha; WS sem gate de versao; mobile-only por header/query e spoofavel | Parcial |
| G03.004 (D17) Integracoes Apple | Apple sign-in, APNs token auth, universal links, PassKit online | Sinais de implementacao presentes; configuracao final de universal links iOS precisa confirmacao | Parcial |
| G03.005 (DORG.08) Username Registry | min 4, NFC, hold 15 dias, anti-spoof script-mix no MVP | min 3, NFKD/ascii sanitize, sem hold 15d explicito | Divergente |
| G03.006 (DORG.09) Perfil Mobile baseline | Padrao UI/UX mobile de perfil user/org | Sem auditoria visual completa neste ciclo | Nao concluido |

## 4) Regras solidas ja encontradas

### 4.1 Auth e seguranca de origem
- Endpoints auth mutaveis estao em `withApiEnvelope` e passam por bloqueio CSRF cross-site (`lib/http/withApiEnvelope.ts:287-297`).
- Auth routes sensiveis reforcam `isSameOriginOrApp` (`app/api/auth/login/route.ts:24-29`, `app/api/auth/send-otp/route.ts:49-54`, `app/api/auth/refresh/route.ts:17-22`).

### 4.2 Anti-enumeracao
- `send-otp` trata `email_exists` com resposta generica (`app/api/auth/send-otp/route.ts:210-217`, `:304-305`).
- `check-email` GET/POST devolvem mensagem generica (`app/api/auth/check-email/route.ts:46-53`, `:105-111`).
- `reset-request` devolve sucesso em `user_not_found` (`app/api/auth/password/reset-request/route.ts:150-155`).

### 4.3 Sessao e sincronizacao
- `/api/auth/refresh` e o caminho canonic de token -> cookie HttpOnly (`app/api/auth/refresh/route.ts:39-57`).
- `createSupabaseServer` suporta bearer token para clientes mobile (`lib/supabaseServer.ts:58-60`, `:72-79`, `:122-129`).

### 4.4 Mobile gate em mensagens (HTTP)
- Escopo b2c exige mobile (`app/api/messages/_scope.ts:41-44`).
- Cliente nao-mobile recebe `MOBILE_APP_REQUIRED` (`app/api/messages/_scope.ts:29-37`).
- Header de versao ausente/abaixo do minimo recebe `UPGRADE_REQUIRED` (`lib/http/mobileVersionGate.ts:34-56`).

### 4.5 Conteudo texto-only
- Presign de anexos desativado com `ATTACHMENTS_DISABLED` (`lib/messages/handlers/chat/attachments/presign/route.ts:7-9`).
- Rotas de envio rejeitam payload com anexos (`lib/messages/handlers/chat/messages/route.ts:290-292`).

## 5) Achados criticos (ambiguidade, erro, dupla verdade)

### A1) `/api/auth/me` devolve 401/500 com envelope de sucesso (SEV-1)
- Evidencia:
  - `app/api/auth/me/route.ts:60-66` e `app/api/auth/me/route.ts:231-234` retornam `jsonWrap({ user:null, profile:null }, { status: 401|500 })`.
  - `lib/api/wrapResponse.ts:263-299` transforma payload objeto sem shape de erro em `ok: true`.
- Impacto:
  - Contrato CAUTH.02 de erro canonico fica quebrado nesses estados.
  - Consumer pode tratar resposta como sucesso sem perceber erro semantico.

### A2) `/api/auth/me` nao e read-only; faz mutacoes em GET (SEV-2)
- Evidencia:
  - Cria profile em GET (`app/api/auth/me/route.ts:81-105`).
  - Atualiza onboarding em GET (`app/api/auth/me/route.ts:150-156`).
  - Aplica username pendente em GET (`app/api/auth/me/route.ts:112-127`).
- Impacto:
  - Contrato de read-model fica ambiguo (read com side effects).
  - Risco de efeitos colaterais nao esperados em retry/prefetch.

### A3) C12 (Identity model) diverge do SSOT (SEV-1)
- Evidencia SSOT:
  - `C12` exige tipos `USER`/`GUEST_EMAIL`, normalizacao `trim+NFKC+lowercase`, hash HMAC e merge/tombstone.
- Evidencia codigo:
  - Modelo atual `EmailIdentity` (`prisma/schema.prisma:1640-1653`).
  - Normalizacao atual `trim().toLowerCase()` (`lib/utils/email.ts:1-4`).
- Impacto:
  - Dupla verdade normativa entre especificacao e runtime.
  - Risco de inconsistencias de dedupe/claim entre dominios.

### A4) Claim/merge sem merge record e sem tombstone explicito (SEV-2)
- Evidencia:
  - `lib/ownership/claimIdentity.ts` faz update/transfers, mas nao grava entidade dedicada de merge auditavel e nao marca identidade antiga como tombstone.
- Impacto:
  - Auditoria de merge incompleta para incidentes/compliance.

### A5) Fluxo de claim fragmentado em 3 caminhos (SEV-2)
- Evidencia:
  - `app/api/email/verified/route.ts` chama `claimIdentity`.
  - `app/api/me/claim-guest/route.ts` enfileira `CLAIM_GUEST_PURCHASE`.
  - Worker executa claim em `app/api/internal/worker/operations/route.ts:373-455`.
- Impacto:
  - Semantica de idempotencia dispersa e mais dificil de provar formalmente.

### A6) `useUser` dispara claim em condicao permissiva (SEV-2)
- Evidencia:
  - `emailVerified` inclui `Boolean(data?.user?.email)` em `app/hooks/useUser.ts:119-123`.
- Impacto:
  - Cliente dispara claim mesmo sem confirmacao forte de email no front.
  - Endpoint bloqueia sem verificacao (`app/api/me/claim-guest/route.ts:17-20`), mas existe ruido operacional extra.

### A7) CAUTH.02 diz "Mobile auth clients" consumidor de `/api/auth/*`, mas mobile usa Supabase direto (SEV-2)
- Evidencia:
  - Mobile autentica com SDK Supabase:
    - `apps/mobile/app/auth/email.tsx:138-172`
    - `apps/mobile/app/auth/index.tsx:176-236`
    - `apps/mobile/lib/supabase.js:15-22`
  - Nao ha uso de `/api/auth/*` no mobile app.
- Impacto:
  - Contrato CAUTH.02 e realidade do cliente mobile estao desalinhados.

### A8) WS b2c nao aplica gate de versao mobile (SEV-1)
- Evidencia:
  - WS fecha apenas com `MOBILE_APP_REQUIRED` (`scripts/chat-ws-server.js:467-469`).
  - Nao existe check equivalente a `UPGRADE_REQUIRED` no handshake WS.
- Impacto:
  - Cliente desatualizado pode continuar no WS enquanto HTTP exige upgrade.

### A9) Gate de versao aceita semver invalido (SEV-1)
- Evidencia:
  - `compareSemver` retorna `0` se parser falhar (`lib/http/mobileVersionGate.ts:17-24`).
- Impacto:
  - Header de versao malformado pode passar como compativel.

### A10) C13 (cookie org so para redirect UI) vs WS fallback por cookie (SEV-1)
- Evidencia:
  - C13: cookie/lastUsedOrg so redirect UI, nunca autorizacao.
  - WS resolve org por query -> cookie `orya_organization` -> primeira membership (`scripts/chat-ws-server.js:286-295`).
- Impacto:
  - Semantica de contexto org no WS fica ambigua em relacao ao SSOT.

### A11) Mobile-only b2c e header/query based (spoofavel) (SEV-2)
- Evidencia:
  - HTTP usa header `x-client-platform` (`app/api/messages/_scope.ts:16-26`).
  - WS usa query/header `platform` (`scripts/chat-ws-server.js:200-218`, `:456-468`).
- Impacto:
  - Restricao "apenas app" e contratual, mas nao forte em termos de attestation.

### A12) `/api/auth/clear` limpa todos os cookies, nao apenas auth (SEV-2)
- Evidencia:
  - Itera `store.getAll()` e zera todos (`app/api/auth/clear/route.ts:17-31`).
- Impacto:
  - Pode apagar cookies nao-auth (`orya_organization`, carrinho, preferencias).

### A13) `orya_organization` e nao-HttpOnly por design, mas sem classificacao formal (SEV-3)
- Evidencia:
  - Cookie setado com `httpOnly:false` (`app/api/org-hub/organizations/switch/route.ts:65-70`).
  - Leitura via `document.cookie` no util de UI (`lib/organizationIdUtils.ts:65-70`).
- Impacto:
  - Precisa declaracao formal de "cookie nao sensivel" para evitar uso indevido em autorizacao.

### A14) Cookies de carrinho sem `secure` explicito (SEV-3)
- Evidencia:
  - `app/api/public/store/cart/route.ts:350-355`
  - `app/api/public/store/cart/items/route.ts:257-262`
  - `app/api/public/store/cart/bundles/route.ts:271-276`
- Impacto:
  - Exposicao desnecessaria em cenarios nao-HTTPS.

### A15) DORG.08 Username Registry em drift (SEV-1)
- Evidencia:
  - SSOT: min 4, Unicode NFC, hold 15 dias, bloquear mistura de scripts no MVP.
  - Codigo:
    - min 3 (`packages/shared/src/usernamePolicy.ts:442-446`)
    - normalizacao NFKD/ascii sanitize (`packages/shared/src/usernamePolicy.ts:365-370`)
    - sem hold 15 dias em `GlobalUsername` (`prisma/schema.prisma:1051-1062`) nem no runtime (`lib/globalUsernames.ts`).
- Impacto:
  - Regra de username oficialmente fechada nao corresponde ao comportamento real.

### A16) D17 universal links: backend configurado, app iOS precisa confirmacao de entitlements finais (SEV-2)
- Evidencia:
  - AASA route existe (`app/.well-known/apple-app-site-association/route.ts:4-21`).
  - App iOS tem `usesAppleSignIn`, mas nao mostra `associatedDomains` no `apps/mobile/app.json:16-26`.
- Impacto:
  - Risco de universal links nao fecharem ponta-a-ponta sem config de build/entitlements.

## 6) Duplas verdades ativas (para eliminar)
1. C12 define um modelo de identidade; runtime usa outro.
2. CAUTH.02 posiciona mobile auth clients em `/api/auth/*`; mobile real autentica no Supabase SDK.
3. C13 proibe cookie de org para autorizacao; WS usa cookie para resolver contexto inicial.
4. DORG.08 define regras de username; policy/runtime aplicam regras diferentes.
5. `/api/auth/me` e anunciado como read-model canonico, mas hoje mistura read + mutacoes.

## 7) Decisoes de fecho propostas (recomendacao tecnica)

### D1) Modelo canonico de identidade
- Opcao A: manter C12 como esta e refatorar runtime para `Identity(USER|GUEST_EMAIL)`.
- Opcao B: canonizar `EmailIdentity` no SSOT e reescrever C12 para refletir o modelo atual.
- Recomendacao: **B** (mais pragmatica e de menor risco de migracao imediata).

### D2) Normalizacao e dedupe de email
- Opcao A: subir runtime para `trim + NFKC + lowercase` + hash HMAC canonico.
- Opcao B: atualizar SSOT para `trim + lowercase` sem NFKC/HMAC nesta fase.
- Recomendacao: **A** (evita drift futuro e melhora consistencia).

### D3) Merge auditavel
- Opcao A: criar `IdentityMergeLog` + status tombstone explicito.
- Opcao B: manter audit implicit via EventLog generico.
- Recomendacao: **A**.

### D4) Claim pipeline unico
- Opcao A: manter 3 caminhos.
- Opcao B: unificar em um servico de claim com idempotencia unica e consumidores simples.
- Recomendacao: **B**.

### D5) `/api/auth/me` em erro
- Opcao A: manter shape atual e tratar no cliente.
- Opcao B: corrigir para envelope de erro canonico em 401/500.
- Recomendacao: **B**.

### D6) `/api/auth/me` side effects
- Opcao A: manter side effects no GET.
- Opcao B: mover side effects para hooks/eventos dedicados e deixar GET read-only.
- Recomendacao: **B**.

### D7) CAUTH.02 x mobile auth
- Opcao A: obrigar mobile a consumir `/api/auth/*`.
- Opcao B: atualizar CAUTH.02 para refletir que mobile auth e direto no Supabase SDK e `/api/auth/*` e baseline web/server.
- Recomendacao: **B**.

### D8) WS version gate
- Opcao A: manter sem gate de versao no WS.
- Opcao B: adicionar check de versao no handshake com `UPGRADE_REQUIRED`.
- Recomendacao: **B**.

### D9) Gate semver invalido
- Opcao A: manter compare invalido = 0.
- Opcao B: invalido => bloquear com `UPGRADE_REQUIRED` + reason `APP_VERSION_INVALID`.
- Recomendacao: **B**.

### D10) Cookie org no WS
- Opcao A: manter fallback por cookie para resolver org.
- Opcao B: remover cookie da resolucao WS e exigir org explicito (query/header/path), com fallback somente para UI redirect fora da autorizacao.
- Recomendacao: **B**.

### D11) `/api/auth/clear`
- Opcao A: limpar todos os cookies.
- Opcao B: limpar apenas cookies auth (`sb-*`, `orya_admin_mfa`) e documentar endpoint de reset completo separado.
- Recomendacao: **B**.

### D12) Cookies nao-auth
- Opcao A: manter sem `secure` explicito onde nao-auth.
- Opcao B: definir policy unica de cookie flags por classe (auth/context/cart/preferences).
- Recomendacao: **B**.

### D13) DORG.08
- Opcao A: alinhar codigo ao SSOT (min 4, NFC, hold 15d, anti-script-mix MVP).
- Opcao B: atualizar SSOT para o runtime atual.
- Recomendacao: **A**.

### D14) D17 universal links
- Opcao A: considerar fechado com backend AASA apenas.
- Opcao B: fechar so com evidencias de app entitlements iOS + validacao e2e real.
- Recomendacao: **B**.

## 8) Questionario mestre de fecho total (responder tudo)
- Formato sugerido de resposta: `Q01: B`, `Q02: A`, etc.
- Se preferires, podes responder por blocos (A, B, C, D, E).

### A) Identidade e claim
1. Q01. Modelo canonico de identidade: `A` manter C12 atual e refatorar runtime, ou `B` canonizar `EmailIdentity` no SSOT?
2. Q02. Tipos normativos: queres manter explicitamente `USER`/`GUEST_EMAIL` no SSOT (`A`) ou abstrair para "identidade por email com estado" (`B`)?
3. Q03. Normalizacao de email: `A` `trim+NFKC+lower`, `B` `trim+lower`, `C` outro?
4. Q04. Hash HMAC de email para dedupe/abuse: `A` obrigatorio agora, `B` adiar para fase seguinte?
5. Q05. Claim sem email verificado: `A` proibido (fail-closed), `B` permitido em casos controlados?
6. Q06. Merge record dedicado: `A` sim (`IdentityMergeLog`), `B` nao?
7. Q07. Tombstone da identidade antiga: `A` sim, `B` nao?
8. Q08. Quem pode iniciar claim manual? `A` apenas sistema, `B` sistema + user endpoint, `C` incluir suporte/admin?
9. Q09. Unificacao dos 3 caminhos de claim em um servico unico: `A` sim, `B` manter como esta?
10. Q10. Em caso de conflito de identidade (raro): `A` bloquear e abrir caso manual, `B` auto-resolver por regra deterministica?
11. Q11. `useUser` deve disparar claim so com email confirmado forte? `A` sim, `B` manter comportamento atual?
12. Q12. Claim no callback auth deve continuar best-effort async? `A` sim, `B` mover para worker/evento pos-login sem chamada client?
13. Q13. Entitlement ownership canonic: `A` sempre por `ownerIdentityId/ownerKey`, `B` manter dual com `ownerUserId` forte?
14. Q14. Ticket/TournamentEntry ownership apos claim: `A` atualizar ambos sempre, `B` manter heterogeneo por dominio?
15. Q15. Precisas de runbook de "claim stuck" com replay idempotente? `A` sim, `B` nao.

### B) Auth API e contratos
16. Q16. `/api/auth/me` deve devolver erro canonico em 401/500 (`A`) ou manter body atual (`B`)?
17. Q17. `/api/auth/me` deve ser read-only (`A`) ou pode continuar com side effects (`B`)?
18. Q18. Se read-only, migramos side effects para: `A` worker/eventos, `B` endpoint separado de bootstrap?
19. Q19. CAUTH.02 deve explicitar que mobile auth e direto no Supabase SDK? `A` sim, `B` nao.
20. Q20. `03.6` error set: queres forcar somente set fechado (`A`) ou manter set minimo + extensivel (`B`)?
21. Q21. Codigos hoje fora do set (`RATE_LIMIT_ERROR`, `INTERNAL_ERROR`) devem ser mapeados (`A`) ou mantidos (`B`)?
22. Q22. `withApiEnvelope` fallback 429 para `THROTTLED`: `A` manter, `B` mapear para `RATE_LIMITED` em auth scope?
23. Q23. `/api/auth/clear` deve limpar apenas auth cookies (`A`) ou manter "limpa tudo" (`B`)?
24. Q24. `/api/auth/check-email` deve continuar generico sempre (`A`) ou permitir sinalizacao de estados especiais (`B`) sem enumeracao?
25. Q25. Login por username deve continuar resolvendo via registry + admin lookup (`A`) ou simplificar (`B`)?
26. Q26. Queres contrato formal de idempotencia tambem para `/api/auth/send-otp` e `/reset-request` (`A` sim, `B` nao)?
27. Q27. Queres publicar uma tabela oficial endpoint->errorCode->status para G03 (`A` sim, `B` nao)?

### C) Sessao e cookies
28. Q28. Policy de cookies por classe (auth/context/cart/preferences) deve ser formalizada no SSOT? `A` sim, `B` nao.
29. Q29. `orya_organization` deve ficar explicitamente classificado como cookie de UI nao-sensivel? `A` sim, `B` nao.
30. Q30. `orya_organization` deve ter `secure=true` em prod? `A` sim, `B` indiferente.
31. Q31. `orya_organization` pode continuar `httpOnly=false`? `A` sim (UI requirement), `B` nao.
32. Q32. Carrinho `orya_store_cart` deve forcar `secure=true` em prod? `A` sim, `B` nao.
33. Q33. Queres rotacao/expiracao diferenciada por cookie classe? `A` sim, `B` manter atual.
34. Q34. C13 no WS: org context deve ser sempre explicito sem cookie fallback? `A` sim, `B` manter fallback.
35. Q35. Em ausencia de org explicito no WS org-scope: `A` fail-closed, `B` escolher primeira membership?
36. Q36. `lastUsedOrg` pode ser usado em qualquer fluxo de autorizacao? `A` nunca, `B` excecoes controladas?
37. Q37. Queres validar automaticamente via teste que nenhuma rota mutavel usa cookie fallback para authz? `A` sim, `B` nao.
38. Q38. Logout deve limpar tambem cookies de contexto UI? `A` sim, `B` nao.
39. Q39. Queres endpoint separado para "factory reset local" (limpa tudo) protegido por step-up? `A` sim, `B` nao.
40. Q40. Queres documentar matriz de cookie flags por ambiente (dev/stage/prod)? `A` sim, `B` nao.

### D) Mobile access (HTTP/WS) e mensagens
41. Q41. Mobile-only b2c deve continuar baseado em headers/query (`A`) ou queres attestation forte (`B`) no futuro?
42. Q42. WS handshake deve exigir versao de app (`A`) ou nao (`B`)?
43. Q43. Semver invalido deve bloquear (`A`) ou aceitar (`B`)?
44. Q44. `MIN_SUPPORTED_MOBILE_VERSION` default `1.0.0`: `A` manter, `B` exigir configuracao obrigatoria por ambiente?
45. Q45. Queres kill switch de versao por plataforma (ios/android) separado? `A` sim, `B` unico global.
46. Q46. Queres paridade de gate HTTP e WS com os mesmos `errorCode` e reason? `A` sim, `B` nao.
47. Q47. Mensagens b2c devem permanecer texto-only nesta fase? `A` sim, `B` reabrir anexos.
48. Q48. Se reabrir anexos depois, queres contrato de virus scan + DLP + quotas antes? `A` sim, `B` nao.
49. Q49. Mobile app deve continuar sem consumir `/api/auth/*`? `A` sim, `B` migrar para baseline auth API.
50. Q50. Queres contrato explicito "mobile login-only" em todas rotas b2c (incluindo future endpoints)? `A` sim, `B` nao.
51. Q51. WS auth por token no subprotocol mantem-se (`A`) ou queres migrar para outro mecanismo (`B`)?
52. Q52. Queres teste e2e obrigatorio para: `web -> MOBILE_APP_REQUIRED`, `mobile antiga -> UPGRADE_REQUIRED`, `mobile ok -> 200`? `A` sim, `B` nao.

### E) Apple, perfil mobile, qualidade e operacao
53. Q53. D17 universal links so fecha com evidencias de entitlements iOS + teste em device real? `A` sim, `B` nao.
54. Q54. Queres manter Sign in with Apple obrigatorio quando houver login de terceiros no iOS? `A` sim, `B` nao.
55. Q55. APNs token-based auth atual e suficiente para v1? `A` sim, `B` reforcar agora.
56. Q56. PassKit com validacao online por `tokenHash` mantem-se em v1.x? `A` sim, `B` acelerar offline QR.
57. Q57. DORG.09 (perfil mobile) entra neste fecho tecnico agora (`A`) ou em review UX dedicada separada (`B`)?
58. Q58. Se entrar agora, queres checklist visual canonic por tela/componente? `A` sim, `B` nao.
59. Q59. Queres SLOs de auth/mobile access (ex.: login success, refresh success, ws connect success)? `A` sim, `B` nao.
60. Q60. Queres painel de observabilidade G03 com metricas minimas por erro canonico? `A` sim, `B` nao.
61. Q61. Queres runbook unico de incidente G03 (auth outage, session drift, claim backlog, ws gate)? `A` sim, `B` nao.
62. Q62. Queres gate de release bloqueando deploy se houver drift SSOT x runtime em C12/CAUTH.02/DORG.08? `A` sim, `B` nao.
63. Q63. Queres aprovar "hard-cut de ambiguidades" (sem coexistencia de versoes contraditorias apos fecho)? `A` sim, `B` nao.

## 9) Criterios de aceite para declarar G03 "100% fechado"
- C12 sem dupla verdade (modelo, normalizacao, merge auditavel, tombstone, idempotencia).
- CAUTH.02 sem divergencias de envelope/error contract.
- `/api/auth/me` com semantica final aprovada (read-only ou side-effect explicitamente normatizado).
- Politica de cookies formalizada por classe e sem uso indevido para autorizacao.
- Mobile b2c gate coerente entre HTTP e WS (inclui versao).
- DORG.08 alinhado (SSOT e runtime iguais).
- D17 fechado com evidencias de configuracao ponta-a-ponta.
- Testes de nao-regressao para regras criticas (auth envelope, claim idempotente, mobile gate, cookie authz).

## 10) Plano de execucao recomendado (apos respostas)
- F0: Fecho de decisao (respostas Q01..Q63 + minuta final).
- F1: Correcoes de contrato criticas (A1, A3, A8, A9, A10, A15).
- F2: Limpeza estrutural (claim pipeline unico, `/auth/me` sem side effects, policy de cookies).
- F3: Hardening e operacao (testes, observabilidade, runbook, release gates).
- F4: Atualizacao SSOT + auditoria final de conformidade G03.

## 11) Decisao de trabalho deste ciclo
- Este documento foi criado como baseline de fecho profundo de G03.
- Nenhuma alteracao funcional de codigo foi aplicada neste ciclo; foco foi auditoria, consolidacao de contratos e preparacao do fecho com perguntas exaustivas.

## 12) Proposta de Fecho R1 (Bloco A - Q01..Q15)
- Objetivo: acelerar o fecho de Identidade/Claim com uma proposta pre-preenchida.
- Como validar: responde apenas com overrides (ex.: `Q03: B`, `Q08: C`).
- Se concordares com tudo: responde `Bloco A aprovado`.

| Questao | Proposta | Nota curta |
|---|---|---|
| Q01 | `B` | Canonizar `EmailIdentity` no SSOT nesta fase. |
| Q02 | `B` | Abstrair para identidade por email com estado, sem forcar enum antigo. |
| Q03 | `A` | `trim+NFKC+lower` como normalizacao canonica. |
| Q04 | `A` | HMAC para dedupe/abuse agora, evita nova migracao depois. |
| Q05 | `A` | Claim sem email verificado fica bloqueado (fail-closed). |
| Q06 | `A` | Criar `IdentityMergeLog` dedicado e auditavel. |
| Q07 | `A` | Tombstone explicito da identidade antiga. |
| Q08 | `A` | Claim manual apenas sistema (sem suporte/admin nesta fase). |
| Q09 | `A` | Unificar os 3 caminhos de claim num servico unico. |
| Q10 | `A` | Em conflito raro: bloquear e abrir caso manual. |
| Q11 | `A` | `useUser` so dispara claim com confirmacao forte de email. |
| Q12 | `B` | Tirar claim do callback client e mover para worker/evento. |
| Q13 | `A` | Ownership canonico por `ownerIdentityId/ownerKey`. |
| Q14 | `A` | Atualizar `Ticket` e `TournamentEntry` de forma consistente apos claim. |
| Q15 | `A` | Runbook de claim stuck com replay idempotente. |

### 12.1 Impacto esperado se aprovares Bloco A
- Remove dupla verdade de identidade (SSOT vs runtime).
- Fecha semantica de claim/merge com trilho de auditoria.
- Reduz risco operacional de claims silenciosos no frontend.
- Prepara base para F1 sem reabrir decisoes de modelo.

### 12.2 Resposta rapida (template)
```text
Bloco A:
Q01: B
Q02: B
Q03: A
Q04: A
Q05: A
Q06: A
Q07: A
Q08: A
Q09: A
Q10: A
Q11: A
Q12: B
Q13: A
Q14: A
Q15: A
```
