# SECURITY_HARDENING

## Objetivo
Resolver os findings do Pentester e estabelecer um baseline de segurança consistente (headers, HTTPS, WAF, subdomínios e redução de exposição), com implementação faseada e decisões documentadas.

## Inventário de subdomínios (a confirmar)
- orya.pt: site público, canonical recomendado.
- www.orya.pt: deve redirecionar para o canonical.
- admin.orya.pt: backoffice, protegido por autenticação e regras adicionais.
- Outros subdomínios: confirmar no DNS e desativar se não usados (remover DNS/route) ou servir 410/404 com configuração mínima.

## Decisões
- Canonical: `orya.pt` (ajustável via `CANONICAL_HOST`).
- HTTPS: forçar em produção (`FORCE_HTTPS=1`).
- CSP: começar em modo Report-Only e ajustar allowlist antes de aplicar em enforce.
- security.txt: exposto em `/.well-known/security.txt` e duplicado em `/security.txt`.
- Headers de fingerprinting:
  - `X-Powered-By` desativado via Next.
  - `Server` deve ser removido/mascarado na borda (Cloudflare/Nginx/ALB), pois a app não garante remoção total.

## Implementações no repo
- Headers base alinhados com OWASP/MDN (HSTS, CSP Report-Only, Referrer-Policy, etc.).
- Redirects canónicos + forçar HTTPS em middleware.
- `Cache-Control: no-store` em rotas sensíveis.
- `security.txt` em `.well-known` e na raiz.

## Configuração AWS/edge (manual)
- Definir `orya.pt` como domínio primário e garantir redirect de `www` para o root no CloudFront/ALB.
- Confirmar certificados geridos no ACM e auto-renovação ativa.
- Ativar WAF com regras para `/admin`, `/login` e `/api`.
- Criar allowlist temporária para os IPs do Pentester com expiração.
- Se for necessário remover `Server`, aplicar regra na borda (Cloudflare/ALB/CloudFront).

## Variáveis de ambiente relevantes
- `CANONICAL_HOST` (ex.: `orya.pt`)
- `CANONICAL_PROTOCOL` (default `https`)
- `FORCE_HTTPS` (`1` para ativo, `0` para desligar)
- `CSP_REPORT_ONLY` (`1` para ativar em ambientes não-prod)
- `ADMIN_HOSTS` (lista de hosts admin, separados por vírgula)
- `ADMIN_ALLOWED_IPS` (allowlist IPs/CIDR admin, separados por vírgula)

## Plano por fases

### Fase 1 — Quick wins (1 dia)
- [x] Canonical redirects (host canonical configurado em middleware).
- [x] Forçar HTTPS em produção.
- [ ] Auto-renovação SSL (ACME/managed cert do provider).
- [ ] Monitor proativo de expiração de certificados.
- [x] Remover X-Powered-By (Next) e documentar remoção do Server na borda.
- [x] Adicionar `/.well-known/security.txt`.
- [x] Revisão de `robots.txt` (não lista rotas sensíveis).

### Fase 2 — Headers (1–2 dias)
- [x] Headers baseline implementados.
- [x] CSP em Report-Only (ajustar allowlist antes de enforce).
- [x] `Cache-Control: no-store` nas rotas sensíveis.
- [ ] Definir endpoint de report CSP (se for recolher violações).

### Fase 3 — WAF + rate limiting (1–2 dias)
- [ ] Ativar WAF na borda (Cloudflare WAF/Bot Management ou equivalente).
- [ ] Rate limiting por IP/ASN para `/admin`, `/api`, `/login`.
- [ ] Allowlist temporária para IPs do Pentester com expiração:
  - 35.227.51.223
  - 34.75.85.132
- [ ] Logs e alertas básicos (picos de bloqueios, brute force).

### Fase 4 — Admin hardening (1–3 dias)
- [ ] 2FA/SSO (se aplicável).
- [ ] IP allowlist opcional para staff.
- [ ] Revisão de permissões e auditoria.
- [ ] Proteção adicional contra brute force e enumeração.

## Critérios de aceitação
- Novo scan do Pentester sem findings nos tópicos acima (ou justificados/documentados).
- Headers presentes e com valores corretos.
- `/.well-known/security.txt` acessível.
- Certificados com renovação automática.
- WAF ativo e logs a funcionar.
- Admin protegido (nada exposto sem auth).

## Notas
- HSTS com `preload` apenas após confirmação (implicações de longo prazo).
- CSP deve passar por fase de observação antes de enforcement.
- Rotas sensíveis não devem ser expostas via robots; proteção real é via auth + regras de rede.
