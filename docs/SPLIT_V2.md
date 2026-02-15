# SPLIT_V2

## 1) Objetivo
- Permitir pagamento dividido com proteção financeira forte para a organização.
- O `responsável do split` (payer of last resort) é a garantia final do valor em falta.
- Modelo técnico canónico: `hold válido (FULL_AUTH_TOTAL) + captura dentro de capture_before`.
- Não existe garantia absoluta do emissor; existe operação robusta com fallback para dívida e bloqueio.

## 2) Nome canónico do modo
- Nome único: `SPLIT_GARANTIDO`.
- Implementação obrigatória do modo: via `FULL_AUTH_TOTAL` (autorização manual/hold no cartão do responsável do split).

## 2.1) Terminologia transversal
- `entidade-alvo`: objeto que está a ser pago em split (ex.: reserva, inscrição de torneio, vaga de aula, bilhete/evento).
- `targetType`: tipo da entidade-alvo.
- `targetId`: id da entidade-alvo.
- `targetEndAt`: fim temporal da entidade-alvo para cálculo do prazo operacional.
- `responsável do split`: pessoa que cria o split e garante o valor em falta.

## 3) Princípios (invariantes)
- Cada convidado paga apenas a sua `share`.
- Não é permitido mudar split para pagamento único após criação.
- `totalCents` é snapshot no momento de criação do `SplitBundle` e é SSOT do split.
- `pricing/fees` do split são snapshot na criação e não podem ser recalculados com policy nova durante `SETTLING`, retries ou debt recovery.
- Enquanto `SplitBundleStatus=OPEN`, é proibido qualquer alteração na entidade-alvo que mude `totalCents`.
- Enquanto `SplitBundleStatus=OPEN`, é proibido alterar `targetEndAt`.
- Se for necessário alterar `totalCents` ou `targetEndAt`: cancelar fluxo atual e criar novo split para a entidade-alvo atualizada.

## 4) Total, shares e arredondamento
- Regra obrigatória: `sum(sharesCents) == totalCents`.
- Arredondamento sempre em cêntimos.
- Remainder (se existir) é sempre atribuído à share do responsável do split.

## 5) Janela temporal e cronómetro
- `POST_WINDOW = 2 horas` (default canónico; configurável por policy operacional).
- `SAFETY_BUFFER` configurável por policy operacional.
- Valor canónico para operação robusta: `6 horas` (mínimo recomendado: `2 horas`).
- `REPLACE_HOLD_BUFFER` default canónico: `24 horas` (configurável por policy operacional).
- `targetDeadlineAt = targetEndAt + POST_WINDOW`.
- `deadlineAt = targetDeadlineAt`.
- `deadlineAt` é obrigatório (`NOT NULL`).
- UI mostra um único cronómetro com o `deadlineAt` real.
- `SPLIT_GARANTIDO` só é válido se `captureBefore >= (targetDeadlineAt + SAFETY_BUFFER)`.
- Se a garantia temporal não cobrir o prazo-alvo:
- tentar `replaceHold()` (ou mecanismo equivalente de extensão suportado pelo gateway) antes do fecho;
- se não for possível garantir cobertura, a criação/continuação em `SPLIT_GARANTIDO` deve falhar (não pode manter rótulo garantido).

## 6) Regras de criação
- Pré-requisitos:
- `CardOnFile` válido no responsável do split.
- `FULL_AUTH_TOTAL` criado com sucesso.
- `captureBefore` conhecido e válido.
- `captureBefore` MUST vir de fonte canónica:
- `captureBeforeSource = GATEWAY_EXPLICIT | CANONICAL_COMPUTED_TABLE`.
- Regra de precedência:
- `MUST`: sempre que o gateway expuser `capture_before` (ou equivalente), usar `GATEWAY_EXPLICIT` como fonte de verdade.
- `SHOULD`: usar `CANONICAL_COMPUTED_TABLE` apenas quando o gateway não expuser timestamp explícito.
- Quando usar tabela, `computeCaptureBefore(holdPaymentIntent, gateway)` deve ser versionada por rail, brand e tipo de transação (CIT/MIT quando aplicável), com changelog.
- Falha hard na criação de split se:
- auth falhar,
- `captureBefore` vier `null/unknown`,
- `captureBefore < (targetDeadlineAt + SAFETY_BUFFER)` (garantia não cobre o prazo-alvo do split),
- `captureBefore - SAFETY_BUFFER <= now` (janela impossível).
- Se `captureBefore` for apenas melhor-esforço (sem fonte explícita confiável no gateway), não é permitido manter rótulo `SPLIT_GARANTIDO`.

## 7) Fluxo operacional

### 7.1 Criação
- Criar `SplitBundle` em `OPEN`.
- Calcular shares e validar soma.
- Registar `targetType`, `targetId`, `targetEndAt`, `holdPaymentIntentId`, `holdCreatedAt`, `captureBefore`, `deadlineAt`.

### 7.1.1 Substituição de garantia (replaceHold)
- Operação permitida apenas em `OPEN`: `replaceHold()`.
- Fluxo atómico:
- criar novo `FULL_AUTH_TOTAL` com o mesmo `totalCents`,
- só com sucesso, atualizar SSOT para novo `holdPaymentIntentId`,
- void/release idempotente do hold antigo.
- Guardar histórico de tentativas (`holdAttempt[]`) para auditoria; SSOT aponta sempre para o hold ativo atual.

### 7.1.2 Cobertura contínua da garantia (hold coverage enforcer)
- Enquanto `SplitBundleStatus=OPEN`, o sistema MUST garantir `captureBefore >= (deadlineAt + SAFETY_BUFFER)`.
- Job canónico obrigatório: `split_hold_coverage_enforcer` (idempotente).
- Agendamento canónico:
- `replaceHoldAt = captureBefore - (SAFETY_BUFFER + REPLACE_HOLD_BUFFER)`.
- Em `replaceHoldAt`, tentar `replaceHold()` para renovar cobertura.
- Se o novo hold for criado com sucesso, atualizar SSOT (`holdPaymentIntentId`, `holdCreatedAt`, `captureBefore`) e manter histórico em `holdAttempt[]`.
- Se `replaceHold()` exigir ação e a ação não for concluída antes de perder cobertura, não é permitido manter `SPLIT_GARANTIDO`.
- Perda de cobertura em `OPEN` exige `OPEN -> CANCELLED` com `cancelReason=GUARANTEE_LOST` + refund automático idempotente de `paidShares`.

### 7.2 Pagamento de shares
- Convidados pagam shares enquanto `OPEN` e `now < deadlineAt`.
- Estados de share: `PENDING | PAID | EXPIRED`.
- `SPLIT_GARANTIDO` em V2 usa apenas métodos de confirmação imediata.
- Regra canónica V2: `CARD` para shares de convidados e para responsável do split.
- Rails assíncronos (ex.: transferência) não são permitidos em `SPLIT_GARANTIDO` V2.
- Cada `SplitShare` deve manter `activeShareAttemptId` e histórico imutável `shareAttempt[]` (SSOT financeiro da share via tentativa ativa).
- Regra de verdade de pagamento da share:
- `PAID` apenas quando `Payment.status = SUCCEEDED`.
- `PENDING` inclui `requires_action` não concluído.
- Timeout de ação da share:
- definir `ACTION_WINDOW` operacional e calcular `actionExpireAt = min(now + ACTION_WINDOW, deadlineAt)`.
- se `now > actionExpireAt`, cancelar intent de forma idempotente e manter share em `PENDING` até fecho.
- se `now >= deadlineAt`, share não pode voltar a tentar pagamento; a resolução é feita no `SETTLING`.

### 7.2.1 Tentativas canónicas de share (ShareAttempt)
- `payShare` cria uma nova tentativa (`ShareAttempt`) com `shareAttemptIndex` monotónico por share (inicia em 1).
- Campos mínimos obrigatórios por tentativa:
- `shareAttemptId`
- `shareAttemptIndex`
- `splitShareId`
- `createdAt`
- `paymentId`
- `paymentIntentId`
- `status`
- `failureClass`
- `actionExpireAt` (quando aplicável)
- Só pode existir uma tentativa ativa (`OPEN` ou `REQUIRES_ACTION`) por `SplitShare`.
- Nova tentativa só pode ser aberta quando a anterior estiver terminal (`FAILED` ou `CANCELLED`), mantendo histórico auditável.
- Se uma tentativa chegar a `SUCCEEDED`, a `SplitShare` transita para `PAID`.
- No `SETTLING`, qualquer tentativa não terminal deve ser cancelada idempotentemente.

### 7.3 Early settle
- Se `paidShares == totalCents` antes do deadline:
- transita imediatamente para `SETTLED`,
- executar `void/release` total do hold (não capturar no hold).
- Se provider atrasar release, usar `holdReleaseStatus=PENDING` + retry técnico sem mudar `SETTLED`.

### 7.4 Fecho no deadline
- Em `now >= deadlineAt`, transitar para `SETTLING`.
- Em `SETTLING`:
- lock transacional do `SplitBundle`,
- antes do snapshot, reconciliar em tempo real no gateway o estado de toda `ShareAttempt` não terminal (`OPEN|REQUIRES_ACTION`) via fetch direto do provider,
- `paymentConfirmedAt` MUST ser lido do timestamp canónico do gateway retornado no fetch (nunca do tempo de chegada do webhook),
- só após reconciliação calcular `paidShares`, expirar shares e calcular `outstanding`,
- criar `SettlementSnapshot` imutável,
- bloquear/cancelar pendentes de convidados.
- qualquer share com pagamento confirmado no gateway com `paymentConfirmedAt <= settlingAt` MUST entrar no `paidShares` do snapshot, mesmo se o webhook chegar depois,
- no instante do `SettlementSnapshot`, toda share que não esteja `PAID` transita para `EXPIRED`.
- qualquer intent pendente de share expirada deve ser cancelado idempotentemente.
- regra contabilística obrigatória: todo `PendingPayment` em `OPEN` transita imediatamente para `CANCELLED_BY_SETTLEMENT` no instante do snapshot.
- `chargeRail` obrigatório e monotónico:
- `HOLD_CAPTURE -> OFFSESSION_PI -> DEBT` (nunca regressa para rail anterior).
- Calcular `outstanding = totalCents - paidShares`.
- Se `outstanding == 0`: `SETTLED`.
- Se `outstanding > 0`: capturar `outstanding` no hold do responsável do split.
- semântica obrigatória de captura: a cobrança do responsável do split usa captura parcial do hold pelo `outstanding` do snapshot.
- fallback canónico no `SETTLING`:
- se a captura falhar com erro não recuperável de capture (ex.: `charge_expired_for_capture`, `capture_charge_authorization_expired`, `capture_unauthorized_payment`),
- criar `PendingPayment` com amount fixo do snapshot e tentar `PaymentIntent` off-session imediato no `CardOnFile` do responsável do split.
- o recovery posterior reutiliza a janela de retries já definida (7 dias), agora sobre o `PendingPayment`/`PaymentIntent`.
- se o `PaymentIntent` de fallback voltar `requires_action`, marcar `failureClass=AUTH_REQUIRED`, manter `CHARGE_FAILED`, definir `authExpireAt = min(now + 24h, retryUntilAt)` e notificar responsável do split para completar em sessão.
- se `authExpireAt` expirar sem resolução, continuar fluxo de retries do rail ativo; se esgotar janela, abrir `Debt`.
- após `SETTLED`, qualquer remanescente do hold deve ser libertado/void de forma idempotente.
- Sucesso: `SETTLED`.
- Falha: `CHARGE_FAILED`.

## 8) Corridas e pagamentos tardios
- Pagamentos de convidado confirmados após `settlingAt` não contam para o split.
- Regra obrigatória: pagamento tardio confirmado após settle é reembolsado automaticamente ao convidado.
- Estado interno deve ficar inequívoco e auditável (`late=true` + `refundId`, ou equivalente).
- Regra formal de liquidação tardia:
- `paymentConfirmedAt` deve usar timestamp canónico do gateway/provedor (não timestamp de chegada de webhook no servidor).
- se `paymentConfirmedAt > settlingAt`, o sistema cria refund automático idempotente,
- o split não recalcula `outstanding` após `SettlementSnapshot`,
- o evento fica registado com referência ao `pendingPaymentId` e `refundId`.

## 9) SettlementSnapshot (imutável)
Campos mínimos obrigatórios:
- `snapshotId`
- `splitBundleId`
- `targetType`
- `targetId`
- `computedAt`
- `deadlineAt`
- `settlingAt`
- `totalCents`
- `paidShareIds[]` e soma
- `outstandingCents`
- `currency`
- `hash/etag` (opcional recomendado)

Campos financeiros obrigatórios (consistência de fees):
- `feePolicyVersionApplied`
- `feeModeApplied`
- `platformFeeCentsTotal`
- `sharesFeeBreakdown[]` (por share: `baseShareCents`, `grossShareCents`, `platformFeeCents`)
- `orgId` e `destinationAccountRef` (quando aplicável)
- `payoutModeApplied`
- `captureBeforeSource`

Regra obrigatória:
- qualquer cobrança do responsável do split (capture/fallback/retry) usa o amount e o fee breakdown do `SettlementSnapshot`.
- não é permitido recalcular fees com configuração nova da organização após `settlingAt`.

## 9.1 Fees e Stripe Connect (canónico)
- O split mantém o mesmo contrato financeiro da ORYA:
- fee da plataforma e fee policy seguem snapshot canónico,
- processor fees seguem reconciliação normal (`PENDING -> FINAL`) sem alterar SSOT do split.
- definições matemáticas canónicas:
- `grossShareCents` = valor cobrado ao convidado naquela share.
- `platformFeeCents` = cálculo da fee da plataforma para a share pela `feePolicyVersionApplied`.
- `baseShareCents` = `grossShareCents - platformFeeCents`.
- `sum(grossShareCents)` de todas as shares = `totalCents`.
- `platformFeeCentsTotal = sum(platformFeeCents)` de todas as shares.
- regra de arredondamento de fee por share:
- `sum(platformFeeCents por share) == platformFeeCentsTotal`.
- qualquer remainder de fee por arredondamento é atribuído de forma determinística à share do responsável do split.
- em `feeMode INCLUDED`, o preço final para cliente mantém o total do split; a distribuição interna de base/fee segue snapshot e regras de arredondamento.
- Em `SPLIT_GARANTIDO`, `capture` e fallback `PaymentIntent` do responsável do split devem manter o mesmo contexto financeiro:
- `orgId` de origem,
- destino Connect da organização (quando aplicável),
- política de fee aplicada no snapshot.
- regra canónica de owner financeiro (MoR/charge owner), sempre por snapshot:
- se `payoutModeApplied = ORGANIZATION` (EXTERNAL), intents de share, hold, fallback e refunds são criados pela plataforma usando `transfer_data.destination = destinationAccountRef` (Destination Charges + Application Fee).
- se `payoutModeApplied = PLATFORM`, intents de share, hold, fallback e refunds são criados no contexto financeiro da plataforma.
- Refunds (cancelamento, late payment, ajustes pós-fecho) devem criar movimentos de ledger com reversão proporcional de fees conforme snapshot e política de refund.

## 10) Cancelamento
- `CANCELLED` só é permitido quando `SplitBundleStatus=OPEN`.
- Ao cancelar:
- `void/release` do hold ativo,
- refund automático idempotente de todas as `paidShares`,
- transição terminal para `CANCELLED`.
- Taxas/no-show/cobranças novas após cancelamento são fluxo separado, fora deste bundle.

## 10.1) RefundPlan canónico (determinístico)
- Refunds são sempre calculados por pagador real (`paymentId`) com base no `SettlementSnapshot`.
- Regra de distribuição: refund pró-rata por `gross` efetivamente pago por cada pagador (shares + responsável do split).
- Reversão de fees segue snapshot e policy de refund (sem recalcular policy nova).
- Execução Stripe Connect (quando aplicável):
- usar `reverse_transfer=true` para evitar a plataforma absorver refund indevido.
- usar `refund_application_fee=true` quando a política exigir devolução proporcional da fee da plataforma.

## 10.2) CancelReason canónico
- `USER_REQUESTED`
- `TARGET_UPDATED` (alteração de `totalCents` ou `targetEndAt` durante `OPEN`)
- `GUARANTEE_LOST` (cobertura do hold deixou de garantir `deadlineAt + SAFETY_BUFFER`)

## 11) Proibição de pagamentos manuais no split
- `SPLIT_V2` não suporta pagamentos manuais em nenhum estado.
- Não existe marcação manual de share para efeito de liquidação.
- Qualquer regularização financeira do split é feita apenas por pagamentos online e refunds online.
- Ocupações não financeiras continuam fora deste contrato (ex.: bloqueios operacionais), sem impacto em pagamentos do split.

## 12) Retries, dívida e bloqueio
- Em `CHARGE_FAILED`, tentar retries técnicos com idempotência forte.
- `retryUntilAt` canónico do rail `OFFSESSION_PI`: `settlingAt + 7d`.
- Janela de retries por rail:
- rail `capture` (hold): `now < captureBefore`.
- rail `PaymentIntent` fallback (off-session): `now < retryUntilAt`.
- Política de retries compatível com janela curta:
- primeiras tentativas com backoff rápido (minutos/horas),
- depois espaçamento maior (diário),
- sempre respeitando o limite do rail ativo.
- Bloqueio preventivo de risco:
- no primeiro `CHARGE_FAILED`, aplicar `blocksBooking=true` para a `customerIdentity`.
- se recuperar em retry (estado volta para `SETTLED`), remover bloqueio.
- Se esgotar janela sem sucesso:
- criar `Debt(status=OPEN)`,
- transitar split para `DEBT_OPEN`,
- bloquear novas transações elegíveis da identidade.
- Bloqueio aplica por `customerIdentityId` (não só `userId`).
- Resolução de dívida:
- `Debt.status = OPEN | PAID | WAIVED`,
- desbloqueia quando `status != OPEN`,
- `PAID` liga sempre a `paymentId` e ledger (com mesma política de fees do snapshot original),
- `WAIVED` só por staff autorizado com auditoria.

## 12.1) Catálogo canónico de falhas por rail
- `CAPTURE_UNRECOVERABLE`: `charge_expired_for_capture`, `capture_charge_authorization_expired`, `capture_unauthorized_payment`.
- `CAPTURE_RECOVERABLE`: `processor_error`, `network_error`, `rate_limit`.
- `OFFSESSION_AUTH_REQUIRED`: `requires_action` (SCA/3DS).
- `OFFSESSION_RECOVERABLE`: `insufficient_funds`, `processor_error`.
- `OFFSESSION_UNRECOVERABLE`: `invalid_payment_method`, `payment_method_not_available`.
- Regras:
- `CAPTURE_UNRECOVERABLE` migra rail para `OFFSESSION_PI` (sem voltar para capture).
- `CAPTURE_RECOVERABLE` pode retry apenas até `captureBefore`.
- `OFFSESSION_AUTH_REQUIRED` abre janela de ação do responsável do split até `authExpireAt`.
- `OFFSESSION_UNRECOVERABLE` exige atualizar `CardOnFile`; sem sucesso dentro da janela, `Debt`.

## 12.2) Eventos de risco pós-liquidação (disputes/chargebacks)
- Após `SETTLED`, eventos `DISPUTED/CHARGEBACK_*` de qualquer `paymentId` associado ao split seguem fluxo canónico:
- abrir `Debt` contra `payerIdentityId` original da transação disputada.
- bloquear novas transações elegíveis da identidade em dívida até regularização.
- se não regularizar até `POST_SETTLEMENT_RECOVERY_DAYS` (default `7d`), escalar para cobrança ao responsável do split como garante final:
- criar `PendingPayment` de `post-settlement recovery` com referência ao snapshot original.
- em `Destination Charges + Application Fee`, o impacto financeiro primário de chargeback/refund/dispute pode recair na plataforma; para manter proteção da organização:
- tentar `transfer reversal` quando policy permitir e quando aplicável.
- quando reversal não for aplicável/suficiente, a diferença é coberta por `risk reserve` da plataforma e recuperada via `Debt`/`post-settlement recovery`.
- Em qualquer recuperação pós-settlement, manter reversões de fees e ledger em modo append-only.

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
- `EXPIRED`

Regra canónica:
- `EXPIRED` é terminal.

> `CLOSED` não existe neste contrato para evitar ambiguidade.

### ShareAttemptStatus (sistema)
- `OPEN`
- `REQUIRES_ACTION`
- `SUCCEEDED`
- `FAILED`
- `CANCELLED`

### ShareAttemptFailureClass
- `AUTH_REQUIRED`
- `INSUFFICIENT_FUNDS`
- `PROCESSOR_ERROR`
- `INVALID_PAYMENT_METHOD`
- `UNKNOWN`

### PendingPaymentStatus (sistema)
- `OPEN`
- `SUCCEEDED`
- `FAILED`
- `REQUIRES_ACTION`
- `CANCELLED_BY_SETTLEMENT`
- `PAID_LATE_REFUNDED`

### PendingPaymentFailureClass
- `AUTH_REQUIRED`
- `INSUFFICIENT_FUNDS`
- `PROCESSOR_ERROR`
- `CAPTURE_EXPIRED`
- `CAPTURE_NOT_ALLOWED`
- `UNKNOWN`

### ChargeRail (canónico)
- `HOLD_CAPTURE`
- `OFFSESSION_PI`
- `DEBT`

## 14) Transições permitidas (máquina de estados)

### SplitBundle
- `OPEN -> SETTLED` (early settle)
- `OPEN -> SETTLING` (deadline/guard)
- `OPEN -> CANCELLED` (cancelamento antes do fecho)
- `SETTLING -> SETTLED` (sem outstanding ou cobrança do responsável com sucesso)
- `SETTLING -> CHARGE_FAILED` (falha de cobrança do responsável)
- `CHARGE_FAILED -> SETTLED` (retry com sucesso)
- `CHARGE_FAILED -> DEBT_OPEN` (janela de recuperação esgotada)

### SplitShare
- `PENDING -> PAID` (payment succeeded)
- `PENDING -> EXPIRED` (deadline snapshot)

### ShareAttempt
- `OPEN -> REQUIRES_ACTION`
- `OPEN -> SUCCEEDED`
- `OPEN -> FAILED`
- `REQUIRES_ACTION -> SUCCEEDED`
- `REQUIRES_ACTION -> FAILED`
- `REQUIRES_ACTION -> CANCELLED` (timeout/settlement)

### Transições proibidas (exemplos normativos)
- `SETTLING -> CANCELLED`
- `SETTLED -> *`
- `DEBT_OPEN -> *` (o split não reabre; resolução é no objeto Debt)

## 15) Idempotência canónica
- `openSplit`: `target:{targetType}:{targetId}:split:open`
- `payShare`: `splitShare:{splitShareId}:attempt:{shareAttemptIndex}` (`shareAttemptIndex` monotónico por share, inicia em 1)
- `settle`: `split:{splitBundleId}:settle:{snapshotId}`
- `captureOutstanding`: por `pendingPaymentId` (amount fixo do snapshot)
- `retryCharge`: `split:{splitBundleId}:retry:{attemptIndex}` (`attemptIndex` inicia em 1)
- `refundLateGuest`: `pendingPayment:{pendingPaymentId}:refund_late`
- `cancelSplit`: `split:{splitBundleId}:cancel`

Regra obrigatória:
- qualquer tentativa financeira (`capture`, `paymentIntent`, `retry`, `refund`) usa sempre o amount do `SettlementSnapshot` (imutável).

## 15.1) Metadata canónica para tracing fim-a-fim
- Todos os `PaymentIntent/Charge` ligados ao split (share, hold do responsável, fallback do responsável, post-settlement recovery, refunds) devem carregar metadata mínima:
- `paymentId`
- `splitBundleId`
- `shareId` (quando aplicável)
- `shareAttemptId` (quando aplicável)
- `orgId`
- `targetType`
- `targetId`
- É proibido emitir pagamento sem esta metadata canónica no contexto de split.

## 16) Jobs obrigatórios
- `split_timer_tick`
- `split_hold_coverage_enforcer` (idempotente): garantir cobertura contínua `captureBefore >= deadlineAt + SAFETY_BUFFER`; tentar `replaceHold()` em `replaceHoldAt`
- `split_settle_guard` (idempotente): tentativa de `settle()` em `deadlineAt-2h` (e opcional `deadlineAt-6h` quando `SAFETY_BUFFER>=6h`)
- `split_settle_deadline`
- `split_retry_failed_charges_scheduler`
- `split_debt_enforcer`
- `split_hold_release_retry` (técnico)
- `split_auth_required_timeout_enforcer`
- `split_share_action_timeout`
- `split_post_settlement_risk_enforcer`

Regra do guard:
- o guard não cria contrato paralelo nem recalcula valores; chama o mesmo `settle()` canónico com lock + snapshot.

## 17) Mensagens de produto (PT)
- “Divida a conta sem stress. Fazemos uma autorização temporária no cartão do responsável do split para proteger o pagamento e só debitamos o valor que ficar em falta.”
- “O prazo mostrado no cronómetro é o prazo real do split.”
- “Depois do fecho, ajustes são feitos por reembolso.”

## 18) Transparência para organizações
- O split pode ser criado com antecedência.
- A janela efetiva é sempre limitada por regras reais do emissor (`captureBefore`).
- Se `captureBefore` não cobrir `targetDeadlineAt + SAFETY_BUFFER`, o split não pode manter rótulo `SPLIT_GARANTIDO`.
- A organização vê sempre o estado de risco/fecho no painel operacional.

## 19) Observabilidade operacional (meta de fecho automático alto)
- Métricas obrigatórias por bucket de falha:
- `CAPTURE_EXPIRED`
- `CAPTURE_NOT_ALLOWED`
- `PROCESSOR_ERROR`
- `INSUFFICIENT_FUNDS`
- `AUTH_REQUIRED`
- `UNKNOWN`
- Dashboard mínimo:
- `split_settled_rate`
- `split_charge_failed_recovered_rate`
- `split_debt_open_rate`
- `split_late_refund_count`
- `split_fee_drift_count` (deve ser 0)
- `split_share_requires_action_timeout_count`
- `split_post_settlement_dispute_count`
- `split_post_settlement_recovery_rate`
- Alarmes SLO obrigatórios (runbook operacional):
- `settle_job_missed_deadlineAt`
- `capture_attempt_after_captureBefore` (deve ser 0)
- `late_refund_failed`
- `fee_drift_detected`
- `debt_open_rate_spike`

## 20) Estado final do contrato
- Este `SPLIT_V2` é a versão final canónica para pagamentos split da ORYA.
- Cobre criação, cobrança, fecho, fallback, retries, dívida, cancelamento, refunds, fees e observabilidade do domínio de split em entidades transacionais (ex.: reservas, inscrições e eventos).
- Qualquer evolução futura deve preservar estes invariantes ou abrir nova revisão normativa explícita.
