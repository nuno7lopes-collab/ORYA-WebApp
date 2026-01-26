# Release checklist (19.6 gates)

Objetivo: checklist executavel para release (DoD de producao).

## Ordem de execucao (obrigatoria)
1) Gates offline (sem DB):
   - `npm run db:gates:offline`
2) Suites de testes (vitest):
   - `npx vitest run tests/finance tests/fiscal tests/outbox tests/ops tests/notifications tests/analytics`
3) Gates online (com DB):
   - `npm run db:gates`

## Pass/Fail (criterios)
- PASS:
  - Todos os comandos acima terminam com exit code 0.
  - Nenhum teste falha.
  - Guardrails/rg em `db:gates` passam sem drift.
- FAIL:
  - Qualquer comando falha ou termina com exit code != 0.
  - Qualquer suite tem testes a falhar.
  - Qualquer guardrail acusa drift.

## Como correr em local
- Requisitos:
  - `.env.local` com credenciais necessarias.
  - DB acessivel para `npm run db:gates` (online).
- Execucao:
  - Correr a ordem acima no terminal.

## Como correr em CI
- Requisitos:
  - Variables de ambiente definidas no CI (DB e segredos necessarios).
  - Etapas separadas para gates offline, vitest suites e gates online.
- Exemplo de sequencia:
  1) `npm run db:gates:offline`
  2) `npx vitest run tests/finance tests/fiscal tests/outbox tests/ops tests/notifications tests/analytics`
  3) `npm run db:gates`

## Notas
- Se `db:gates` falhar por infra/DB indisponivel, bloquear release ate resolver.
- Qualquer nova suite critica deve ser adicionada a este checklist.
