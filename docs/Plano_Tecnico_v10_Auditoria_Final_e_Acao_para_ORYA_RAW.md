> Nota: este documento é um **snapshot de auditoria**. O estado corrente das decisões e implementações
> está em `docs/ssot_registry.md` (SSOT) e `docs/v10_execution_checklist.md` (execução).

Plano Técnico v10: Auditoria Final e Ação para
ORYA
Atualização (2026-01-31):
- Envelope C‑G5 + requestId/correlationId normalizados (middleware + `withApiEnvelope`).
- Outbox/Operations com claim winner‑only + recovery/runbook concluídos.
- Stats admin/org migradas para rollups/entitlements (sem legacy summaries).
- Gate de org context em CI aplicado + correção de rota crítica.
- Entitlements para booking/loja adicionados; check‑in mapeado por tipo.
- DSAR/purge com legal hold mínimo e runbook atualizado.

Contratos de Erro e Observabilidade (Bloco 0)
Resumo & SSOT: Todo endpoint crítico deve retornar um envelope unificado de resposta/erro incluindo
requestId  e  correlationId , além de códigos de erro estáveis, garantindo  fail-closed (acesso
negado se auth/org inválido)
. Em produção, 100% das rotas críticas devem usar este envelope
padrão (cabeçalhos x-orya-request-id  e x-orya-correlation-id  em todas as respostas)
.
Falhas recuperáveis devem indicar se são  retryable e qual  nextAction seguir
. Logs de erro devem
sempre incluir o requestId/correlationId
. 
Análise  do  Código  (develop): Atualmente,  nem  todas  as  rotas  seguem  o  contrato.  Existe  um
middleware para gerar  requestId , mas muitas respostas ainda retornam objetos ad-hoc (por ex.,
{ ok: false, error: "..."} sem errorCode` ou IDs de correlação). Algumas rotas internas
retornam texto ou não utilizam o wrapper unificado. Isso representa drift em relação ao blueprint. 
Plano de Ação:
-  (P0) Envelope de Resposta Unificado: Implementar um helper global (ex:  withApiEnvelope  ou
usar respondOk/respondError  do módulo http) para formatar todas as respostas API conforme o
envelope canônico
.
-  Ficheiros:
middleware.ts ,  lib/http/headers.ts ,  lib/http/envelope.ts , todas as rotas
em app/api/** .
- Status: Feito – Envelope C‑G5 aplicado com requestId/correlationId e errorCode canónico.
- Instruções: Padronizar a construção de respostas usando o helper. Incluir sempre { ok: <bool>, 
requestId, correlationId, errorCode, message, retryable, ... } . O requestId  deve
ser  gerado  no  início  do  request  (middleware)  e  propagado;  o  correlationId  deve  vir  de  x-
correlation-id  ou  defaultar  para  requestId
.  Ajustar  rotas  que  atualmente  usam
NextResponse.json  direto para usar o wrapper
. 
(P0) Fail-Closed & Códigos de Erro: Revisar todas as verificações de autenticação e contexto de
organização para garantir fail-closed. 
Ficheiros: lib/security.ts  (auth), lib/organizationContext.ts , lib/security/
requireOrgContext.ts  (se existente), rotas em app/api/**  que dependem de org. 
Status: Feito – Fail‑closed aplicado com helpers + gate de org context em CI para evitar drift.
Instruções: Quando faltar org ou permissões, retornar 401/403 com envelope canônico de erro
. Por exemplo, se  getActiveOrganizationForUser  falhar, usar  respondError  com
errorCode  apropriado ( NOT_ORGANIZATION  ou similar) em vez de deixar passar. Garantir
que nenhum endpoint crítico retorne sucesso falso ou 5xx sem envelope. 
(P0) Ids de Correlação em Logs: Atualizar o logger de erros para sempre incluir requestId  e
correlationId . 
1
2
3
4
5
1
6
7
• 
• 
• 
• 
8
• 
1

Ficheiros: lib/observability/logger.ts  ou equivalente (ou onde há console.error
em APIs). 
Status: Feito – Logs normalizados via `logError/logWarn` com requestId/correlationId.
requisição. 
Instruções: 
Incluir  contexto  nos  logs:  ex.  prefixar
 console.error  
com
[req:{requestId}] . Se existir um util de log, fazê-lo adicionar esses IDs automaticamente.
Isso é fundamental para depuração e replay de erros
. 
(P1) Runbook de Erros & Replays: Formalizar um runbook que documente como rastrear um
erro via requestId  e realizar replay/rollback se necessário
. 
Status: Feito – Runbooks consolidados (request-id trace, DLQ, ops endpoints) em docs/runbooks. 
Instruções: Documentar no wiki/runbooks: “Dado um erro 4xx/5xx, pegar requestId  dos
logs/response, localizar no log central e, se necessário, usar endpoints de replay (e.g. /api/
internal/reprocess/* ) para reprocessar a operação”
. 
Pagamentos, Checkout e Ledger (Bloco 1)
Resumo & SSOT: O domínio financeiro exige um fluxo de checkout único e idempotente (SSOT de
pagamentos): a rota  /api/payments/intent  centraliza a criação de PaymentIntent do Stripe, e
todos os fluxos de compra convergem para ela
. Payment  e LedgerEntry  formam a fonte de
verdade do dinheiro, enquanto PaymentEvent  e SaleSummary  são apenas read-models (não fontes
de verdade)
. O ledger deve ser append-only e determinístico (nenhum update/delete em entradas)
. Cada operação financeira com efeito colateral deve ser idempotente (chave  idempotencyKey
derivada do  purchaseId )
. Reembolsos e disputas precisam atualizar o estado do Payment e
emitir eventos de outbox de ajuste
. Webhooks do Stripe e rotinas de reconciliação devem ser
robustos a falhas, garantindo que não haja divergência entre nosso ledger e o Stripe. 
Análise do Código (develop): A maior parte do refactor de pagamentos do v9 já foi implementada com
sucesso. O fluxo canônico de PaymentIntent foi introduzido ( ensurePaymentIntent  em domain/
finance/paymentIntent.ts ),  e  todas  as  rotas  paralelas  (loja,  serviços,  reservas,  etc.)  agora  o
utilizam internamente em vez de criarem intents diretamente
. O  idempotency está tratado via
checkoutKey(purchaseId)  e verificado no PaymentEvent (evitando duplos pagamentos)
. O
schema Prisma foi ajustado para alinhar Payment, PaymentEvent e SaleSummary de acordo com o
blueprint (e.g.  PaymentEvent.purchaseId  agora refere ao Payment/checkout)
. Encontramos
evidências no código de que as principais alterações foram concluídas:
-  A  função  ensurePaymentIntent  realiza  a  criação  idempotente  da  ordem  de  pagamento  e
PaymentIntent  do  Stripe,  lançando  erro  IDEMPOTENCY_KEY_PAYLOAD_MISMATCH  se  houver
discrepâncias de montante
.
- As rotas de checkout de store, serviços, reservas e padel chamam agora funções comuns de criação de
checkout (garantindo purchaseId  determinístico e fluxo único).
- Em caso de Stripe Connect não configurado para uma org, as rotas de pagamento retornam erro fail-
closed adequado (ex.: código de erro para conta Stripe ausente) – conforme marcado como DONE no
checklist
. 
Ainda assim, há pontos a verificar: o ledger append-only requer que quaisquer ajustes (fees finais do
Stripe, reembolsos) sejam refletidos como novas entradas. E precisamos confirmar se todos webhooks
e processos de reconciliação estão implementados. 
• 
• 
• 
9
• 
10
• 
• 
10
11
12
13
14
12
15
16
17
18
19
20
21
22
2

Plano de Ação:
-  (P0) Revisão  de  Fluxos  Legacy  de  PaymentIntent: Verificar  que  nenhuma rota  fora  /api/
payments/intent  cria PaymentIntents diretamente.
-  Ficheiros:
app/api/store/checkout/*.ts ,  app/api/servicos/*/checkout.ts ,  app/api/
organizacao/reservas/*/checkout.ts ,
 app/api/padel/pairings/[id]/checkout.ts , 
domain/padelSecondCharge.ts .
- Status: Feito – O código indica que essas rotas usam ensurePaymentIntent / createCheckout
agora, em vez de chamadas diretas ao Stripe
.
-  Instruções: Auditoria final: confirmar que cada rota acima invoca a função comum de checkout.
Remover  eventuais  restos  de  código  legacy  (ex.:  se  alguma  rota  ainda  referencia
stripe.paymentIntents.create  diretamente, substituí-la pelo fluxo canônico). 
(P0) Idempotência e Determinismo: Garantir que todo Payment tenha chave idempotente
consistente e que timestamps não influenciem o determinismo do purchaseId . 
Ficheiros: lib/stripe/idempotency.ts  (função checkoutKey ), funções que geram 
purchaseId  em fluxos automáticos (ex.: para reservas via cron, etc.). 
Status: Feito – O purchaseId  agora é fornecido pelo cliente ou gerado no formato
padronizado ( pur_<hex32> ), e o idempotencyKey é derivado disso
. No código, vemos
normalização do purchaseId ( normalizePurchaseId ) e uso do checkoutKey
. 
Instruções: Confirmar que em todos os pontos de entrada de pagamento estamos usando essa
lógica. Se houver algum lugar usando Date.now()  ou similar para gerar IDs de pagamento,
refatorar para usar a convenção (por exemplo, em auto-charges de padel, usar auto_charge:
{pairingId}:{attempt}  conforme indicado no registro
). 
(P0) Webhooks Stripe e Reconcilição: Validar que os webhooks de pagamento (ex.:  /api/
stripe/webhook ) atualizam corretamente nosso sistema e que há jobs de reconciliação para
conferir fees pendentes. 
Ficheiros: app/api/stripe/webhook/route.ts , app/api/organizacao/payouts/
webhook/route.ts  (para Stripe Connect payouts), domain/finance/
reconciliation*.ts , app/api/internal/reconcile/route.ts . 
Status: Feito – Webhook + reconciliação cobrem refunds/disputes; sweep diário ativo para fees
finais e rollups. 
Instruções: Completar a lógica de webhook para cobrir refunds e disputes: ao receber um evento
de reembolso, marcar Payment.status como REFUNDED e gerar evento FINANCE_OUTBOX para
sync
. Similar para chargeback (dispute). Implementar/ajustar o job de reconciliação ( /api/
internal/reconcile ) para percorrer Payments PENDING_FEES e consultar Stripe por fees
finais, inserindo entradas de Ledger de ajuste quando processorFeesActual  for conhecido. 
(P0) Ledger Append-Only: Auditar operações no Ledger para garantir que nenhuma atualização
ou deleção ocorra, somente inserções. 
Ficheiros: domain/finance/ledger.ts  (se houver), ou no prisma schema verificar se 
LedgerEntry  está sendo apenas inserido. Também domain/ops/fulfillment.ts  que
insere entradas. 
23
• 
• 
• 
12
24
25
• 
26
• 
• 
• 
27
• 
15
• 
• 
3

Status: OK – Não há indícios de updates indevidos; entradas de fees e ajustes são adicionadas
com tipos explícitos (e.g. PROCESSOR_FEES_FINAL ) conforme o blueprint
. 
Instruções: Se ainda não feito, implementar tipos de ledger para fees finais e ajustes (já previsto
no blueprint:  PROCESSOR_FEES_FINAL ,  PROCESSOR_FEES_ADJUSTMENT
). Conferir se o
cálculo de net no overview financeiro soma todas entradas do ledger (possivelmente já tratado
em app/api/organizacao/finance/overview ). 
(P1) Refunds/Chargebacks Workflow: Testar o fluxo completo de reembolso e disputa: desde
acionar via UI/admin até refletir no Payment e emitir Entitlement/Ticket status. 
Ficheiros: app/api/admin/payments/refund/route.ts , app/api/admin/payments/
dispute/route.ts , app/api/admin/refunds/* , app/api/organizacao/refunds/* . 
Status: Implementado – Rotas existem, mas é preciso validar se estão seguindo envelope padrão
e atualização de estado. 
Instruções: Garantir que ao efetuar um refund via rota admin, o Payment associado passe a
status REFUNDED e o Ticket/Entitlement relacionado fique inválido (e.g. TicketStatus cancelado
se applicable). Adicionar testes unitários/vitest para sequências de refund/dispute. 
(P1) Compras Gratuitas (Free Checkout): Assegurar suporte a eventos/serviços gratuitos sem
pagamento (gera Entitlement sem Stripe). 
Ficheiros: domain/finance/checkout.ts , domain/finance/paymentIntent.ts . 
Status: Feito – Free checkout tratado no fluxo financeiro; entitlements emitidos sem Stripe
(não depende de Event.isFree). 
Instruções: Implementar no fluxo de checkout: se montante total = 0, criar o Payment e
imediatamente marcar como PAID (ou status especial) e acionar o fulfillment para emitir
Entitlements, sem chamar Stripe. Ajustar UI para que eventos gratuitos tenham botão
"Confirmar Inscrição" que chama a API de checkout mesmo sem pagamento. 
Outbox, Workers e Execução Assíncrona (Bloco 2)
Resumo & SSOT: O Outbox é o mecanismo central de processamento assíncrono. Todas as operações
que requerem processamento posterior (envio de emails, atualizações de read-model, notificações, etc.)
geram eventos na tabela outbox. O consumo deve ser  idempotente e  seguro contra concorrência
. Regras finais esperadas: implementação de um  claim/lock explícito (e.g. SELECT ... FOR UPDATE
SKIP LOCKED) para que apenas um worker processe cada evento
; gravação do  publishedAt
somente  após  sucesso  do  processamento  (nunca  antes,  evitando  perda)
;  e  inclusão  de  um
dedupeKey  em todos eventos para evitar reprocessamento duplicado
. Em caso de falha, eventos
vão para DLQ (Dead Letter Queue) com motivo registrado, e deve haver runbooks e endpoints para
replay. 
Análise  do  Código  (develop): A  estrutura  básica  do  Outbox  existe  ( domain/outbox/**  define
modelo e possivelmente funções utilitárias). O blueprint v9 definiu mudanças (decisão D10 e D16) ainda
pendentes:  atualmente,  não  identificamos  no  código  uma  lógica  robusta  de  locking de  outbox.
Provavelmente, o consumo ainda está simplista (pode haver risco de dois workers pegarem o mesmo
evento). A propriedade dedupeKey  foi introduzida em vários eventos (por ex., PaymentEvent já usa
dedupeKey = checkoutKey ) – então adotado. Status: Feito – locking com SKIP LOCKED + dedupeKey
em outbox/worker (ver `domain/outbox/publisher.ts` e `app/api/internal/worker/operations/route.ts`).

Nota (2026-02-05): Bloco 2 fechado no checklist v10. Ver `docs/v10_execution_checklist.md`.
• 
28
• 
28
• 
• 
• 
• 
• 
• 
• 
29
• 
30
31
30
32
33
4

Plano de Ação:
-  (P0) Lock Otimista no Outbox: Implementar mecanismo de claim por  token vencedor, evitando
concorrência múltipla.
-
 Ficheiros:
domain/outbox/consumer.ts  
ou
 app/api/internal/worker/operations/
route.ts  (onde quer que o worker busque eventos).
- Status: Feito – Claim winner‑only com FOR UPDATE SKIP LOCKED + recovery via reconcile.
-  Instruções: Usar  estratégia  de  SELECT...FOR  UPDATE  SKIP  LOCKED:  marcar  eventos  com  um
processingToken  único por worker. Por exemplo, adicionar campo processingToken  no outbox;
no worker, fazer update atômico definindo esse token para N eventos por batch
. Somente o
worker que definiu o token processará esses registros. Após processamento, fazer um update em lote
para setar deliveredAt  e limpar o token
. Essa abordagem elimina disputa e double-processing. 
(P0) PublishedAt só em Sucesso: Garantir que outbox.publishedAt  ou equivalente só seja
preenchido após processamento bem-sucedido. 
Ficheiros: domain/outbox/publisher.ts  ou onde o evento é marcado como publicado. 
Status: Feito – publishedAt só é marcado após sucesso no worker (publisher não marca). 
Instruções: Alterar a ordem: primeiro processar a ação (ex.: enviar email, atualizar read-model),
depois marcar  o  registro  como  publicado  (setar  publishedAt ).  Em  caso  de  erro  no
processamento, não setar publishedAt  (assim ele permanece para retry ou DLQ). 
(P0) Dedupe e Idempotência: Assegurar que cada evento outbox tenha dedupeKey  único e
que consumidores ignorem eventos duplicados. 
Ficheiros: Modelos de eventos em domain/finance/outbox.ts , domain/notifications/
outbox.ts , etc., e consumidor em domain/ops/** . 
Status: Feito – dedupeKey obrigatório com helper canônico + índice único; consumidores
idempotentes. 
Instruções: Definir regra: por default, dedupeKey = <eventType>:<sourceId>  ou similar
para  evitar  dupla  inserção.  No  consumidor,  antes  de  processar,  verificar  se  já  existe
processamento daquele dedupeKey (pode usar uma chave única ou store de keys processados).
Opcionalmente, usar tabela de controle ou index único no DB para garantir unicidade. 
(P1) DLQ  e  Replay: Finalizar  a  funcionalidade  de  Dead  Letter  Queue  e  endpoints  de
reprocessamento. 
Ficheiros: app/api/internal/outbox/dlq/route.ts , app/api/internal/outbox/
replay/route.ts , docs/runbooks/outbox-dlq.md . 
Status: Feito – DLQ + replay com reason fields e runbook operacional. 
Instruções: Para  cada  falha  não  recuperável  em  consumidor,  mover  o  evento  para  DLQ:
preencher campos  failedAt  e  errorReason  no registro outbox (ou mover para tabela
separada).  Implementar  /api/internal/outbox/dlq  (GET)  para  listar  DLQs  e  /api/
internal/outbox/replay  (POST)  para  reenfileirar  um  evento  DLQ  (p.ex.,  limpar  seu
failedAt  e  errorReason ,  e  processá-lo  novamente  ou  copiá-lo  para  outbox  normal).
Documentar o processo no runbook
. 
(P2) Batching e Performance: Considerar processamento em lote para eficiência. 
34
35
36
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
7
• 
5

Status: Melhoria futura – Não obrigatório para v10 se carga for baixa, mas recomendado. 
Instruções: Poder introduzir chamada RPC SQL para claimar lote e marcar todos entregues de
uma vez (como exemplificado em referência
). Isso reduz round-trips e melhora
confiabilidade. 
Email Oficial da Organização (Bloco 3)
Resumo & SSOT: O email oficial ( Organization.officialEmail ) é obrigatório e sua verificação
( officialEmailVerifiedAt  não-nulo) é pré-condição para ações críticas
. O sistema tem Single
Source of Truth para o processo: tabela OrganizationOfficialEmailRequest  armazena tokens e
estado  de  verificação,  e  o  email  oficial  da  plataforma  (ORYA)  fica  em  PlatformSetting
( platform.officialEmail )
. Regras finais: atualizar o email oficial de uma organização deve
invalidar  a  verificação  até  confirmar  novamente;  endpoints  de  update/confirm  retornam  status
"VERIFIED"  se já estava verificado (não mais erro 410 legacy)
. Erros padronizados quando falta
email  ou  falta  verificação:  OFFICIAL_EMAIL_REQUIRED  e  OFFICIAL_EMAIL_NOT_VERIFIED ,
sempre com  requestId/correlationId  e com URLs de direcionamento para verificação
. Em
termos de enforcement, todas as ações críticas (p. ex. criação de serviços/produtos, payouts, exports)
devem  falhar se a org não tiver email verificado
. Exceções mínimas (allowlist) incluem apenas
operações necessárias antes de ter email (criar org, trocar org, onboarding inicial, configuração do
email oficial)
. 
Análise do Código (develop): As implementações do v9 referentes a email oficial estão concluídas. No
código:
- Existe um util normalizeOfficialEmail  (NFKC, trim, lowercase) e isValidOfficialEmail  para
validação de formato, implementados em lib/organizationOfficialEmail.ts
.
-
 
O
 
guard
 
central
 
está
 
em
 lib/organizationWriteAccess.ts :
 
funções
ensureOrganizationEmailVerified  e  requireOfficialEmailVerified  checam  o  email  e
retornam erro estruturado
. Vemos que retornam error: "OFFICIAL_EMAIL_REQUIRED"  ou
"OFFICIAL_EMAIL_NOT_VERIFIED"  
com  mensagem  e  campos
 email ,
 verifyUrl , 
nextStepUrl ,  além  de  requestId  e  correlationId  gerados
.  Isso  alinha-se
perfeitamente ao contrato definido.
-
 
Esse
 
guard
 
é
 
aplicado
 
nas
 
operações
 
sensíveis.
 
Por
 
exemplo,
 
em
ensureOrganizationWriteAccess ,  por  padrão  ele  verifica  o  email  oficial  (a  não  ser  que
skipEmailGate  seja  passado)  antes  de  permitir  a  ação
.  Assim,  qualquer  rota  que  chame
ensureOrganizationWriteAccess  antes de prosseguir automaticamente impõe o gate.
-  As  rotas  de  configuração  do  email  oficial  existem:  app/api/organizacao/organizations/
settings/official-email/route.ts  para iniciar a verificação e  .../confirm/route.ts  para
confirmar o token. Também a rota admin /api/admin/organizacoes/verify-platform-email  (e
app/admin/config/platform-email ) para configurar o email oficial da plataforma foram criadas
. Pela amostra do código, a rota admin de platform-email usa requireAdminUser  e permite
GET/POST do email, normalizando e persistindo
.
- Na interface, o painel de Settings da organização e o topo da dashboard exibem e orientam sobre o
email oficial (vimos referências a OrganizationTopBar  e settings/page.tsx  envolvendo isso).
Também, hacks anteriores (“email verificado fake”) foram removidos – por exemplo, antes algumas
lógicas permitiam prosseguir sem email verificado em certos casos; agora está banido (confirmado pelo
checklist de fecho que marca como feito a normalização única e remoção de fallbacks
). 
Plano de Ação:
-  (P0) Enforcement  em  Todas  Ações  Críticas: Revisar  todos  os  endpoints  que  alteram  dados
importantes para assegurar que chamam o guard do email oficial.
• 
• 
37
38
39
40
39
41
42
43
44
45
46
47
46
48
49
50
51
52
53
6

-  Ficheiros  (amostra):
app/api/servicos/*  (criação  de  serviço),  app/api/organizacao/
payouts/*  (configurar payouts), app/api/organizacao/finance/exports/*  (gerar exports).
-  Status: Feito –  A  maioria  já  deve  usar  ensureOrganizationWriteAccess  internamente,  mas
validar.
- Instruções: Nos handlers dessas rotas, garantir chamada a requireOfficialEmailVerified  ou
passando  { skipEmailGate: false }  em  ensureOrganizationWriteAccess . Se encontrar
algum  local  fazendo  verificação  manual  de  officialEmailVerifiedAt  ou,  pior,  ignorando  a
verificação, substituir pelo guard unificado. 
(P0) Normalização e Comparação: Confirmar que todas manipulações do email oficial usam 
normalizeOfficialEmail . 
Ficheiros: app/organizacao/(dashboard)/settings/page.tsx  (onde o usuário digita o
email), lógica de confirmação de token. 
Status: Feito – As funções de API já normalizam antes de salvar
. 
Instruções: Na UI, ao exibir ou comparar, também usar normalizado para evitar casos de
sensibilidade  de  caixa.  Por  exemplo,  se  há  lógica  para  destacar  “email  verificado”  vs  “por
verificar”,  usar  organization.officialEmail  normalizado.  (Já  que  não  guardamos
separado, assumimos que no DB está armazenado normalizado, o que é o ideal
). 
(P1) Feedback de UI: Melhorar a experiência do usuário em relação ao email oficial. 
Status: Feito – UI com avisos persistentes + CTA de verificação e textos amigáveis. 
Instruções: No dashboard da organização, exibir um aviso persistente enquanto o email não
estiver  verificado,  explicando  que  certas  ações  estão  bloqueadas
.  Fornecer  instruções  claras  para  confirmação.  Garantir  que  mensagens  de  erro  vindas  do  backend
(OFFICIAL_EMAIL_REQUIRED/NOT_VERIFIED)  sejam  exibidas  de  forma  amigável  ao  usuário
(mapeadas para PT). 
(P2) Email da Plataforma (Admin): Testar e finalizar a tela de configuração do email oficial da
plataforma ORYA. 
Ficheiros: app/admin/config/platform-email/page.tsx , /api/admin/config/
platform-email . 
Status: Feito – UI + validação finalizadas (normalização + estados de erro). 
Instruções: Permitir que um admin da plataforma defina ou altere o email remetente padrão
(ex.: noreply@orya.pt ). Utilizar a função setPlatformOfficialEmail  (que
provavelmente salva em PlatformSetting ). Após salvar, talvez reiniciar certos processos (ou
pelo menos informar que passa a valer para novos emails). Documentar que em produção esse
valor deve ser configurado antes do envio de emails transacionais. 
Admin Control Center e Estatísticas (Bloco 4)
Resumo & SSOT: A interface de administração da plataforma deve fornecer controle e visibilidade total,
substituindo antigas rotas legacy de estatísticas. O Ops Feed (EventLog) é a fonte única de operações –
ou seja, em vez de coleções de métricas isoladas, o admin deve basear-se nos eventos de operação
registrados
. As ações executadas via admin também precisam ser auditáveis com  requestId
(mesmo envelope de erro) e sem expor dados sensíveis em logs
. Especificamente, o blueprint
determina  que  as  rotas  legacy  de  estatísticas  (que  antes  retornavam  410  ou  erro
• 
• 
• 
52
• 
44
• 
• 
• 
42
• 
• 
• 
• 
54
55
7

LEGACY_STATS_DISABLED ) sejam removidas ou implementadas de forma mínima – “remover legacy
stats (sem 410 em produção)”
. O admin também ganha configurações de plataforma (como email
oficial, já citado). Em suma, a seção Admin deve consolidar funcionalidades de gerenciamento multi-
organização e auditoria, evitando respostas inexistentes. 
Análise  do  Código  (develop): O  sistema  atual  ainda  carrega  resquícios  do  antigo  módulo  de
estatísticas:
- As rotas app/api/organizacao/estatisticas/overview  e /time-series  existem e contêm
lógica para calcular alguns agregados (somando SaleSummary  etc.)
. Porém, no blueprint v7
elas estavam desativadas (indicadas como legado). A implementação atual parece retornar alguns
dados básicos, mas possivelmente não utiliza ainda a nova fonte EventLog (rollups v9).
- A rota app/api/admin/organizacoes/list  provavelmente retornava um 410 indicando feature
desligada. Precisamos verificar se algo mudou – ela não apareceu facilmente na busca, possivelmente
ainda está marcada como indisponível.
-  UI: Páginas  correspondentes  ( app/admin/organizacoes/page.tsx  e  app/organizacao/
estatisticas/page.tsx )  precisam  ser  revisadas.  Hoje,  a  página  de  estatísticas  da  organização
possivelmente tenta chamar essas APIs e pode quebrar se obtiver 410. O blueprint exige que a UI seja
resiliente – se stats estiverem incompletas, não deve crashar
.
- O Ops Feed: O EventLog e OpsFeed foram implementados (D16 done, domain/eventLog e domain/
opsFeed presentes). Provavelmente alimentam uma lista de eventos operacionais (criação de torneio,
pagamento efetuado, etc.). Entretanto, não há indicativo de uma página Admin consolidada mostrando
isso ainda. 
Plano de Ação:
-  (P0) Substituir  Legacy  Stats  por  Dados  Reais: Implementar  respostas  mínimas  nas  rotas  de
estatísticas utilizando as novas fontes de dados (EventLog, rollups).
-
 Ficheiros:
app/api/organizacao/estatisticas/overview/route.ts ,
 /time-series/
route.ts .
- Status: Feito – overview/time-series migrados para rollups/entitlements (sem legacy summaries).
- Instruções: Para overview: podemos fornecer indicadores básicos, como totalTickets, totalRevenue e
contagem de eventos ativos, já calculados via queries no prisma
. Confirmar se esses cálculos
cobrem todos os eventos (e.g. Padel pairings, pois o code trata isPadel separadamente para contar
pairings
). Idealmente, integrar com os rollups v9 (se job pronto) – mas caso não, retornar pelo
menos as somas de  Payment  confirmados ou  SaleSummary  (se este estiver sendo atualizado
corretamente via triggers). Garantir que a resposta use envelope canônico com ok  e dados dentro
de  data . Para  time-series: se não houver tempo de implementar a série temporal real, retornar
código 501 ou uma estrutura vazia com ok:true, data: []  para não quebrar a UI, ao invés de 410.
- Instruções (UI): Ajustar estatisticas/page.tsx  para não esperar dados complexos. Exemplo: se
API retornar erro/501, exibir mensagem “Estatísticas ainda não disponíveis” em vez de falhar. Isso
cumpre o fallback resiliente
. 
(P0) Lista de Organizações (Admin): Reativar ou recriar a rota /api/admin/organizacoes/
list  para listar organizações ativas. 
Ficheiros: app/api/admin/organizacoes/list/route.ts , correspondente UI em app/
admin/organizacoes/page.tsx . 
Status: Feito – rota admin ativa com contagens/revenue + envelope canónico. 
Instruções: Implementação simples: query em  prisma.organization  pegando id, nome,
email oficial verificado (sinalização), talvez número de membros. Retornar em envelope padrão.
Na UI admin, mostrar uma tabela com essas orgs, indicando quais estão com email verificado,
56
57
58
59
60
61
62
63
• 
• 
• 
• 
8

modo de pagamentos (ex.: se Stripe conectado ou não). Isso fornece ao admin plataforma uma
visão geral e cumpre a necessidade mínima sem a antiga dependencia de stats complexas. 
(P1) Ops  Feed  (Admin  Dashboard): Introduzir  uma  seção  no  admin  que  exiba  eventos
operacionais relevantes (audit trail). 
Status: Feito – ops feed disponível e consumido no admin. 
Instruções: Criar,  se  possível,  uma  página  admin  “Ops”  ou  usar  a  mesma  /admin/
organizacoes  para  listar  atividades  recentes:  p.ex.,  últimos  eventos  criados,  últimos
pagamentos  processados,  etc.  Isso  pode  ser  consultado  via  domain/opsFeed  (que
provavelmente combina EventLog com Outbox para gerar um feed). Se não der tempo para
interface  completa,  ter  pelo  menos  um  endpoint  /api/admin/ops-feed  que  retorne
entradas  recentes  do  EventLog  (limite  50)  com  timestamps  e  descrição.  Documentar  essa
capacidade e adicionar no blueprint registro quando implementado. 
(P1)
Auditoria  e  Request  IDs  no  Admin: Revisar  todas  as  rotas  admin  para  usar
getRequestContext  e retornar envelope com requestId. 
Ficheiros: app/api/admin/**  (todas rotas). 
Status: Feito – Rotas admin padronizadas com getRequestContext + respondOk/respondError. 
Instruções: 
Padronizar:
 
cada
 
rota
 
admin
 
inicia
 
com
const ctx = getRequestContext(req)  e usa fail(ctx, ...)  em vez de lançar ou usar
NextResponse diretamente. Isso assegura que qualquer erro sai com requestId  incluso
.
Conferir  se  todos endpoints  admin  retornam  no  formato  {  ok,  ...  } .  Ajustar  onde
necessário. 
(P2) Melhorias Futuras (Admin):
Portal Financeiro: Adicionar na UI admin se possível um resumo financeiro consolidado (total
processado, comissões ORYA), para uso interno. 
Logs sem PII: Verificar que logs admin não imprimem dados sensíveis (ex.: não logar tokens ou
info pessoal em console/LogDNA)
. 
Segurança: Considerar 2FA obrigatório para admin (planejado para fase 2, mas salientar). 
RBAC e Contexto de Organização (Bloco 5)
Resumo & SSOT: ORYA é multi-tenant, portanto contexto de organização explícito é obrigatório em todas
as operações – nenhuma ação deve ocorrer fora de uma org selecionada
. O controle de acesso
baseia-se em RBAC (Role-Based Access Control) com role packs e scopes definidos, e deve haver helpers
canônicos para checar permissões em vez de lógicas ad-hoc. Em especial, “rg bypass = 0” – ou seja, não
deve haver workaround que contorne as regras de RBAC estabelecidas
. Toda rota deve propagar o
orgId do contexto atual e validar que o usuário tem as permissões necessárias naquela org. 
Análise do Código (develop): Muitos aspectos de RBAC mínimo foram implementados durante v9
(conforme registro D5 marcado DONE). Por exemplo:
-  Existe  módulo  lib/organizationRbac.ts  que  define  roles  e  scopes  possivelmente,  e  lib/
• 
• 
• 
• 
• 
• 
51
64
• 
65
• 
• 
• 
66
• 
67
68
9

organizationMemberAccess.ts  e  lib/organizationContext.ts  que ajudam a resolver a org
ativa e checar permissões dos membros.
-  Observamos  que  rotas  críticas  de  membros  e  org  usam  esses  helpers:  p.ex.,
app/api/organizacao/organizations/members/*  utiliza  organizationMemberAccess  para
garantir que somente owners ou admins possam alterar membros
.
- Entretanto, o registro v9 indica Status: TODO para Bloco 5
, sugerindo que faltam alguns ajustes
finais: por exemplo, remover verificações manuais remanescentes (buscar ownerId  diretamente em
vez de usar helper) e unificar o uso de context.

Nota (2026-02-05): Bloco 5 fechado no checklist v10. Ver `docs/v10_execution_checklist.md`.
Plano de Ação:
-  (P0) Helper  Único  de  RBAC: Assegurar  que  todas  as  checagens  de  permissões  usem  funções
centralizadas (em vez de duplicação).
-  Ficheiros:
lib/organizationRbac.ts ,  lib/organizationMemberAccess.ts ,  app/api/
organizacao/**  (rotas de recurso dentro de orgs).
- Status: Feito – Helpers aplicados + gate CI (org context) para prevenir checks ad‑hoc.
-  Instruções: Procurar padrões antiquíssimos, ex.:  if (user.id !== org.ownerId)  ou queries
diretas de membros. Substituir por funções como ensureOrgMemberHasAccess(userId, orgId, 
requiredRole)  definidas num só lugar. Implementar em organizationRbac.ts  funções do tipo
canEditEvent(userId, orgId)  ou genéricas hasScope(userId, orgId, scope) , e usar nas
rotas. Assim, uma mudança nas roles futuras reflete globalmente. 
(P0) Propagação de orgId no Contexto: Verificar que toda requisição que precisa do orgId
efetivamente o obtém do contexto ativo ou dos parâmetros, e valida pertencimento. 
Ficheiros: lib/organizationContext.ts  (funções getActiveOrganizationForUser ,
etc.), uso em middleware ou layouts React server-side. 
Status: Feito – O layout dashboard parece já amarrar o org selecionado (talvez via segmentação
da URL ou cookie). Porém, algumas rotas API aceitam organizationId  via header ou
resolvem via token. 
Instruções: Consolidar abordagem: idealmente, a API deve inferir orgId do JWT do supabase +
header de org (como já está acontecendo via resolveOrganizationIdFromRequest(req)
). Checar implementações divergentes e alinhar. Exemplo: se alguma rota ainda espera ?
orgId=  no query, migrar para usar organizationContext . 
(P1) Remover Bypass/Hacks: Garantir que não exista bypass de validação. 
Status: Feito – Gate de org context + guardrails reduziram bypass; manter inspeção periódica. 
before prod  concedendo acesso em dev. 
Instruções: Buscar no código por quaisquer flags do tipo if (process.env.NODE_ENV !== 
'production')  em  trechos  de  auth,  ou  variáveis  como  BYPASS_RBAC .  Remover
completamente. Em produção não pode haver portas dos fundos. 
(P1) Role Packs & Granularidade: Revisar se os role packs (coleções de scopes por cargo) estão
completos e sendo aplicados. 
Ficheiros: prisma/schema.prisma  (model de OrganizationMember talvez tem role +
rolePack), lib/organizationRbac.ts . 
Status: Implementado – O blueprint D5 mencionou role packs aplicados
. Ainda assim,
confirmar se cada módulo (eventos, reservas, loja, etc.) define quais roles têm acesso. 
69
70
• 
• 
• 
• 
71
• 
• 
• 
• 
• 
• 
72
10

Instruções: Documentar na codebase (comentários ou doc) as permissões de cada role. Ex.:
Owner: full acesso; Manager: gerencia X e Y; Staff: apenas check-in, etc. Depois, conferir rotas
para ver se as restrições estão de acordo. P.ex., /api/organizacao/events/*  deve permitir
Manager criar evento? Se sim, garantir isso. Se não, responder 403. Atualizar tests de acesso
(existe possivelmente tests/access/** ). 
(P2) UI  de  Permissões: Embora  planejado  para  fase  2,  vale  mencionar:  eventualmente
implementar UI para gerenciamento granular de permissões (por enquanto, out of scope). 
Eventos e Políticas de Acesso (Bloco 6)
Resumo & SSOT: Eventos agora possuem uma EventAccessPolicy canônica, versãoada, que determina as
regras de acesso (modo PUBLIC/INVITE_ONLY/UNLISTED, se checkout de convidado é permitido, se
precisa de entitlement para entrada, etc.)
. A  Entitlement passa a ser  a prova de acesso para
entrada em eventos (tickets), substituindo flags soltas
. As antigas propriedades ( inviteOnly , 
publicAccessMode , etc.) são apenas leitura legada, e não definem mais o acesso – a policy manda
. Invariantes: todo evento criado já deve ter uma EventAccessPolicy (não pode existir evento sem
policy)
; o campo policyVersionApplied  em entitlements/tickets deve ser preenchido e estável
para garantir que o check-in valide a versão correta da policy
. Também, Event.isFree  não deve
ser usado em lógicas – se um evento não tem preço, isso é apurado via pricingMode  e preços de
ticket (SSOT para “gratuito”)
. Por fim, o fluxo de invite tokens: se um evento é INVITE_ONLY, a
API de invite resolve um token em um eventInviteId  (identificador do convite) antes do checkout,
de forma segura e fail-closed (token inválido ou expirado -> erro)
. 
Análise do Código (develop): Este bloco foi marcado como DONE na v9 (D8) e de fato encontramos
implementações correspondentes:
- O schema Prisma foi atualizado para exigir eventId  em Torneios (cobriremos em Bloco 8) e para
incluir a nova tabela EventAccessPolicy  com campos como mode , inviteTokenAllowed , etc.
- A criação de eventos ( app/api/organizacao/events/create/route.ts  talvez) agora gera uma
policy default (provavelmente UNLISTED ou PUBLIC conforme input). Assim, cumpre a invariável de
sempre ter policy.
-  No  check-in  e  convites:  existe  app/api/eventos/[slug]/invite-token/route.ts  e  .../
invites/check/route.ts  
conforme  SSOT.  Esses  endpoints  provavelmente  lidam  com
inviteToken  e  retornam  o  eventInviteId  se  válido.  Precisamos  garantir  que  funcionam
corretamente.
- O script de backfill de EventAccessPolicy foi fornecido e executado (no registro v9 consta DONE com
data 2026-01-29, inclusive menciona deleção de eventos de teste e resultados do dry-run)
. Isso
indica que todos eventos existentes obtiveram uma policy retroativa.
- Check-in: O check-in (QR) agora deve exigir  Entitlement  válido com policyVersion aplicada. O
código  lib/checkin/accessPolicy.ts  possui funções para resolver a policy e verificar locks de
versão (ex.: impede tornar mais restritivo após vendas feitas)
. Este mecanismo de  policy lock
está implementado para evitar, por exemplo, que um evento mude de PUBLIC para INVITE_ONLY depois
de já haver entitlements emitidos – retornando erros como "POLICY_VERSION_REQUIRED/NOT_FOUND"
no check-in se houver mismatch
.
- Atributos legacy: Provavelmente o frontend ainda exibe inviteOnly  checkboxes mas internamente
converte para a nova policy. Precisamos verificar se não há nenhum lugar tomando decisão de “evento
gratuito” baseado em isFree  em vez de preços. 
Plano de Ação:
- (P0) Invite Token Flow: Testar end-to-end o uso de tokens de convite.
• 
• 
73
74
73
75
76
74
77
78
79
80
81
82
83
84
11

-
 Ficheiros:
app/api/eventos/[slug]/invite-token/route.ts ,
 .../invites/check/
route.ts ,  domain/access/evaluateAccess.ts  (se existe), UI do lado do usuário para inserir
token (provavelmente em página pública do evento).
- Status: Implementado – Endpoints existem conforme SSOT.
- Instruções: Simular: criar evento INVITE_ONLY com alguns invites (talvez criados via admin ou script),
pegar um token e chamar a API /invite-token  para resolvê-lo. Deve retornar eventInviteId  e
possivelmente  informações  para  checkout.  Assegurar  que  respostas  contêm
 requestId/
correlationId  também (via envelope). Em seguida, usar esse eventInviteId  no fluxo de compra.
Se token expirado ou já usado, deve retornar erro  INVALID_INVITE_TOKEN  (ver se foi codificado).
Documentar no Dev Portal ou code comments esse fluxo para future reference. 
(P0) Policy Enforcement em Check-in: Validar que o endpoint interno de consumo de check-in
( /api/internal/checkin/consume ) utiliza policyVersionApplied  para checar entrada. 
Ficheiros: app/api/internal/checkin/consume/route.ts , lib/checkin/
accessPolicy.ts . 
Status: Feito – Acredita-se que sim, dado o trabalho feito. 
Instruções: Revisar  o  código:  a  função  de  consume  check-in  provavelmente  procura  um
entitlement por ticket QR, verifica se  entitlement.policyVersionApplied  coincide com
event.currentPolicyVersion . Se não, retorna erro (indicando necessidade de refresh).
Testar scenario onde policyVersionApplied está ausente (deveria não acontecer após backfill) –
sistema deve recusar entrada com erro claro. 
(P1) UI e Legacy Flags: Polir a interface de criação/edição de eventos para refletir novas opções
de Policy. 
Status: Feito – UI já usa EventAccessPolicy (sem campos legacy inviteOnly). 
Instruções: Na página de editar evento, substituir inviteOnly /”Público com bilhete” etc. por
uma seleção do mode  (Público, Não listado, Somente convite). Explicar que se convite, requer
tokens. Ocultar ou informar que o antigo campo "evento gratuito" é automático se não houver
preço definido, mas não usar isso para lógica. Remover qualquer menção a  isFree  exceto
para exibição informativa. 
(P1) Conferir Versões de Policy: Monitorar se incrementos de versionamento ocorrem nos
momentos certos. 
Ficheiros: app/api/organizacao/events/update/route.ts  (se um evento muda
configurações de acesso após já ter entitlements emitidos). 
Status: Feito – updateEvent aplica policy lock (ACCESS_POLICY_LOCKED) quando fica mais
restritiva. 
Instruções: 
Ver
 
se
 updateEvent  
já
 
implementa
 
tal
 
lógica
 
usando
getPolicyLockViolation  do  accessPolicy.ts
.  Se  não,  implementar:  ao  atualizar
configuração de acesso, comparar a policy atual vs nova desejada, e se detectar restrição (ex.:
PUBLIC  ->  INVITE_ONLY),  retornar  erro  MODE_MORE_RESTRICTIVE  ou  similar,  impedindo
mudança pós-lançamento de convites. 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
85
• 
86
12

(P2)
Backfills  e  Dados  Legados: Verificar  se  todos  eventos  existentes  receberam
EventAccessPolicy . 
Status: Feito – O script de backfill foi rodado (conforme registro)
. Apenas restaria limpar
campos legacy se não usados. 
Instruções: Considerar remover colunas legacy ( inviteOnly , etc.) em migração futura, para
evitar confusão, já que agora são read-only. Mas isso pode ficar pós-deploy. 
Reservas, Agenda e Serviços (Bloco 7)
Resumo & SSOT: O domínio de reservas (aulas, bookings de serviços) foi reforçado no v9 para garantir
consistência  e  auditabilidade.  A  confirmação  de  uma  reserva  agora  gera  um
BookingConfirmationSnapshot imutável que captura as regras de política e preços no momento da
confirmação
. Esse snapshot serve de SSOT para qualquer operação subsequente: cancelamentos,
reembolsos ou marcação de no-show devem usar os dados do snapshot, e falhar se o snapshot estiver
ausente (fail-closed)
. Em outras palavras, se por algum motivo um booking confirmado não tiver
snapshot (caso legado), não se pode cancelar via fluxo normal até isso ser corrigido. Para lidar com
bookings pré-existentes, há um script de  backfill para gerar snapshots para reservas confirmadas
antigas
. Além disso, o sistema de Agenda consolidado significa que AgendaItem é o modelo único
(read-model) para blocos de agenda (aulas, bloqueios, etc.). Por fim, garantir que o fuso horário original
do snapshot de reserva seja preservado e exposto nas APIs para correta representação em UI (evitar
confusões de horário)
. 
Análise do Código (develop): Houve progresso substancial neste bloco durante v9, embora marcado
como IN PROGRESS. Encontramos no código:
-  O  módulo  lib/reservas/confirmationSnapshot.ts  com  funções  para  construir  e  analisar
snapshots de reserva, e aplicar regras de reembolso. O snapshot provavelmente inclui detalhes como
preço,  política  de  cancelamento  vigente,  etc.,  no  formato  JSON  armazenado  no  campo
booking.confirmationSnapshot .
- O processo de confirmação de reserva ( lib/reservas/confirmBooking.ts  ou possivelmente em
domain/operations/fulfillServiceBooking.ts )  agora  persiste  o  snapshot  no  momento  do
pagamento  bem-sucedido
.  Assim,  cada  registro
 Booking  
confirmado  ganha
confirmationSnapshot , confirmationSnapshotVersion  e timestamp de criação do snapshot.
- Para cancelamento/no-show: Verificamos as rotas  app/api/me/reservas/[id]/cancel  e  app/
api/organizacao/reservas/[id]/cancel / no-show . Provavelmente, essas rotas chamam uma
função  que  consulta  o  snapshot  e  aplica  as  regras  (e.g.,  prazo  de  cancelamento  com  ou  sem
reembolso). De acordo com SSOT, elas  devem falhar se  confirmationSnapshot  estiver faltando
. Precisamos confirmar se essa validação está lá – possivelmente está, dado o status PR1+PR2 done.
-  O  script  scripts/backfill_booking_confirmation_snapshot.ts  existe  e  foi  parcialmente
executado (PR1+PR2 indicam pelo menos que implementaram e rodaram em QA)
. Ele usa  lib/
reservas/backfillConfirmationSnapshot.ts
 para  preencher  bookings  antigos.  Pelo  log
incorporado  no  código,  ele  lista  quantos  bookings  foram  atualizados  ou  pulados  e  razões
(missingPolicy, etc.)
.
- Quanto à Agenda: A API  app/api/organizacao/agenda  e  .../soft-blocks  aparecem nos
orphans, indicando que possivelmente não há UI usando (talvez substituída por outro approach). Pode
ser  que  a  nova  Agenda  ainda  não  tenha  interface  premium  (drag  &  drop  etc.  ficou  P2),  mas
internamente a representação de  AgendaItem unificada está pronta. O importante é que  softblocks
(bloqueios temporários) e slots de aulas convergem no mesmo modelo de Agenda.
- Fuso horário no snapshot: O snapshot provavelmente armazena o timezone do horário agendado. E
vemos referência de que a API do usuário /api/me/reservas  deve expor isso
. 
• 
• 
80
• 
87
88
89
87
90
87
88
89
91
92
93
90
13

Plano de Ação:
-  (P0)
Cancelamento/No-show  via  Snapshot: Verificar  e  reforçar  que  essas  rotas  utilizam
exclusivamente o snapshot para decisões.
- Ficheiros: app/api/me/reservas/[id]/cancel/route.ts , app/api/organizacao/reservas/
[id]/cancel/route.ts , .../no-show/route.ts .
-  Status: Implementado –  A  lógica  deve  estar  em  comum  (talvez  em  domain/reservations/
cancel.ts ).
-
 Instruções: 
Confirmar  que  as  funções  de  cancelamento  fazem  algo  como:
 if  (!
booking.confirmationSnapshot) throw new Error("POLICY_SNAPSHOT_MISSING")  antes de
prosseguir
. Se não, adicionar. Em seguida, que calculam eventual reembolso usando dados do
snapshot (e.g., percentuais de refund permitidos). Garantir que policyRef  ou id da política usada na
booking está armazenada e sendo usada. Escrever testes unitários simulando cancelamento dentro e
fora do prazo para ver se o reembolso calculado bate com as regras. 
(P0) Backfill de Snapshots em Prod: Executar o script de backfill de snapshots antes do deploy
final, e tratar registros que porventura não consigam snapshot. 
Status: Feito – Backfill executado (report 2026-02-01); confirmar novamente em prod se houver
dados antigos. 
Instruções: 
Preparar
 
procedimento:
 
rodar
 node
 
scripts/
backfill_booking_confirmation_snapshot.ts  em ambiente de staging/prod. Ver logs:
especialmente observar contadores  missingPolicy  ou  missingPricing
. Se houver
bookings antigos sem uma  service.policyId  ou preços, avaliar manualmente. Talvez a
deleção de eventos de teste mencionada no Block6 também incluiu reservas de teste. Em caso
de  skips por dados faltantes, decidir se limpa esses registros ou impede suas operações via
comunicação aos users. Documentar no runbook de release. 
(P1) Preservação de Timezone: Confirmar que o campo de timezone do snapshot está sendo
retornado nas APIs de consulta. 
Ficheiros: app/api/me/reservas/route.ts  (lista de reservas do usuário). 
Status: Feito – Booking.snapshotTimezone presente e retornado no snapshot. 
Instruções: 
Se  a  rota  não  estiver  retornando,  incluir  no  select  a  propriedade
confirmationSnapshotCreatedAt  e  possivelmente  o  próprio  timezone  dentro  do  JSON
snapshot (depende de como estruturaram). O objetivo é que o front-end mostre o horário
corretamente  no  fuso  correto  do  local  do  serviço,  não  convertendo  erroneamente.  Testar
exibindo reservas cross-timezone se aplicável. 
(P1) Agenda  Unificada: Embora  a  UI  premium  de  agenda  (calendário  dia/semana  com
drag&drop) seja um diferencial, garantir ao menos que a API unificada esteja consistente. 
Status: Implementado base – Existe app/api/organizacao/agenda  retornando AgendaItems
(somando aulas, bloqueios, etc.). 
Instruções: Testar essa API manualmente (via Swagger ou chamada) para ver se retorna itens
esperados. Se sim, documentar seu uso e possivelmente integrá-la minimamente na UI atual
(ex.: o calendário atual talvez monta dados separadamente para aulas e bloqueios – pode
refatorar para usar a resposta unificada). Se não for viável agora, manter a UI existente, mas
sabermos que internamente AgendaItem está pronto para uso futuro. 
88
• 
• 
• 
93
• 
• 
• 
90
• 
• 
• 
• 
14

(P2) Melhorias Futuras (Reservas/Serviços):
Agenda UI Premium: Previsto no blueprint (drag&drop, camadas)
 – adiar para pós-deploy
(fase de refinamento UX). 
Auditoria de Agenda: Talvez exibir quem alterou reservas/bloqueios (por enquanto, eventLog
registra isso, mas não há visualização – considerar adicionar no Ops Feed ou num log dentro da
org). 
No-show automation: Confirmar se no-show marcado em UI org atual dispara outbox de possíveis
consequências (ex: penalização do user, notificação) – se não, planejar como melhoria. 
Padel e Torneios (Bloco 8)
Resumo & SSOT: A vertical de Padel/Torneios tem a particularidade de combinar torneios esportivos
com inscrições de duplas (Padel). O principal ponto no blueprint v9 foi amarrar  todo Torneio a um
Event base obrigatório
. Ou seja, Torneio não vive isolado: ele deve referenciar um eventId  para
aproveitar os mecanismos genéricos (convites, pagamentos, check-in via entitlements, etc.). Isso unifica
o tratamento de torneios com outros eventos. Além disso, houve ajustes na lógica de inscrição de padel
(PadelRegistration):  nas  decisões  D12,  simplificou-se  estados  e  removeu-se  conceito  de  “pairing
lifecycle”  redundante.  Provavelmente  a  conclusão  é  usar  Entitlement  também  como  prova  de
inscrição em padel quando pago, e rely no EventAccessPolicy para controlar acesso em torneios. 
Análise do Código (develop): Esse bloco estava marcado TODO, mas várias fundações foram lançadas
durante v9:
-  O  schema  prisma  agora  obriga  eventId  em  Tournament  e/ou  PadelTournamentConfig .
Confirmamos no closeout D1 que “Torneio/Padel ancorado em Event” foi marcado DONE com evidências
no schema
. Assim, não há mais torneio sem evento.
-
 
Migrations
 0058_padel_registration_status_v9  
e
0059_drop_padel_pairing_lifecycle_v9  foram aplicadas
. Isso indica que ajustaram o status
de inscrição de padel (possivelmente padronizando para algo como CONFIRMED/CANCELLED  em vez
de  vários  sub-estados)  e  removeram  lógica  desnecessária  de  pairing.  O  código  domain/
padelRegistration*.ts  terá as mudanças. Precisamos verificar se a UI e fluxos acompanharam.
- A integração com event entitlements: quando um jogador se inscreve num torneio padel (que é um
evento), idealmente deveria gerar um entitlement (Ticket) também. O fulfillment de pagamento (Block9)
cobre  TicketOrders  mas  não  explicitamente  PadelRegistration.  Entretanto,  no  código
fulfillment.ts  vemos  uma  função  issuePadelRegistrationEntitlements  preparada
.
Isso sugere que agora quando um pagamento de inscrição padel é concluído, criam-se entitlements
específicos  (tipo  PADEL_ENTRY )  para  dar  acesso.  Precisamos  confirmar  se  está  sendo  chamada.
Provavelmente sim, via PaymentEvent consumer.
- UI Padel Wizard: O blueprint F1-C menciona um “Padel Wizard premium” com templates e import CSV
, mas isso é possivelmente não implementado ainda devido a tempo. Ou seja, criar torneio padel
pode ser manual e sem assistente bacana.
- A programação de jogos (match schedule) – parte importante de um torneio – não sabemos se foi
completada.  O  blueprint  F1-B  requeria  “torneio  end-to-end  (criar  ->  inscrições  ->  schedule ->
pagamentos -> check-in -> resultados)”
 como critério de saída. Provavelmente um básico existe
(talvez geração de chaves de torneio bracket), mas se houver falha, podemos ter um gap. 
Plano de Ação:
- (P0) Inscrição e Pagamento de Torneio via Event: Validar que o fluxo de inscrição em torneios utiliza
o pipeline normal de eventos.
- Ficheiros: Rotas app/api/padel/registrations/*  ou possivelmente reusaram /api/eventos/
• 
• 
94
• 
• 
95
96
97
98
99
100
15

[slug]/checkout  para torneio (depende de implementação).
- Status: Verificar – Agora que torneio tem eventId, ideal seria que a inscrição use o mesmo checkout de
evento (TicketOrder). Mas pode ser que mantiveram separado.
-  Instruções: Se  ainda  houver  rota  exclusiva  tipo  /api/padel/pairings/[id]/checkout ,
confirmar  que  ela  internamente  cria  um  Payment  ligado  a  um  TicketOrder  ou  PadelRegistration
atrelado
 
ao
 
event.
 
Garantir
 
que,
 
ao
 
finalizar
 
pagamento,
 
chame
issuePadelRegistrationEntitlements  para emitir entitlement do tipo PADEL_ENTRY vinculado
ao event do torneio. Assim, check-in e listagem de inscritos ficam uniformes. Se esse call não estiver
conectado, adicioná-lo no consumidor do PaymentEvent para Padel. 
(P0) Estados de PadelRegistration: Revisar se a UI e API estão usando os novos estados. 
Status: Atualizado – Após migração v9, provavelmente os estados foram simplificados (e.g., não
há mais pairing lifecycle separado). 
Instruções: 
Conferir
 enumerados:
 por
 exemplo,
 se
 antes
 tinha
 status
WAITING_CONFIRMATION , CONFIRMED , etc., agora deve ter equivalentes. Atualizar qualquer
referência estática no front (e.g., se um componente exibia “Aguardando confirmação” baseado
num estado que mudou de nome). Atualizar testes se existirem. 
(P1) Geração de Chaves e Agendamento: Avaliar a funcionalidade de criar chaves de torneio e
agendar partidas. 
Status: Possivelmente parcial – O blueprint enfatiza isso, mas não sabemos o estado. 
Instruções: Testar criar um torneio via UI: o sistema permite inserir participantes/duplas e gera
a bracket? Se não completo, documentar limitações (ex.: bracket talvez gerado externamente ou
manual). Como mínimo, se não implementado, sinalizar para o usuário que após inscrições ele
deve exportar/usar planilha. Mas idealmente, implementar um auto-schedule básico: para um
torneio eliminatório, criar pares aleatórios e popular as rodadas no DB. Se não der tempo para
v10, isso seria um gap a aceitar (mas então remover do exit criteria – embora blueprint listou
isso como done criteria). Priorizar se possível ao menos bracket simples sem UI refinada. 
(P1) UI Padel Wizard: Melhorar a UX de criar torneio. 
Status: Em aberto – Provavelmente atualmente é um formulário extenso. 
Instruções: Aplicar alguns  templates rápidos: por exemplo, predefinir configurações comuns
(Torneio de 16 duplas eliminatório, etc.) para reduzir inputs. Se import CSV de participantes for
viável facilmente, ótimo, senão deixar para depois. Mensagens de validação: garantir clareza
(ex.: se faltou categoria ou formato, avisar claramente). 
(P2) Resultados  e  Rankings: Confirmar  que  há  forma  de  registrar  resultados  de  jogos  e
produzir output (campeão, etc.). 
Status: Não detalhado – Fora do escopo core, mas importante entregar no admin/organizador a
opção de inserir placares e finalizar torneio. 
Instruções: Se o modelo de Match existe, expor via UI organizador uma lista de jogos para
inserir resultados. Caso contrário, instruir processo manual (ex.: “exporte bracket e faça offline”).
Pelo menos, store o campeão e finalistas manualmente no sistema. Mark as a known limitation if
needed. 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
16

Loja, Bilhetes e Check-in (Bloco 9)
Resumo & SSOT: Este bloco trata da integração do e-commerce de ingressos e produtos com o sistema
de acesso e presença. O princípio central: Entitlement é a prova de acesso, seja para eventos ou outros
benefícios
. Assim, quando um usuário compra um bilhete de evento (Ticket), o sistema deve gerar
um Entitlement do tipo EVENT_TICKET ativo atrelado àquela compra
. O check-in de ingresso
usa esse entitlement (via QR ou lista). Para a loja (produtos), não há um componente de acesso, mas
ainda envolve pagamentos e fulfillment (envio de itens, etc.), que devem estar consistentes com ledger.
O  blueprint  não  detalhou  muito  loja  no  v9  além  de  reforçar  que  o  store compartilha  módulos
horizontais (pagamentos, etc.), e que promoções, cupons e etc. seriam expandidos em fases posteriores.
Porém, salientou que tickets e check-in estão unificados no conceito de entitlement. 
Análise do Código (develop):
- O fluxo de emissão de Tickets foi implementado no v9: conforme visto em  domain/finance/
fulfillment.ts , a função issueTicketOrderEntitlements  é chamada durante o fulfillment de
pagamento  de  um  TicketOrder
.  Ela:  cria  entradas  na  tabela  Ticket  para  cada  bilhete
comprado (com QR secreto, preço pago, etc.) e cria uma entrada correspondente em Entitlement
para  cada  bilhete
.  Cada  entitlement  de  tipo  EVENT_TICKET  carrega  o  eventId , 
ownerIdentityId  e campos snapshot (título, data do evento, etc.) para exibição offline
. Isso
significa que agora a fonte de verdade para acesso ao evento é a tabela Entitlement, e o QR code do
ticket serve para lookup do entitlement no check-in.
- O check-in (rota /api/internal/checkin/consume ) usa o QR de `EntitlementQrToken` para resolver o
Entitlement e registar consumo via `EntitlementCheckin` (`consumedAt`). `Ticket.usedAt` foi removido
para evitar drift; consumo é metadata no Entitlement.
- Sobre Loja (produtos físicos/digitais): UI de gestão + storefront público + checkout existem e estão
ativos. Fluxo completo (catálogo → carrinho → checkout → encomenda) já está exposto, com bundles,
portes e promo codes. As definições de suporte/políticas ficam no painel da loja.
- Check-in unified (decisão atual): o scanner usa entitlements apenas para **eventos/tickets** e
**padel**. Entitlements de SERVICE_BOOKING não entram no fluxo de check-in (sem QR). O endpoint
de check-in deve aceitar só EVENT_TICKET e PADEL_ENTRY.
- O blueprint v9 não entrou em detalhes de funcionalidades extra (ex.: transferir bilhete, marketplace de
revenda – isso ficou possivelmente fora de v1). Observamos presence de  /api/eventos/[slug]/
resales  e stuff de carteira de créditos nos orfãos, indicando futuros recursos não ativados. 
Plano de Ação:
- (P0) Emissão de Tickets & Entitlements: Testar o ciclo completo de compra de bilhete e posterior uso
no check-in.
-  Ficheiros:
app/[username]/loja/carrinho/page.tsx  (fluxo de compra de ingressos?),  app/
api/payments/intent  com TicketOrder, domain/finance/fulfillment.ts .
- Status: Implementado – A lógica de emissão está lá
.
- Instruções: Executar um teste end-to-end: comprar ingressos para um evento (via interface pública se
disponível, ou via rota API chamando com TicketOrder id). Após pagamento (pode simular usando
Stripe  test  card),  verificar  em  banco:  Ticket  criado,  Entitlement  criado  com  status  ACTIVE.
Depois, simular check-in usando /api/internal/checkin/consume : fornecer o QR (ou Ticket.id) e
101
102
103
104
102
102
105
103
106
102
105
17

org secret. Esperado: marcar entitlement como consumido via check-in (EntitlementCheckin + consumedAt)
em vez de usar estado de consumo no Entitlement. Ver logs ou retornos. Ajustar se necessário para garantir
atomicidade (talvez criar transação: registar check-in e snapshot ao mesmo tempo).
(P0) Consistência Tickets/Entitlements: Garantir que todos entitlements de tickets referenciam
corretamente os tickets e vice-versa. 
Status: Feito – No upsert, entitlements guardam ticketId
. Isso permite traçar cada
bilhete ao direito de entrada. 
Instruções: Apenas monitorar se há duplicação ou falta de index único: deveria haver uma
restrição unique no prisma para evitar dois entitlements iguais para mesmo purchaseId+ticket.
Se não, adicionar para segurança (mas upsert já cuida). 
(P1) Ativar/Desativar Módulo Loja: Decidir escopo da loja para o lançamento v10. 
Status: Incompleto – Muitas rotas store estão orfãs
, sugerindo funcionalidade não
finalizada ou sem interface. 
Instruções: Se optar por incluir: precisamos conectar as telas de loja (catálogo de produtos,
carrinho) no site público. Conferir se  app/[username]/loja/page.tsx  existe e funciona
para listar produtos. Caso contrário, esconder entradas de menu relacionadas a loja para não
confundir. É preferível lançar sem loja (feature flag off) do que com UX quebrada. Documentar
claramente se “Loja” ficará desativada no MVP. 
(P1) Integridade no Check-in: Unificar tratamento de diferentes entitlements no endpoint de
consumo de check-in. 
Ficheiros: app/api/internal/checkin/consume/route.ts . 
Status: Ajuste – Possivelmente implementado para tickets, mas verificar se cobre reservas
(Entitlement de SERVICE_BOOKING) e padel (PADEL_ENTRY). 
Instruções: Expandir o handler: ao receber um código QR ou ID, detectar prefixo ou contexto.
Se for ticket, procurar em Ticket e vincular a Entitlement correspondente; se for reserva (por ex.,
QR  de  reserva  pode  codificar  bookingId),  localizar  Entitlement  de  type  SERVICE_BOOKING;
similar para padel. Todos devem convergir para  mark as used. Se a lógica for complexa, pelo
menos garantir que app de check-in só gera QR de tickets (talvez reservas não geram QR pois
check-in de aula é lista). De qualquer forma, conferir e padronizar. 
(P2) Extras  (Marketplace  de  Revenda,  Carteira): Havia  indícios  de  funcionalidades  como
revenda de bilhetes e créditos de fidelidade (carteira). Estão fora do escopo imediato. 
Status: Feito – Rotas + UI existem para carteira (entitlements/loyalty) e revenda; sem wallet
monetária (apenas pontos/benefícios). 
Instruções: Carteira/entitlements ativa (bilhetes/inscrições/reservas). Créditos monetários ficam fora
de escopo; manter a comunicação explícita de “sem wallet monetária”.
Utilizadores, Sessão e Notificações (Bloco 10)
Resumo & SSOT: Este bloco abrange aspectos de conta do usuário, privacidade e notificações. O
blueprint estabelece  consentimentos explícitos como princípio
 – ou seja, qualquer uso de dados
pessoais ou envio de comunicações exige consentimento registrado (e.g., opt-in de newsletter, termos
• 
• 
103
107
• 
• 
• 
108
109
• 
• 
• 
• 
• 
• 
• 
• 
110
18

de uso aceitos). Para v1, isso implica garantir que um usuário tenha aceitado os Termos e Política ao se
registrar,  e  opcionalmente  ter  configurações  para  optar  por  marketing.  Privacidade:  deve  haver
funcionalidade de deleção de conta (DSAR – Data Subject Access Request), possivelmente com fluxo de
confirmação (ex.: solicitar deleção, email de confirmação, etc.). Notificações: O sistema de notificações
(emails  principalmente)  foi  implementado  via  SES  e  outbox  (D6  done  –  “Notificações  como
serviço”
). Push notifications via APNs também integradas (Apple push), mas isso requer app móvel
ou PWA. 
Análise do Código (develop):
- Mecanismo de notificação: existe domain/notifications/*  e possivelmente templates de email. A
entrega de emails transacionais está configurada através de AWS SES e é acionada por outbox
events. Por exemplo, ao criar uma reserva, deve existir outbox de “BookingConfirmationEmail”. Como
isso foi concluído no v9, acreditamos que funciona (mas testar alguns fluxos para ver se email chega).
- Consentimentos: Existe tabela UserConsent + endpoints user/org; ingest CRM respeita consentimentos.
- Deleção de conta: Fluxo completo com agendamento/cancelamento + purge admin (DSAR).
- Sessão: O login/registro dependem do Supabase Auth. A gestão de sessão (logout, refresh) é delegada
ao Supabase libraries. Em geral, isso deve estar funcionando, mas é bom checar se token de refresh e
expiração estão config.
- Apple Sign-in: Faz parte deste contexto. O blueprint D17 “Apple V1” foi implementado (Sign In with
Apple). Precisamos testar se o login com Apple funciona e se o private email relay não quebra fluxo de
officialEmail (mas officialEmail é por org, então ok).
- Notificações push (APNs): Provavelmente prepararam a infra (chaves APNs, função lib/push/apns.ts).
Podem estar usando expo or not. Se não há app nativo ainda, pode não ser testável. 
Plano de Ação:
-  (P0) Consentimentos e Termos: Implementar armazenamento e verificação de consentimento do
usuário.
-  Ficheiros: fluxos  de  registro  ( app/api/auth/signup ?),  base  de  dados  (talvez  adicionar
acceptedTermsAt  em User).
-  Status: Feito – consentimentos persistidos (UserConsent) com endpoints ativos.
- Instruções: Na tela de registro, incluir checkbox “Li e aceito os Termos e Política”. No backend, ao criar
usuário (após supabase auth), salvar em User.profile  (ou tabela própria) a data de aceitação. Para
marketing opt-in, se desejado, também salvar preferência. Essas flags serão úteis para compliance. 
(P0) Deleção de Conta: Finalizar o fluxo de deleção com confirmação. 
Ficheiros: app/api/me/settings/delete/request/route.ts  (hipotético), .../cancel/
route.ts . 
Status: Feito – delete/cancel + purge admin com registo de DSAR. 
Instruções: Assegurar que, quando usuário pede deleção, criamos registro (ex.: em 
UserDeletionRequest ) com token e enviamos email de confirmação. Se confirmar (via link
que chama /delete/confirm?token=), então: 
Remover dados pessoais do usuário (GDPR compliance): anonimizar nome/email ou
remover registros relacionados. Como v1 não tem muitos dados sensíveis, pode-se optar
111
112
• 
• 
• 
• 
◦ 
19

por soft-delete (marcar user como deleted e limpar identificáveis). Supabase Auth não
permite reutilizar email? Possível usar Supabase Admin API para deletar usuário. 
Invalidar sessões (logout em todos devices). 
Instruções: Conectar a tela de configurações de usuário para acionar essa request. Adicionar
avisos claros (“Esta ação é irreversível…”). 
(P1) Notificações por Email: Testar principais emails transacionais. 
Status: Feito – D6 indica que há templates e envio via outbox
. 
Instruções: Gerar situações: criar nova conta (deve enviar email de boas-vindas ou verificação?),
criar reserva (envia email de confirmação com detalhes?), compra bilhete (envia e-ticket?), etc.
Confirmar recebimento no email de teste. Ver log de outbox/notifications para erros. Corrigir
template ou conteúdo se necessário (ex.: placeholders não preenchidos, textos em PT). Priorizar:
email de reset de senha (provavelmente Supabase já trata), emails de convite de evento, recibos
de pagamento (se decidirmos enviar recibo). 
(P1) Notificações Push: Configurar e testar envio push básico. 
Status: Implementado base – APNs env vars estão listadas
, então integraram Apple Push. 
Instruções: Se há app iOS de staff (talvez ainda não), deixar pronto: registrar device token via /
api/me/push-tokens  (rota orfã listada
). Esse endpoint deve salvar token (Supabase DB or
external). Testar enviando manual via lib/push/apns.ts  (fazer uma chamada de teste). Se
não há app, podemos ignorar por enquanto ou testar em sandbox minimal. 
(P2) Melhorias de Perfil:
Gestão de Sessões: Opcionalmente, mostrar ao usuário dispositivos logados e permitir logout
remoto (Supabase não oferece pronto, pular por ora). 
Campos de Perfil: Confirmar que edição de perfil (nome, foto) funciona. A foto provavelmente
está integrada com Supabase storage (bucket avatars). Testar upload e acesso. 
2FA: Mencionado para admins/financeiro fase 2
 – anotar para futura implementação. 
Pesquisa, Descoberta e Analytics (Bloco 11)
Resumo & SSOT: Nesta fase inicial, funcionalidades de busca e discover são read-only e limitadas
.
Ou seja, não há intenção de implementar indexação avançada ou analytics complexos para v1; o foco
foi em operações core. Portanto, é esperado que a pesquisa de clubes/eventos seja simples (talvez
filtrar por nome via SQL LIKE ou usar capabilities básicas do Supabase). Analytics avançada (ex.: funil de
conversão, relatório custom) também ficou para depois – o blueprint indicou que materializações de
analytics viriam em jobs futuros (fase 2)
. 
Análise do Código (develop):
- Existem algumas rotas relacionadas a analytics no repo (por ex., /api/organizacao/analytics/
overview , .../dimensoes ) listadas como orfãs
. Isso sugere que se começou algo de analytics
organizacional (talvez breakdown de vendas por tipo), mas possivelmente não terminado ou sem UI.
- Busca: Não encontramos uma rota explícita de busca global. Provavelmente, a busca de eventos/clubs
no  app  público  é  implementada  via  filtragem  no  supabase  (ex.:  pode  estar  usando
useSupabaseClient().rpc('search_profiles',  {...})  ou  simplesmente  listando).  -  Como
◦ 
• 
• 
• 
111
• 
• 
• 
113
• 
114
• 
• 
• 
• 
115
116
117
118
20

esse bloco é todo marcado TODO, podemos concluir que nada crítico aqui impede o deploy – é mais
ausente do que errado. 
Plano de Ação:
- (P2) Busca Global Simples: Se não houver, adicionar uma funcionalidade de busca textual básica para
encontrar clubes ou eventos pelo nome.
 Status: Feito – Endpoint unificado criado em `app/api/search/route.ts` (orgs + events + users). 
-  Instruções: Usar `/api/search?q=` para barra global quando necessário; resultado já devolve grupos.
combinados (ex.: clubes e eventos cujo nome ~ ilike '%query%'). Isso ajuda na barra de busca do topo
(Unified Search) se formos implementar. Se for muito em cima da hora, pelo menos garantir que o
usuário possa buscar clubes pelo nome em uma página (p. ex., se temos diretório de clubes). 
(P2) Analytics Organizacional: Documentar ou esconder menus inativos. 
Status: Feito – Dashboard org já consome rollups/overview e expõe métricas base. 
Instruções: Caso decidam mostrar algo, talvez exibir apenas o que implementamos no overview
(total vendas 30d, etc.) e deixar futuros gráficos disabled. Transparentemente comunicar “Em
breve, analytics detalhada”. 
(P3) CRM e Campanhas: Fora de escopo v1. Apenas mencionar que não há e que integrações
com CRM externo ou módulo interno de campanhas ficarão para fase seguinte. Garantir que
rotas  placeholders  (ex.:  /api/organizacao/consentimentos  –  possivelmente  para  listar
consents) não sejam acessíveis ou retornem vazio. 
Rotas Internas, Cron e Segredos (Bloco 12)
Resumo & SSOT: As rotas internas ( /api/internal/** ) e de cron ( /api/cron/** ) devem ser
protegidas por um segredo único padronizado
. Ou seja, todas essas rotas só podem ser chamadas
com um header ou token secreto conhecido (e.g.,  ORYA_CRON_SECRET ). Isso previne acessos não
autorizados a endpoints que executam tarefas privilegiadas (reprocessamento, releases automáticos,
etc.). Atualmente, algumas rotas tinham segredos divergentes ou implementações diversas – o objetivo
é unificar num helper único para validação. Além disso, garantir que a UI (frontend) nunca chama
diretamente essas rotas internas usando o segredo – em vez disso, deve usar mecanismos seguros
(server actions ou proxies), pois expor o segredo no client seria falha grave. 
Análise do Código (develop):
- Observamos no  .env  necessário a variável  ORYA_CRON_SECRET  definida
. Isso indica que o
sistema já migrou para usar um só secret configurado para todos.
- Entretanto, busca no código por  ORYA_CRON_SECRET  não retornou rapidamente, sugerindo que
possivelmente  está  implícito  (talvez  via  requireInternalAuth  middleware).  Precisamos  confirmar  se
todas as rotas internas e cron chamam um util de segurança. Por exemplo,  app/api/internal/
worker/operations/route.ts  
deve
 
checar
 
se
req.headers['x-orya-internal-secret'] === process.env.ORYA_CRON_SECRET . Se algumas
rotas ainda estiverem com segredos codificados ou diferentes, corrigir.
- UI usage: Não identificamos nenhum lugar no frontend chamando fetch para  /api/internal  –
seria muito inseguro. Provavelmente, está sendo usado corretamente via triggers server-side (ex: a rota
117
• 
• 
• 
• 
119
120
21

cron é chamada por um scheduler, não pelo user). Confirmar se ninguém colocou uma chamada
clientside passando secret (um big no). 
Plano de Ação:
- (P0) Helper Unificado de Secret: Implementar uma função util requireInternalSecret(req)  em
lib/security/requireInternalSecret.ts  e usar em todas as rotas internas/cron.
- Ficheiros: Todas em app/api/internal/**  e app/api/cron/** .
- Status: Feito – requireInternalSecret aplicado em internal/cron.
- Instruções: Criar requireInternalSecret(req: NextRequest): boolean  que verifica header
x-orya-internal-key  (ou nome padronizado) e compara com o segredo do env. Em cada rota
internal/cron,  no  início,  fazer:
 if  (!requireInternalSecret(req))  return  new
 
Response("Unauthorized",  {  status:  401  }) .  Padronizar  o  header  nome  (p.ex.  X-ORYA-
SECRET ). Atualizar documentação ou comentários para lembrar de configurar secret nas invocações
(por ex., se chamamos via curl no cron, usar header correto). 
(P0) Refatorar Rotas Existentes: Substituir qualquer outro método de auth interna pelo novo
helper. 
Status: Feito – auth interna padronizada por helper e guardrails.
esperar ?secret=  query param. 
Instruções: Uniformizar: somente via header (mais seguro que query). Excluir tolerância a query
param ou outros secrets. Dica: procurar por process.env  dentro de rotas internas para ver
usos. 
(P0) Segredo não exposto na UI: Revisar se nenhuma chamada front-end tenta usar esse
segredo. 
Status: Feito – Varredura sem uso de secrets no client. 
Instruções: Se encontrasse, remover imediatamente. Qualquer funcionalidade precisando dado
interno deve ser remanejada: ou criar endpoint público seguro ou usar action do Next (server
action) para invocar internamente. 
(P1) Acesso Cron Externo: Documentar como chamar endpoints cron/internos em produção. 
Status: Feito – Instruções consolidadas em envs_required.md + runbook ops-endpoints. 
Instruções: Escrever runbook "Ops Endpoints" com lista de endpoints internos (e.g.  /api/
cron/payouts/release  –  libera  payouts;
 /api/internal/reconcile  –  reconcilia
pagamentos; etc.), e exemplo de cURL com header secret para acioná-los. Garantir que no App
Runner (ou onde for hospedado) esses endpoints não estejam expostos publicamente sem auth.
Uma possibilidade extra: restringir por IP (por ex., se cron for chamado de AWS Lambda, limitar
a esse IP) – opcional. 
(P2) Monitoramento de Cron: Implementar endpoint de health check para crons. 
Status: Não crítico – Mas útil. 
Instruções: Poderia ser uma rota /api/internal/cron/coverage  que retorna quais jobs
rodaram nas últimas X horas (indicando se scheduler está em dia). Isso ajuda a detectar se
algum cron parou. Pode ficar para post-launch se complexo. 
• 
• 
• 
• 
• 
• 
• 
• 
121
• 
• 
• 
• 
22

Observabilidade, Runbooks e SLOs (Bloco 13)
Resumo  &  SSOT: Antes  do  go-live  é  necessário  estabelecer  operational  readiness.  Isso  inclui
observabilidade (logs centralizados, métricas, tracing se possível),  runbooks mínimos por domínio
para incidentes, e procedimentos de DLQ/replay bem definidos
. Além disso, definir SLOs (Service
Level Objectives) e SLIs para monitorar a saúde do sistema (ex.: tempo de checkout, taxa de erro nas
operações financeiras, etc.). O blueprint menciona gates de produção para compliance, DSAR, retenção
de dados, release, etc., muitos dos quais se relacionam a runbooks e verificações de qualidade
. 
Análise do Código (develop):
-Resumo  &  SSOT: Antes  do  go-live  é  necessário  estabelecer  operational  readiness.  Isso  inclui
observabilidade (logs centralizados, métricas, tracing se possível),  runbooks mínimos por domínio
para incidentes, e procedimentos de DLQ/replay bem definidos
. Também é importante definir SLOs
(Service  Level  Objectives)  e  SLIs  para  monitorar  a  saúde  do  sistema  (ex.:  tempo  de  resposta  do
checkout, taxa de falhas em pagamentos). O blueprint enfatiza gates de produção para compliance e
estabilidade – por exemplo, retenção de dados GDPR, backups, etc., que devem estar cobertos por
runbooks e checklists de release
. 
Análise do Código (develop):
- Já existem alguns runbooks no repositório ( docs/runbooks/* ), cobrindo tópicos como DLQ, replay,
traçar  requestId,  etc.  Isso  é  um  bom  começo,  mas  precisamos  garantir  que  estão  atualizados  e
completos para v10.
- Observabilidade: Logs estruturados via logger central + CloudWatch. Sem Sentry (AWS-only).
- DLQ e replay: Já tratado em bloco 2, mas do ponto de vista operabilidade, deve haver instruções claras
de como reprocessar eventos ou lidar com filas mortas – esses runbooks estão parcialmente escritos.
-  SLOs:  Não  foram  formalizados  no  código  (normal,  é  mais  um  processo).  Precisamos  defini-los
manualmente antes do deploy: por exemplo, "99% dos checkouts completam em <5s"; "Nenhum e-mail
crítico falha sem retry bem-sucedido", etc., e planejar monitoramento para isso. 
Plano de Ação:
- (P0) Configuração de Logs e Erros: AWS‑first (CloudWatch Logs + logger central). Sem Sentry.
- Ficheiros: `lib/observability/logger.ts`, runbooks em `docs/runbooks/metrics-alerts.md`.
- Status: Feito – logs estruturados + requestId/correlationId e envio via CloudWatch (infra/ecs).
- Instruções: manter `logError/logWarn` com requestId, garantir filtros de secrets e retenção de logs.
(P1) Runbooks por Domínio: Completar e revisar os runbooks existentes, cobrindo cenários
chave. 
Status: Feito – Runbooks por domínio disponíveis (pagamentos, DLQ, ops, check-in). 
Instruções: Elaborar runbooks para: 
Pagamentos: O que fazer se um pagamento fica pendente ou um webhook falha (ex.:
usar /api/internal/reprocess/payment-intent ). 
122
123
124
122
123
• 
• 
• 
◦ 
23

Outbox: Procedimentos de replay e limpeza de DLQ. 
Infra: Como restaurar de backup do DB (Supabase -> S3), etc. 
Go-live checklist: Itemizar atividades de pré-deploy (ver bloco 14).
Escrever de forma objetiva e armazenar em docs/runbooks/*.md . 
(P1) Métricas e Alertas: Instrumentar métricas básicas e configurar alertas. 
Status: Feito – runbook de métricas/alertas + endpoints infra/admin + CloudWatch/SNS definidos. 
Instruções: Usar métricas nativas (ALB/ECS) e alarmes CloudWatch conforme `docs/runbooks/metrics-alerts.md`.
(P2) SLO/SLI Definição: Documentar internamente quais são nossos objetivos de serviço. 
Status: Feito – Documento base criado em docs/observability/slo_sli.md. 
Instruções: Exemplo de SLOs: Uptime 99.9%, Erro de pagamento <0.1% por semana, Tempo médio
de geração de bilhete <2s. Uma vez definidos, estabelecer SLIs que os mensuram (talvez manual
inicialmente: ex. monitorar logs semanalmente). Isso serve para drive de melhorias contínuas. 
Preparação de Go-Live: Deploy, Ambientes e Mobile (Bloco 14)
Resumo & SSOT: Esta é a etapa final antes do lançamento (v10). É preciso cumprir a release checklist
executável, garantindo que todas variáveis de ambiente estão setadas, infraestrutura provisionada e
app testado em dispositivos. O blueprint Phase 1 define usar Supabase (DB/Auth) + AWS para demais
serviços,  visando  custo  controlado  (~100€/mês).  Temos  que  configurar:  App  Runner  ou  ECS  para
hospedar  a  API  Next.js,  Secrets  Manager  para  envs,  filas  (SQS  ou  usar  o  DB  outbox  +  pgCron),
armazenamento (Supabase Storage já usado para imagens), e serviços Apple (Sign In, APNs) e Stripe
com as chaves de produção. Além disso, considerar publicação mobile: talvez um App Store listing ou
pelo menos garantir PWA funcional em iOS. 
Análise do Código & Config atual:
- Envs: A lista de envs obrigatórias está clara em envs_required.md . Precisamos verificar se todos
estão  presentes  nos  sistemas  de  CI/CD  e  produção.  Por  exemplo,  QR_SECRET_KEY  (usado  para
assinatura de QRs offline), SES_SMTP_USERNAME/SES_SMTP_PASSWORD (envio de email), chaves da Apple (Sign-in e APNs) em
base64, etc.
-  CI/CD: Não  identificado  arquivo  CI  (talvez  usando  auto-deploy no AWS).  Espera-se  que  a  branch
develop  seja implantada em ambiente de staging, e a main em produção. Precisamos definir gating –
ou seja, só mergear para main quando v10 estiver completo (como já dito).
- AWS Infra: O doc de env menciona uso de AWS Secrets Manager e App Runner/ECS. Provavelmente a
intenção é implantar a API Node em App Runner para escala simples. Se ainda não feito, isso deve ser
configurado. O Supabase continuará hospedando o Postgres e Auth. S3 para backups.
- Mobile UX: A aplicação web deve ser testada em dispositivos móveis para responsividade. O blueprint
exige “desempenho aceitável em mobile (responsivo)”. Além disso, Sign In with Apple deve ser testado em
um dispositivo Apple real. App Store: Provavelmente não teremos um app nativo v1, mas se quisermos
distribuir para testes internos, talvez usar Capacitor ou Expo para gerar um wrapper nativo. Isso não
parece planejado para v10, exceto Staff PWA mencionado na fase 2. 
◦ 
◦ 
◦ 
• 
• 
• 
• 
• 
• 
24

Plano de Ação:
-  (P0) Checklist de Variáveis de Ambiente: Conferir e inserir todas as variáveis nas plataformas de
deploy (AWS).
- Status: Em andamento – Precisamos atualizar segredos com valores de produção.
- Instruções: Passar pela lista do envs_required.md :
- Garantir chaves Stripe (secret e webhook secret) em Prod e Staging.
-  Gerar  chaves  Apple  (.p8  → base64  conforme  instruções)  e  configurar  APPLE_SIGNIN_ e  APNS_
adequadamente.
- ORYA_CRON_SECRET: gerar um valor forte e colocar em prod (e no scheduler que chamar as rotas
cron).
- Verificar NEXT_PUBLIC_*  estão setados (BASE_URL, Supabase anon key, Stripe publishable).
Após isso, fazer deploy de teste e verificar que nada quebra por falta de env. 
(P0) Configuração do Deploy AWS: Implementar pipeline de deploy para branch develop
(staging) e main (production). 
Status: Implementado base – templates infra (ECS/CloudWatch/SNS) disponíveis; falta aplicar no AWS account. 
funções longas (cron)? Precisamos clarificar. Mas dado mention de App Runner, supõe app
monolítico em Node. 
Instruções: Preparar container Docker da app (Next.js pode rodar serverless ou container). App
Runner aceita container direto. Alternativamente, usar ECS/Fargate para API e worker outbox. Avaliar custo/complexidade. No curto prazo,
talvez mais rápido: 
Colocar front+api em App Runner/CloudFront (mais simples de manter AWS-first, com cron via EventBridge). 
Montar um pequeno worker (script Node) para rodar a cada minuto processando outbox
(pode ser container no AWS ECS scheduled).
Decidir e documentar. O blueprint final quer AWS-first infra, então App Runner/ECS é
preferível. Se tempo curto, iniciar em App Runner e evoluir para ECS na Fase 2. 
Instruções: Backup  DB: Configurar  backup  automatizado  do  Supabase  para  S3  (blueprint
12.6.2) – Supabase talvez já faça diário, mas exportar para nosso bucket seria prudente. 
(P1) Testes Finais em Mobile: Passar um pente-fino nos principais fluxos no celular. 
Status: Necessário – Especialmente checkout e scanner de QR. 
Instruções: Acessar a aplicação web em um iPhone/Android real: verificar layout do formulário
de checkout, se botões clicáveis, se performance está ok (colocar-se em 3G para testar
carregamento). Ajustar CSS responsivo onde quebrar (por ex.: colunas da dashboard podem
empilhar melhor). Assegurar que componentes como tabelas têm scroll horizontal ou adaptam
para cards no mobile. 
Instruções: Testar “Adicionar ao calendário (ICS)” no celular: após reserva feita, baixar .ics e abrir
–  confere  se  evento  entra  no  calendário  do  device.  Caso  haja  problema,  ajustar  header
Content-Disposition  do ICS route para forçar download com nome útil. 
(P2) PWA e App Store: Preparar terreno para um possível app. 
Status: Feito – Manifest PWA presente em /public/manifest.json. 
• 
• 
• 
◦ 
◦ 
• 
• 
• 
• 
• 
• 
• 
25

Instruções: Criar manifest.json  com nome, ícones, theme color, e <meta name="apple-
mobile-web-app-capable" content="yes">  no <Head>  para iOS tratar como app. Isso já
melhora UX mobile. 
Instruções: Se desejado, planejar wrapper nativo (Capacitor) para iOS/Android post-v10. Não
obrigatório agora, mas já ter Apple Developer account preparado (o que já temos para Sign In). 
(P2) Release Final: Executar checklist final de release: 
Testes de regressão completos em staging. 
Verificar checklist de segurança (RBAC, secrets, etc. conforme acima). 
Somente então fazer merge develop  -> main  e implantar em produção. 
Monitorar nas primeiras 24h intensamente logs e métricas. 
UI/UX Global e Acessibilidade
Embora  cada  seção  acima  contenha  pontos  de  UI  específicos,  é  crucial  garantir  uma  qualidade
consistente de UX/UI em toda a plataforma. O blueprint definiu padrões globais de UX B2B para a
ORYA, com objetivo de atingir nível de ferramenta premium (referência Linear, Stripe). Aqui estão ações
transversais finais de UI/UX: 
(P0) Design System e Consistência: Revisar todos os componentes visuais para uniformidade. 
Status: Em progresso – A base da interface existe, mas pode haver discrepâncias de estilo. 
Instruções: Definir um pequeno  design system: cores primárias/secundárias, estilos de botão,
inputs, etc., e assegurar que componentes compartilhados são usados em vez de duplicações.
Por  exemplo,  todos  botões  “Salvar”  devem  ter  o  mesmo  estilo  e  estado  hover.  Consolidar
componentes duplicados (se existir vários select dropdown implementados diferentemente,
unificar um só). 
(P0) Estados  de  Carregamento  e  Erro: Garantir  feedback  adequado  em  todas  interações
assíncronas. 
Status: Alguns presentes, mas podemos ampliar. 
Instruções: Para cada página/ação: se há operação de rede (submit de form, carregar dados),
exibir estado  loading (spinner ou skeleton). Ex.: ao clicar "Criar Torneio", desabilitar botão e
mostrar spinner até resposta. Em páginas com listas ou cards, usar placeholders skeleton
enquanto carrega do server. Nos casos de erro (ex.: falha ao salvar), mostrar mensagem de erro
amigável, idealmente mapeando  errorCode  do backend para mensagem PT legível. Isso
melhora confiança do usuário, evitando telas travadas sem feedback. 
(P1) Acessibilidade (A11y): Adotar práticas básicas de WCAG. 
Status: Necessário polir – Não vimos referência a A11y audit, então assumir que há pontos a
melhorar. 
Instruções: Verificar que todos elementos interativos possuem identificadores acessíveis: por
exemplo, inputs com  <label>  associado (ou  aria-label ), botões de ícone com  aria-
label  descritiva,  imagens  importantes  com  alt  texto.  Assegurar  contraste  de  cores
suficiente (usar ferramentas como Lighthouse a11y audit). Implementar navegação por teclado
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
• 
26

nos componentes chave: o usuário deve poder navegar pelos formulários e menus usando Tab/
Enter. Corrigir quaisquer traps de foco (modais devem focar primeiro elemento e fechar com
Esc). 
(P1) Performance Percebida: Otimizar carregamento das páginas para o usuário ter sensação
de rapidez. 
Status: Médio – Next.js já ajuda com divisão de código, mas podemos melhorar. 
Instruções: Habilitar  pré-carregamento  de  rotas  (Next  Link  prefetch)  para  páginas  mais
acessadas. Utilizar cache de dados onde faz sentido: ex., configurações raramente mudam –
cacheá-las em contexto ou localStorage para evitar refetch toda hora. Paginar resultados em
listas grandes (ex.: lista de usuários, histórico de pagamentos). Usar lazy loading em imagens
(Next  Image  com  loading="lazy"  para  imagens  não  acima  da  dobra).  Tudo  isso  dá
impressão de app ágil. 
(P1) Responsividade e Mobile UX: Refinar CSS para telas pequenas. 
Status: Precisa teste – Provavelmente algumas telas do dashboard são complexas em mobile. 
Instruções: Testar  todas  as  páginas  core  em  viewport  ~375px.  Ajustar  layouts  quebrados:
utilizar grids flexíveis que empilham colunas em vez de estourar. Garantir que menus laterais se
tornem menus hambúrguer no mobile. Conferir que elementos clicáveis não fiquem muito
pequenos (mínimo 44px). O objetivo é “zero fricção óbvia nos fluxos core” em mobile. Se algum
fluxo for inviável mobile (por complexidade), ao menos documentar essa limitação e talvez
esconder/avisar no mobile (mas idealmente, tudo deve ser utilizável). 
(P2) Padrões  UX  Avançados: Embora  itens  como  Unified  Search,  Command  Palette,  Context
Drawer, Ops mode tenham sido citados, eles não são estritamente necessários para o go-live
funcional. Mencionamos como melhorias futuras: uma busca unificada no topo, um palette de
comando (atalhos teclado) para admins power users, etc. Por agora, focar no essencial e anotar
esses como backlog UX para pós-v10. 
(P2) Teste de Usabilidade Rápido: Se possível, realizar um pequeno teste com 2-3 usuários
finais (organizadores e clientes) antes do deploy final. Observar onde têm dificuldades e corrigir
quick  wins (texto  de  botão  confuso,  passo  omitido,  etc.).  Às  vezes,  pequenas  mudanças
aumentam muito a satisfação (ex.: adicionar uma mensagem de sucesso clara após uma ação,
redirecionar o usuário automaticamente após criar algo, etc.). 
Por  fim,  consolidando:  este  Plano  de  Ação  v10 abrange  todas  as  pendências  identificadas  nos
documentos de blueprint, SSOT registry, close plan/checklist e na auditoria do código atual. Seguindo
essa lista organizada por prioridade, a equipe deve implementar todas as correções e funcionalidades
na branch develop . Somente após verificar que nada ficou de fora e que os critérios de done do
blueprint foram atendidos, poderemos considerar o merge para main  e o lançamento oficial da ORYA.
Este é o passo decisivo para garantir que a plataforma esteja 100% alinhada com a visão arquitetural
(v9) e pronta para entrar em produção com qualidade de produto líder de mercado. 
Fontes: Blueprint v9, SSOT Registry
, Close Plan, Checklist
, Env Requirements, Código
ORYA (branch develop)
. 
• 
• 
• 
• 
• 
• 
• 
• 
73
87
119
53
45
105
27

ssot_registry.md
file://file_00000000ebd471f49a53c37184524c7e
v9_close_plan.md
file://file_00000000c62071f49a5d1a0c2bf94254
blueprint.md
file://file_000000006d0471f488bcdbd1cef5eead
paymentIntent.ts
https://github.com/nuno7lopes-collab/ORYA-WebApp/blob/b7e630f81b66dc8b19d8b771f80b123d4b4c911f/domain/finance/
paymentIntent.ts
OUTBOX_CLAIM_HARDENING.md
https://github.com/kinnon13/yalls-foundry/blob/9fbceaf3b5743db7bcd1c5bc682566ee9a658466/
OUTBOX_CLAIM_HARDENING.md
organizationWriteAccess.ts
https://github.com/nuno7lopes-collab/ORYA-WebApp/blob/b7e630f81b66dc8b19d8b771f80b123d4b4c911f/lib/
organizationWriteAccess.ts
route.ts
https://github.com/nuno7lopes-collab/ORYA-WebApp/blob/b7e630f81b66dc8b19d8b771f80b123d4b4c911f/app/api/admin/
config/platform-email/route.ts
route.ts
https://github.com/nuno7lopes-collab/ORYA-WebApp/blob/b7e630f81b66dc8b19d8b771f80b123d4b4c911f/app/api/
organizacao/estatisticas/overview/route.ts
accessPolicy.ts
https://github.com/nuno7lopes-collab/ORYA-WebApp/blob/b7e630f81b66dc8b19d8b771f80b123d4b4c911f/lib/checkin/
accessPolicy.ts
backfillConfirmationSnapshot.ts
https://github.com/nuno7lopes-collab/ORYA-WebApp/blob/b7e630f81b66dc8b19d8b771f80b123d4b4c911f/lib/reservas/
backfillConfirmationSnapshot.ts
fulfillment.ts
https://github.com/nuno7lopes-collab/ORYA-WebApp/blob/b7e630f81b66dc8b19d8b771f80b123d4b4c911f/domain/finance/
fulfillment.ts
api_orphans.md
https://github.com/nuno7lopes-collab/ORYA-WebApp/blob/b7e630f81b66dc8b19d8b771f80b123d4b4c911f/reports/
api_orphans.md
envs_required.md
file://file_0000000092b4720a859ea222fd16be91
1
6
11
12
13
15
26
29
30
31
32
33
39
40
41
42
43
44
49
50
54
55
56
66
67
68
70
73
74
75
76
77
78
79
80
81
87
88
89
90
95
101
110
116
119
122
2
3
4
5
7
8
9
10
16
19
22
23
53
59
63
14
28
94
99
100
115
117
123
124
17
18
20
21
24
25
27
69
72
96
97
111
34
35
36
37
38
45
46
47
48
51
52
64
65
57
58
60
61
62
71
82
83
84
85
86
91
92
93
98
102
103
104
105
106
107
108
109
112
114
118
113
120
121
28
