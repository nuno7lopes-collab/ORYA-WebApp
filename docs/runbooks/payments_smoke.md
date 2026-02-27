# Payments Smoke (Hold + Checkout + Webhooks)

## Objetivo
Validar o contrato de hold de checkout (5 minutos), proteção de double-checkout e idempotência de replay de webhook.

## Gates obrigatórios
1. Aplicar migrations pendentes (inclui `20260226190000_reservation_holds_audit` e `20260228001000_inventory_holds_audit`):
```bash
npm run db:deploy
```
2. Correr gates:
```bash
npm run db:gates
npm run typecheck
npm run test
```

## Smoke local (double-checkout)
1. Criar a mesma pré-reserva/slot em 2 sessões diferentes.
2. Na sessão A, iniciar checkout para criar hold.
3. Na sessão B, tentar iniciar checkout para o mesmo slot.
4. Esperado: sessão B recebe `SLOT_NOT_AVAILABLE`.

## Smoke local (leave-and-return)
1. Iniciar checkout e confirmar hold criado.
2. Sair da página de checkout e voltar antes do TTL.
3. Esperado: CTA de retoma + countdown ativo.
4. Esperado após expirar TTL: mensagem `O seu bloqueio expirou - o slot já não está reservado.`

## Smoke local (webhook replay)
1. Processar um `stripe event.id` válido.
2. Reenviar o mesmo `event.id`.
3. Esperado: ACK em ambos; segundo processamento deduplica sem efeitos duplicados.

## Rollback rápido (PR3/PR4/PR5)
1. Desativar contrato novo por feature flag:
```bash
FEATURE_PLATFORM_HOLD_CONTRACT=false
```
2. Reverter rotas de hold e validação de checkout para o fluxo legado.
3. Manter migration `reservation_holds` aplicada (é aditiva e não quebra o legado).
4. Reexecutar gates:
```bash
npm run db:gates
npm run typecheck
npm run test
```
