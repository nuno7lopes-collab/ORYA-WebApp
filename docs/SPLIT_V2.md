# SPLIT_V2

## 1) Objetivo
- Permitir pagamento dividido com proteção financeira forte para a organização.
- O `captain/booker` é a garantia final do valor em falta.
- Modelo técnico canónico: `hold válido (FULL_AUTH_TOTAL) + captura dentro de capture_before`.
- Não existe garantia absoluta do emissor; existe operação robusta com fallback para dívida e bloqueio.

## 2) Nome canónico do modo
- Nome único: `SPLIT_GARANTIDO`.
- Implementação obrigatória do modo: via `FULL_AUTH_TOTAL` (autorização manual/hold no cartão do captain).

## 3) Princípios (invariantes)
- Cada convidado paga apenas a sua `share`.
- Não é permitido mudar split para pagamento único após criação.
- `totalCents` é snapshot no momento de criação do `SplitBundle` e é SSOT do split.
- Enquanto `SplitBundleStatus=OPEN`, é proibido qualquer alteração no booking que mude `totalCents`.
- Se for necessário alterar total: cancelar fluxo atual e criar novo booking/split.

## 4) Total, shares e arredondamento
- Regra obrigatória: `sum(sharesCents) == totalCents`.
- Arredondamento sempre em cêntimos.
- Remainder (se existir) é sempre atribuído à share do captain.

## 5) Janela temporal e cronómetro
- `BASE_WINDOW = 4 dias`.
- `SAFETY_BUFFER = 30 minutos` (default).
- `deadlineAt = min(holdCreatedAt + 4d, captureBefore - SAFETY_BUFFER)`.
- `deadlineAt` é obrigatório (`NOT NULL`).
- UI mostra um único cronómetro com o `deadlineAt` real.
- Se `captureBefore` reduzir a janela, UI mostra aviso de prazo reduzido.

## 6) Regras de criação
- Pré-requisitos:
- `CardOnFile` válido no captain.
- `FULL_AUTH_TOTAL` criado com sucesso.
- `captureBefore` conhecido e válido.
- Falha hard na criação de split se:
- auth falhar,
- `captureBefore` vier `null/unknown`,
- `captureBefore - SAFETY_BUFFER <= now` (janela impossível).

## 7) Fluxo operacional

### 7.1 Criação
- Criar `SplitBundle` em `OPEN`.
- Calcular shares e validar soma.
- Registar `holdPaymentIntentId`, `holdCreatedAt`, `captureBefore`, `deadlineAt`.

### 7.2 Pagamento de shares
- Convidados pagam shares enquanto `OPEN` e `now < deadlineAt`.
- Estados de share: `PENDING | PAID | WAIVED_OFFLINE_MARKED | EXPIRED`.

### 7.3 Early settle
- Se `paidShares + waivedOffline == totalCents` antes do deadline:
- transita imediatamente para `SETTLED`,
- executar `void/release` total do hold (não capturar no hold).
- Se provider atrasar release, usar `holdReleaseStatus=PENDING` + retry técnico sem mudar `SETTLED`.

### 7.4 Fecho no deadline
- Em `now >= deadlineAt`, transitar para `SETTLING`.
- Em `SETTLING`:
- lock transacional do `SplitBundle`,
- criar `SettlementSnapshot` imutável,
- bloquear/cancelar pendentes de convidados.
- Calcular `outstanding = totalCents - paidShares - waivedOffline`.
- Se `outstanding == 0`: `SETTLED`.
- Se `outstanding > 0`: capturar `outstanding` no hold do captain.
- Sucesso: `SETTLED`.
- Falha: `CHARGE_FAILED`.

## 8) Corridas e pagamentos tardios
- Pagamentos de convidado confirmados após `settlingAt` não contam para o split.
- Regra obrigatória: pagamento tardio confirmado após settle é reembolsado automaticamente ao convidado.
- Estado interno deve ficar inequívoco e auditável (`late=true` + `refundId`, ou equivalente).
- Regra formal de liquidação tardia:
- se `paymentConfirmedAt > settlingAt`, o sistema cria refund automático idempotente,
- o split não recalcula `outstanding` após `SettlementSnapshot`,
- o evento fica registado com referência ao `pendingPaymentId` e `refundId`.

## 9) SettlementSnapshot (imutável)
Campos mínimos obrigatórios:
- `snapshotId`
- `splitBundleId`
- `computedAt`
- `deadlineAt`
- `settlingAt`
- `totalCents`
- `paidShareIds[]` e soma
- `waivedOfflineShareIds[]` e soma
- `outstandingCents`
- `currency`
- `hash/etag` (opcional recomendado)

## 10) Cancelamento
- `CANCELLED` só é permitido quando `SplitBundleStatus=OPEN`.
- Ao cancelar:
- `void/release` do hold ativo,
- refund automático idempotente de todas as `paidShares`,
- transição terminal para `CANCELLED`.
- Taxas/no-show/cobranças novas após cancelamento são fluxo separado, fora deste bundle.

## 11) Waiver offline
- `WAIVED_OFFLINE_MARKED` só permitido em `OPEN` e `now < deadlineAt`.
- Obrigatório guardar:
- `staffUserId`,
- `reasonCode`,
- `createdAt`.
- `evidenceNote` opcional.
- Qualquer ajuste offline após fecho não altera split: é tratado por refund/manual fora do split.

## 12) Retries, dívida e bloqueio
- Em `CHARGE_FAILED`, tentar retries técnicos com idempotência forte.
- Janela de retries: `now < min(settlingAt + 7d, captureBefore)`.
- Se esgotar janela sem sucesso:
- criar `Debt(status=OPEN)`,
- transitar split para `DEBT_OPEN`,
- bloquear novas reservas da identidade.
- Bloqueio aplica por `customerIdentityId` (não só `userId`).
- Resolução de dívida:
- `Debt.status = OPEN | PAID | WAIVED`,
- desbloqueia quando `status != OPEN`,
- `PAID` liga sempre a `paymentId` e ledger,
- `WAIVED` só por staff autorizado com auditoria.

## 13) Estados canónicos

### SplitBundleStatus
- `OPEN`
- `SETTLING`
- `SETTLED` (terminal)
- `CHARGE_FAILED`
- `DEBT_OPEN` (terminal até regularização de dívida)
- `CANCELLED` (terminal)

### SplitShareStatus
- `PENDING`
- `PAID`
- `WAIVED_OFFLINE_MARKED`
- `EXPIRED`

> `CLOSED` não existe neste contrato para evitar ambiguidade.

### PendingPaymentStatus (sistema)
- `OPEN`
- `SUCCEEDED`
- `FAILED`
- `CANCELLED_BY_SETTLEMENT`
- `PAID_LATE_REFUNDED`

## 14) Transições permitidas (máquina de estados)

### SplitBundle
- `OPEN -> SETTLED` (early settle)
- `OPEN -> SETTLING` (deadline/guard)
- `OPEN -> CANCELLED` (cancelamento antes do fecho)
- `SETTLING -> SETTLED` (sem outstanding ou cobrança captain com sucesso)
- `SETTLING -> CHARGE_FAILED` (falha de cobrança captain)
- `CHARGE_FAILED -> SETTLED` (retry com sucesso)
- `CHARGE_FAILED -> DEBT_OPEN` (janela de recuperação esgotada)

### Transições proibidas (exemplos normativos)
- `SETTLING -> CANCELLED`
- `SETTLED -> *`
- `DEBT_OPEN -> *` (o split não reabre; resolução é no objeto Debt)

## 15) Idempotência canónica
- `openSplit`: `booking:{bookingId}:split:open`
- `payShare`: `splitShare:{splitShareId}:pay`
- `settle`: `split:{splitBundleId}:settle:{snapshotId}`
- `captureOutstanding`: por `pendingPaymentId` (amount fixo do snapshot)
- `retryCharge`: `split:{splitBundleId}:retry:{attemptIndex}` (`attemptIndex` inicia em 1)

## 16) Jobs obrigatórios
- `split_timer_tick`
- `split_settle_deadline`
- `split_retry_failed_charges_daily`
- `split_debt_enforcer`
- `split_hold_release_retry` (técnico)

## 17) Mensagens de produto (PT)
- “Divida a conta sem stress. Fazemos uma autorização temporária no cartão do capitão para proteger a reserva e só debitamos o valor que ficar em falta.”
- “O prazo mostrado no cronómetro é o prazo real do split.”
- “Depois do fecho, ajustes são feitos por reembolso.”

## 18) Transparência para organizações
- O split pode ser criado com antecedência.
- A janela efetiva é sempre limitada por regras reais do emissor (`captureBefore`).
- Em casos excecionais a janela pode ser menor do que 4 dias.
- A organização vê sempre o estado de risco/fecho no painel operacional.
