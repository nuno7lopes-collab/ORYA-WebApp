# App Store Readiness + Submission Runbook

Atualizado: 2026-02-02

## Estado atual (infra/plataforma)
- [x] Apple Developer readiness concluído para F1 (sem mudanças de infraestrutura pendentes).
- [x] Universal links e Apple domain association publicados em `.well-known`.
- [x] Segredos Apple (Sign-In/APNS/Apple Pay) centralizados em AWS Secrets Manager.
- [x] Envs Apple documentadas em `docs/envs_required.md`.

Evidências:
- `reports/p_infra_2026-01-30.md`
- `docs/envs_required.md`

## Passos de submissão (executar em cada release mobile)
Estes passos são operacionais por release e não representam backlog de infraestrutura.

1. Build e signing
   - Confirmar `version` e `build number`.
   - Confirmar bundle identifier de produção.
   - Validar certificados/profiles de distribuição.
2. Metadados App Store
   - Atualizar descrição, screenshots e notas de versão.
   - Confirmar ícones finais.
3. Compliance e review
   - Validar privacy answers e disclosures de pagamentos.
   - Preparar notas para review e conta de teste (se necessário).
4. QA final
   - Smoke iOS: login, onboarding, checkout sandbox, push/deep links.
5. Publicação
   - Criar submissão no App Store Connect.
   - Escolher release manual/automática.
   - Confirmar rollback plan.

## Resultado
- Blueprint F1 permanece fechado.
- Itens acima são checklist de execução contínua por release (D-day), não tarefas pendentes de implementação.
