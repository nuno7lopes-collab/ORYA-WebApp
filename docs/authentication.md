# Autenticacao ORYA — Fluxos, Contratos e Erros

Atualizado: 2026-02-09

## Visao geral
A autenticacao da ORYA combina Supabase Auth no cliente com endpoints internos para login, OTP e sincronizacao de sessao. O fluxo principal e:

1. **UI inicia autenticacao** (`AuthModal`, `AuthWall` ou `/login`).
2. **Login / Signup** via `/api/auth/login` ou `/api/auth/send-otp`.
3. **Verificacao de email (OTP)** quando necessario.
4. **Sincronizacao de sessao** com `/api/auth/refresh` para cookies HttpOnly.
5. **Callback OAuth** em `/auth/callback`.
6. **Onboarding** quando o perfil ainda nao esta completo.

## Componentes UI (fonte de verdade)
- `app/components/autenticação/AuthModal.tsx`: modal unificado (login, signup, verify, reset, onboarding).
- `app/components/autenticação/AuthGate.tsx`: gate de paginas protegidas (modal nao-dismissable).
- `app/components/checkout/AuthWall.tsx`: auth inline no checkout.
- `app/login/page.tsx`: pagina de redirecionamento que abre o modal.
- `app/auth/callback/page.tsx`: callback pos-OAuth/magic-link.

## Sessao e cookies
- **Supabase** mantem sessao no browser.
- **/api/auth/refresh** sincroniza tokens para cookies HttpOnly (server-side).
- **/api/auth/me** e a leitura canonica do estado de auth + perfil.

## Chaves locais (client)
- `orya_post_auth_redirect`: destino pos-login.
- `orya_pending_email`: email pendente para verificacao.
- `orya_pending_step`: passo pendente (`verify`).
- `orya_otp_type`: `signup` ou `magiclink`.

## Endpoints de autenticacao

### `POST /api/auth/login`
Body:
- `identifier`: email ou username
- `password`

Sucesso:
- `ok: true`
- `session.access_token` e `session.refresh_token`

Erros (exemplos):
- `EMAIL_NOT_CONFIRMED`
- `INVALID_CREDENTIALS`
- `MISSING_CREDENTIALS`
- `RATE_LIMITED`
- `SERVER_ERROR`

### `POST /api/auth/send-otp`
Body:
- `email`
- `password` (opcional)
- `username` (opcional)
- `fullName` (opcional)

Sucesso:
- `ok: true`
- `otpType: "signup"`

Nota:
- Para evitar enumeracao de contas, a resposta e generica. Se o email ja existir, o servidor envia um OTP de login (magic link), mas o client continua a tentar `signup` primeiro e faz fallback automatico para `magiclink` na verificacao.

Erros (exemplos):
- `INVALID_EMAIL`
- `WEAK_PASSWORD`
- `USERNAME_INVALID`
- `USERNAME_TAKEN`
- `EMAIL_EXISTS`
- `RATE_LIMITED`
- `OTP_GENERATION_FAILED`
- `EMAIL_SEND_FAILED`

### `POST /api/auth/password/reset-request`
Body:
- `email`

Sucesso:
- `ok: true`

Erros (exemplos):
- `INVALID_EMAIL`
- `RATE_LIMITED`
- `RESET_LINK_FAILED`
- `EMAIL_SEND_FAILED`

### `POST /api/auth/refresh`
Body:
- `access_token`
- `refresh_token`

Sucesso:
- `ok: true`

Erros (exemplos):
- `MISSING_TOKENS`
- `INVALID_SESSION`
- `SERVER_ERROR`

### `POST /api/auth/apple/link`
Body:
- `idToken` (opcional)

Sucesso:
- `ok: true`
- `identityId`

Erros (exemplos):
- `UNAUTHENTICATED`
- `APPLE_IDENTITY_MISSING`
- `APPLE_IDENTITY_INVALID`
- `ALREADY_LINKED`
- `SERVER_ERROR`

### `GET /api/auth/me`
Sucesso:
- `user`, `profile`
- `needsEmailConfirmation` quando email nao confirmado

### `POST /api/auth/logout`
Sucesso:
- `ok: true`

Erros:
- `LOGOUT_FAILED`

### `POST /api/auth/clear`
Sucesso:
- `ok: true`, `cleared: string[]`

Erros:
- `CLEAR_FAILED`

### `GET|POST /api/auth/check-email`
GET:
- `blocked` / `message`

POST:
- resposta generica (nao indica se o email existe)

Erros:
- `INVALID_EMAIL`
- `RATE_LIMITED`

## Erros canonicos (auth)
Todos os endpoints de auth devolvem `errorCode` estavel e `message` humanizada.

Principais codigos:
- `FORBIDDEN`
- `INVALID_EMAIL`
- `RATE_LIMITED`
- `UNAUTHENTICATED`
- `MISSING_CREDENTIALS`
- `INVALID_CREDENTIALS`
- `EMAIL_NOT_CONFIRMED`
- `EMAIL_EXISTS`
- `WEAK_PASSWORD`
- `USERNAME_INVALID`
- `USERNAME_TAKEN`
- `OTP_GENERATION_FAILED`
- `RESET_LINK_FAILED`
- `EMAIL_SEND_FAILED`
- `MISSING_TOKENS`
- `INVALID_SESSION`
- `APPLE_IDENTITY_MISSING`
- `APPLE_IDENTITY_INVALID`
- `ALREADY_LINKED`
- `LOGOUT_FAILED`
- `CLEAR_FAILED`
- `SERVER_ERROR`

## Regras de UX/UXR
- **AuthGate**: modal nao-dismissable (nao permite fechar por clique fora ou botao).
- **Verify**: permitir reenviar codigo com cooldown (respeitar `Retry-After`).
- **Inputs**: `autoComplete` e `inputMode` consistentes em todos os formularios.

## Politica anti-enumeracao
- Endpoints publicos nao revelam se um email existe.
- Mensagens sao genericas e a verificacao trata fallback `signup` -> `magiclink`.

## CSRF / Origem
- Requests mutaveis sao bloqueados quando o browser indica `cross-site`.
- Requests com `Authorization`, `ORYA_APP_SECRET` ou `ORYA_CRON_SECRET` nao precisam de `Origin`.
