1. Controlo de versao e como usar
Objetivo: juntar num unico PDF o plano operacional e o plano Padel, garantindo que Padel e tratado
como SSOT (source of truth) e que as decisoes finais estao fechadas.
Versao Data Alteracoes-chave
v1.0 03/02/2026 Primeira versao unificada. Inclui: decisoes finais fechadas, plano operacional revisto
(alinhado com Padel), e anexo com Plano Padel original.
Regra de precedencia (para evitar contradicoes):
0) `docs/ssot_registry.md` e o SSOT global do sistema.
1) `docs/blueprint.md` e o blueprint global (v9).
2) Secao 2 (Decisoes finais fechadas) e a fonte de verdade para pontos decididos aqui, desde que
   nao conflite com o SSOT/blueprint acima.
3) Capitulo Padel (anexo) e SSOT para tudo o que e Padel (modelo, UX, fases, DoD), exceto onde a Secao 2
   diz explicitamente que houve atualizacao.
4) O resto do plano operacional (Secoes 4 e 5) governa produto/ops fora de Padel e as regras transversais
   (Agora, Rede, Checkout, Transferencia, runbooks).
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 2 de 17
2. Decisoes finais (fechadas)
Estas decisoes fecham pontos pendentes e removem ambiguidade. Sempre que um PDF original
disser algo diferente, prevalece esta secao.
Tema Decisao final Notas de implementacao (para ficar perfeito)
Reembolsos
(Padel)
Reembolso ao utilizador = valor
pago - processing fees
Stripe normalmente nao devolve fees do pagamento
original. Guardar fees no momento do charge
(PaymentIntent/Charge) e mostrar breakdown no UI
(transparencia).
Troca de parceiro Permitida apenas antes do
parceiro pagar
Se o parceiro ja iniciou checkout mas nao concluiu,
cancelar/expirar sessao e reemitir convite. Notificar
parceiro removido.
Convite / aceitacao O parceiro tem de aceitar o
convite. Apos aceitar, fica
pendente pagamento.
Sem aceitacao nao existe dupla valida. Aceitacao gera
rastro de auditoria (quem/quando).
Capitao pagar
divida
Apos parceiro aceitar, o capitao
pode pagar a parte pendente a
qualquer momento e confirmar a
dupla.
Evitar duplo pagamento: quando capitao cobre 100%,
bloquear pagamentos futuros do parceiro e fechar o
estado como CONFIRMED.
Prazos 48h/24h T-48 e T-24 sao relativos ao
inicio do torneio (timezone do
torneio).
Definir tournamentStartAt (timezone). T-48 = startAt - 48h;
T-24 = startAt - 24h. Reminders podem existir em T-36 e
T-23.
Perfil / genero Genero obrigatorio: Masculino ou
Feminino (pode alterar nas
definicoes).
Validacao frontend + fallback backend para impedir perfis
sem genero apos onboarding (Padel).
Mistos Default estrito (1 homem + 1 mulher).
Pode existir opcao “misto livre” com aviso explicito; default mantem-se estrito.
Capacidade
adaptativa
Ativar calculo de capacidade
recomendada (warnings, nao
hard-limit).
Mostrar avisos no wizard e no auto-schedule, sem
bloquear publicacao. Guardar logs para aprendizagem.
Escopo Este fluxo aplica-se a torneios
Padel (inscricoes), conforme
Plano Padel.
Nao confundir com reservas de court classicas. Regras
de split/MM so para torneios.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 3 de 17
3. Integracao e mapeamentos (para evitar buracos)
Esta secao liga o plano operacional ao SSOT de Padel e define mapeamentos que evitam maquinas
de estado paralelas ou interpretacoes diferentes entre equipas.
3.1 Mapa de estados (Padel)
Dominio Padel usa os estados canonicos do Plano Padel: PENDING, CONFIRMED, WAITLISTED,
CANCELLED, REFUNDED. Sub-estados internos sao 'razoes' auditaveis (nao substituem o estado).
Estado de dominio
(UI/negocio)
Descricao SSOT Razoes / sub-estados internos
(exemplos)
PENDING Capitao pagou; parceiro ainda nao (ou
aceitacao pendente). Nao conta para
lotacao.
PENDING_PARTNER_ACCEPT;
PENDING_PARTNER_PAYMENT;
WINDOW_1H_OPEN
CONFIRMED Ambos pagos (ou capitao cobriu 100%).
Conta para lotacao.
PAID_SPLIT; PAID_BY_CAPTAIN;
FROM_MATCHMAKING
WAITLISTED Tentou confirmar sem vaga; fica em fila
por categoria.
WAITING_SLOT;
SLOT_FREED_NOTIFICATION_SENT
CANCELLED Cancelamento automatico por regras (ex.:
T-24, incompatibilidade) ou manual
(organizador).
EXPIRED_T24; ODD_MATCHMAKING;
ADMIN_CANCELLED
REFUNDED Reembolso processado (sempre via
Stripe).
REFUND_MINUS_FEES;
REFUND_FAILED_RETRYING
3.2 Linha temporal 48h/24h (ancora: inicio do torneio)
• T-48h: verificar duplas em PENDING (parceiro nao pagou). Notificar ambos e abrir janela de 1h
para regularizar.
• T-48h + 1h: se nao regularizou, entra em fluxo de matchmaking ate T-24h (por categoria).
• T-36h e T-23h: reminders (comunicacao). Nao mudam regras, apenas reduzem no-shows e
surpresas.
• T-24h: fechar matchmaking. Tudo o que ficar impar/incompativel e cancelado + reembolsado
(menos fees).
• Durante a janela: capitao pode trocar parceiro (antes do parceiro pagar) ou pagar a divida (apos
aceitacao) para confirmar.
Nota: o wizard de torneio continua a ter inscriptionDeadlineAt (campo do modelo). Por defeito, deve ser
coerente com T-24 (startAt - 24h). Se o organizador alterar, o sistema deve avisar e bloquear configuracoes
que criem estados impossiveis.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 4 de 17
4. Plano operacional (revisto e alinhado com Padel)
Esta secao e uma versao consolidada do plano operacional, com os pontos Padel alinhados ao
Plano Padel (SSOT) e as decisoes finais acima.
4.1 Regras formais de produto (fechadas)
4.1.1 Agora (Live / no contexto)
Objetivo: quando o utilizador esta num evento (tem entitlement), o Agora vira o hub vivo do evento.
• Entrada no Agora: se o utilizador tem entitlement para um evento ativo -> mostrar Evento Live
como aba/section dominante. Se nao tem entitlement -> pode ver lives publicas e visoes limitadas
conforme politica do evento/organizacao (sem chat/sem dados privados; so conteudo publico).
• Conteudo do Agora: no caso canonico (torneio Padel) mostrar proximo jogo, contra quem, perfis
dos oponentes, quadro/horarios, status, notificacoes e chat do evento. A grelha depende do tipo
de evento (modulos plugaveis).
• Chat do evento: por defeito so participantes (entitlement) podem falar.
• Fonte de verdade operacional: tudo o que e estado vivo deve ser consistente com EventLog/Ops
Feed (Outbox e transporte).
4.1.2 Rede (Social) - um diferencial
Objetivo: transformar ORYA numa rede social utilitaria (atividade + relacoes + comunicacao).
• Social e core: entra ja no MVP iOS como slice funcional (mesmo que v1 simples).
• Componentes minimos: feed de atividade (amigos + clubes + participacao), seguir amigos e
clubes, perfis (user + organizacao), mensagens e grupos.
4.1.3 Checkout (universal, adaptativo, nativo)
• Um unico checkout universal para eventos / reservas / loja / servicos, adaptado ao vertical.
• 100% nativo no iOS (sem webview) - experiencia como grandes plataformas.
• Resume checkout: se o utilizador sair a meio, guardar por 10 minutos e permitir retomar.
4.1.4 Split payments (Padel e core)
Padel segue o SSOT do Plano Padel (Capitulo 7). Aqui ficam apenas as regras operacionais de alto
nivel e as decisoes fechadas.
• No ato de inscricao em torneio Padel: switch 'Pago tudo' vs 'Split'.
• Se Split: capitao paga e reserva (cria PENDING). O parceiro tem de aceitar o convite e, apos
aceitar, fica pendente pagamento.
• Capitao pode: (a) trocar parceiro (apenas antes do parceiro pagar), (b) pagar a divida pendente do
parceiro (apos aceitacao) e confirmar, (c) mudar de modo respeitando regras e auditoria.
• Janela temporal deterministica (ancora: inicio do torneio): T-48/T-24 com reminders (T-48, T-36,
T-24, T-23) e consequencias automaticas.
• Em T-24: tudo o que nao ficar CONFIRMED e cancelado e reembolsado automaticamente (menos
processing fees), com auditoria obrigatoria.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 5 de 17
• Matchmaking: por defeito automatico (sem aprovacao), mas manter capacidade de aprovacao por
evento.
4.1.5 Transferencia / revenda (seguranca maxima)
• Transferencia/revenda permitida.
• Confirmacao dupla obrigatoria: vendedor confirma por codigo (email) e recetor confirma por
codigo (email).
• Politica por evento: definida na criacao do evento e fica lock depois de criado (sem mudar a meio).
Pode permitir transferir so antes de esgotar, transferir sempre, bloquear totalmente, ou permitir
revenda so via fluxo oficial.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 6 de 17
4.2 Estrutura de screens (Web + iOS)
4.2.1 Web (nucleo operacional + superficies completas)
• Publico / Discovery: Discover (eventos / padel / servicos) + paginas publicas + widgets publicos;
detalhe de evento/torneio + lives publicas (quando aplicavel).
• Conta (B2C): Perfil; Compras / Carteira; Bilhetes; Reservas; Historico e beneficios.
• Organizacao (B2B Ops): Reservas; Eventos; Padel; CRM; Financas; Loja; Staff; Settings;
Check-in / monitor / live.
• Admin: Pagamentos, payouts, refunds; Infra, utilizadores.
4.2.2 iOS (100% user)
• Discover (tabs Padel/Eventos/Servicos + feed combinado personalizado)
• Agora (hub live + lives publicas)
• Rede (feed social + mensagens + grupos)
• Wallet (bilhetes / inscricoes / reservas)
• Perfil (perfil + settings)
• Search global: Discover + Utilizadores + Organizacoes
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 7 de 17
4.3 Backlog por prioridade (com Definition of Done por EPIC)
P0 - iOS MVP (User Core) - tem de sair impecavel
EPIC P0.1 Auth + Onboarding perfeito
• Apple + Google (e restante conforme ja suportado) + magic link (sim).
• Onboarding completo skippable (o essencial nao; o resto sim), com pedido de localizacao no fim e
'perto de mim' a re-pedir permissao sem bloquear.
• Essencial inclui: identidade minima + genero (M/F) para suporte Padel.
DoD
• 0 dead-ends; regressao coberta; estados loading/erro/empty consistentes; deep link pos-login
funciona.
EPIC P0.2 Discover + Personalizacao
• Sub-tabs Padel/Eventos/Servicos + feed combinado personalizado.
• Filtros MVP (cidade/data/preco/categoria).
• Ordenacao: relevancia + distancia (perto de mim).
DoD
• Logica 'perto de mim' funciona sem permissao (fallback) e com permissao (distance rank). Sem
crashes em listas longas.
EPIC P0.3 Evento (detail) + Checkout nativo universal
• Evento mostra bilhetes/inscricoes e entra em checkout.
• Checkout universal adaptativo + resume 10 min.
• Pagamentos nativos: Apple Pay + cartao (e o resto quando fizer sentido).
DoD
• E2E: discover -> checkout -> entitlement -> wallet confirmado; idempotencia (nao duplica) e sem
dead-ends.
• Performance: sem bloqueios; fallback/erro claros.
EPIC P0.4 Wallet (Bilhetes/Inscricoes/Reservas)
• Um sitio unico, unidades separadas.
• Historico e critico (entra ja).
DoD
• Estado canonico por item; QR/check-in ready (mesmo que check-in seja fase seguinte no iOS).
EPIC P0.5 Perfil + Settings
• Foto, nome, username, bio, cidade, nivel padel (botao), eventos passados e proximos.
• Settings: idioma, notificacoes, privacidade.
DoD
• Atualizacoes refletidas imediatamente; validacoes consistentes.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 8 de 17
EPIC P0.6 Push + Email
• Triggers MVP: novos eventos relevantes, alteracoes, reminders, compra confirmada.
• Email alem de push: sim.
DoD
• Preferencias respeitadas; logs; sem spam; retries via Outbox.
P1 - Agora v1 (diferencial live)
EPIC P1.1 Agora Hub + Evento Live
• Se entitlement: mostrar hub (proximo jogo, horarios, oponentes, etc.).
• Sem entitlement: lives publicas com vista limitada.
DoD
• Conteudo sincroniza com estado do evento; permissoes certas; sem leak de info privada.
EPIC P1.2 Chat do evento
• Apenas participantes falam.
DoD
• Moderacao minima (rate limit + abuse); auditoria; bloqueios.
P2 - Rede v1 (social core)
EPIC P2.1 Social Graph
• Follow amigos + clubes.
DoD
• Privacidade basica; bloqueio/denuncia; anti-spam.
EPIC P2.2 Feed de atividade
• Amigos + clubes + participacao.
DoD
• Ordenacao estavel; sem duplicados; eventos de feed idempotentes (EventLog como base).
EPIC P2.3 Mensagens + Grupos
• Mensagens diretas e grupos (v1).
DoD
• Entrega confiavel; bloqueio; quotas; notificacoes; retries via Outbox.
P3 - Padel (melhor que o mercado)
Os detalhes (UX alvo, modelo, fases, algoritmos, DoD) estao no Plano Padel (Capitulo 7). Aqui ficam
os EPICs operacionais para o backlog global.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 9 de 17
EPIC P3.1 Split Payments perfeito
• Switch pago-tudo vs split.
• Troca parceiro (antes do parceiro pagar) + pagar divida pendente (apos aceitacao).
• Janela 48/24 + reminders + consequencias automaticas.
DoD
• Estados deterministicos; expiracao e refunds corretos; auditoria; sem inconsistencias no ledger
(financas deterministica).
EPIC P3.2 Matchmaking
• Automatico por defeito; opcao com aprovacao por evento.
• Compatibilidade sempre por categoria (tipo+nivel), com preferencia de lado como soft.
DoD
• Sem buracos (vaga sempre resolve em T-24); logs e replay seguros; nunca mistura categorias.
P4 - Transferencia / Revenda (seguranca maxima)
EPIC P4.1 Transferencia com confirmacao dupla
• 2 codigos (vendedor + recetor).
• Politica por evento lock.
• Trilha de auditoria.
DoD
• Sem transferencias acidentais; provas por audit log; replays seguros.
P5 - Web polish (perfeicao operacional)
EPIC P5.1 Form states + consistencia global
• Loading/empty/error/success canonicos em areas criticas.
DoD
• Zero variacoes; componentes reusaveis; A11y ok.
EPIC P5.2 Checkout performance & consistencia
• Stripe lazy load; componentes menores; zero dead-ends.
DoD
• Budget de performance; testes E2E.
EPIC P5.3 Kill legacy + cobertura API<->UI
• Remover rotas antigas; inventario fechado.
DoD
• Sem rotas antigas; cobertura API<->UI; regressao controlada.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 10 de 17
4.4 Onde temos de ser melhores que o mercado
4.4.1 Padel / Split
Referencia de mercado: Playtomic descreve split/single e responsabilidades, mas o fluxo e linear.
ORYA ganha com determinismo + swap + MM + auditoria.
• Partner swap (antes do parceiro pagar) + cancelamento limpo de convites e sessoes.
• Capitao pode cobrir 100% apos aceitacao (evita friccao e reduz falhas).
• Janela deterministica 48/24 + matchmaking integrado + auditoria/refunds automaticos (menos
fees).
4.4.2 Social utilitario (Rede + Agora)
• Hub live + social graph + mensagens + grupos numa so identidade/entitlement.
• Conteudo condicionado por entitlement + politicas (sem leak).
4.4.3 Resume checkout
• Resume 10 min, cross-surface (voltar do evento, push, deep link).
4.4.4 Seguranca e fail-closed
• Operacao: runbooks e incident playbook - nunca editar ledger/eventlog/outbox a mao; replays
controlados; endpoints internos com secret.
• Mobile: transferencia/revenda com confirmacao dupla + politicas lock por evento.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 11 de 17
5. Roadmap operacional (fases) - plano final para o Codex
As fases abaixo sao o macro-roadmap. Para Padel, a execucao detalhada segue as FASES 0-8 do
Plano Padel (Capitulo 7).
Fase 0 - Preparacao e guardrails (1 sprint)
UX
• Definir design system e estados canonicos (discover, wallet, agora, rede).
Backend
• Congelar contratos internos versionados (sem API publica externa).
• Garantir financas deterministica como principio (idempotencia + ledger SSOT).
Integracoes
• Apple V1: Sign in with Apple, APNs token-based, universal links.
Criterios de aceitacao
• Operability gate minimo definido (logs, requestId, erros padronizados).
Fase 1 - iOS MVP (1-2 sprints)
UX
• Onboarding perfeito (skips, permissao localizacao no fim).
• Discover (tabs + ranking relevancia/distancia).
• Checkout universal (create/confirm/resume) e Wallet (historico).
• Perfil (view/update) com genero (M/F) e nivel padel.
Backend
• Endpoints para discover, evento detail, checkout, wallet e perfil.
• Observabilidade minima: requestId, logs e erro padronizado.
Integracoes
• Pagamento iOS: Apple Pay + cartao (Stripe PaymentSheet).
• Push: APNs + device token store + preferencias.
• Deep links: universal links para evento/checkout/wallet.
Criterios de aceitacao
• E2E crash-free: login -> discover -> evento -> checkout -> wallet (sem duplicar charges).
• Resume checkout: retoma em <10 min e expira corretamente.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 12 de 17
Fase 2 - Agora v1 (1 sprint)
UX
• Agora: estados (sem entitlement vs com entitlement).
• Modulos por tipo (torneio Padel como primeiro).
Backend
• Live payloads por evento (proximo jogo, schedule, oponentes).
• Permissoes: entitlement gates + politicas por evento.
• Realtime: polling eficiente ou websockets (com fallback).
Criterios de aceitacao
• 0 leaks: utilizador sem entitlement nao ve dados privados.
• Latencia aceitavel e estavel em eventos ativos.
Fase 3 - Rede v1 (1-2 sprints)
UX
• Follow, feed, perfil (user/org), mensagens e grupos.
Backend
• Social graph + feed generator (EventLog como base; Outbox transporte).
• Anti-spam: rate limits, bloqueios, denuncias.
Integracoes
• Push para mensagens/menções/atividade.
Criterios de aceitacao
• Feed consistente, ordenacao estavel, sem duplicados.
• Mensagens entregues e notificadas com retries.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 13 de 17
Fase 4 - Padel 'perfeito ja' (ver Plano Padel para detalhe)
UX
• Implementar o Padel Hub web (tabs fixas) e o wizard de torneio (DRAFT->PUBLISHED).
• Fluxo de inscricao por categoria: ja tenho parceiro vs matchmaking.
• Area da dupla: estado PENDING/CONFIRMED/WAITLISTED e acoes (swap, cancelar, entrar/sair
MM).
Backend
• Maquina de estados deterministica (estados de dominio do Plano Padel).
• Jobs: T-48 (janela 1h) e T-24 (fecho MM, cancelamentos e refunds).
• Auditoria: todas as transicoes e overrides ficam registadas.
• Refund automatico via Stripe: reembolsar menos processing fees (decisao final).
Integracoes
• Stripe Checkout (web) + webhooks idempotentes; PaymentSheet (iOS) para flows nativos quando
aplicavel.
• Notificacoes: push + email (convite, lembretes, 1h, fecho 24h, confirmacao, waitlist, reembolso).
Criterios de aceitacao
• Cenarios criticos: (1) parceiro nao paga -> regra T-48/T-24 aplicada; (2) capitao troca parceiro
antes de pagar -> estado consistente; (3) capitao cobre 100% apos aceitacao -> confirma sem
race; (4) matchmaking resolve ou cancela em T-24 sem buracos.
Fase 5 - Transferencia/Revenda segura (1 sprint)
UX
• Fluxo de transferencia com dupla confirmacao + estado pendente.
Backend
• Tokens de confirmacao (vendedor + recetor) + expiracao + auditoria.
• Politica lock por evento.
Criterios de aceitacao
• Sem transferencias acidentais; provas por audit log; replays seguros.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 14 de 17
Fase 6 - Hardening (continuo; fecha perfeicao)
UX
• Web: form states canonicos + A11y + performance budgets; remover legacy.
Backend
• DLQ, runbooks, incident playbook, rollback plano (sem mexer manualmente em
ledger/eventlog/outbox).
• Operability checklist PASS antes de go-live.
Integracoes
• Analytics: fechar ferramenta (PostHog/Amplitude/GA) e ligar eventos.
Criterios de aceitacao
• Runbooks e checklist operacionais aprovados; replays controlados; monitorizacao minima em
producao.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 15 de 17
6. Pendencias e notas de melhoria
Itens abaixo aparecem como placeholders nos PDFs originais ou como decisoes ainda abertas.
Mantemos aqui para nao se perderem, mas sem bloquear o que ja esta fechado.
• Fechar docs(ssot): close gaps B-E (contratos, estados canonicos e eventlog/outbox).
• Adicionar docs(ops): operability checklist e incident mini-playbook.
• Fechar estrategia de realtime (polling vs websockets) com fallback, por tipo de evento.
• Regra 'mistos': default estrito; opcao “misto livre” com aviso explicito.
• Troca de parceiro apos ambos pagos: exigir confirmacao de ambos; reembolso so quando novo parceiro pagar.
• Afinar formula e UX do warning de capacidade adaptativa (sem bloquear).
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 16 de 17
7. Capitulo Padel (SSOT) - documento original anexado
As proximas paginas sao uma reproducao integral do PDF 'plano padel .pdf'. Este capitulo e a
referencia principal (SSOT) para Padel (UX alvo, modelo de dados, fases, integracoes e Definition of
Done).
Atualizacoes (decisoes finais) a aplicar durante implementacao, mesmo que o texto original diga
diferente:
• Reembolsos: onde o plano original disser 'sem taxas', aplicar 'reembolso menos processing fees'.
• Ancora temporal: T-48/T-24 sao relativos ao inicio do torneio (timezone do torneio).
• Split com parceiro: parceiro tem de aceitar convite; apos aceitar, capitao pode cobrir 100% a
qualquer momento para confirmar.
Fim da parte revista. A partir da proxima pagina, segue o Plano Padel original.
Plano Unificado ORYA - Parte A (revisto) - v1.0 - 03/02/2026 Pagina 17 de 17
0) SSOT de produto (já fechado)
0.1 Regras de perfil / género
● Onboarding obrigatório: perfil tem de escolher Masculino ou Feminino, com
possibilidade de alterar nas definições. (O modelo já tem gender e campos Padel
no Profile.)
● Matchmaking filtra SEMPRE por categoria = (tipo + nível); “lado”
(direita/esquerda) é preferência suave (não bloqueia). (Campos já existem:
padel_level, preferred_side.)
0.2 Nível do jogador
● Nunca bloqueia inscrição. Apenas informativo + pode mostrar avisos (sem
impedir).
0.3 Matchmaking / lista de espera
● Unidade de contagem é a dupla (confirmada). Duplas de matchmaking formam-se
assim que há 2 compatíveis, e passam a contar como “dupla” para fila/lotação.
0.4 Pagamentos (split payment)
● Capitão paga e reserva; parceiro tem até 48h antes para pagar.
● Se parceiro não pagar até 48h: ambos notificados; capitão tem 1h para regularizar;
senão entra em fluxo: matchmaking até 24h antes; a 24h fecha e o que ficar
incompatível/ímpar é cancelado + reembolsado via Stripe (menos processing fees).
0.5 Limites / lotação
● “Pending” não conta para lotação; se não houver vaga quando confirmarem, ficam
em lista de espera.
● Limite recomendado por categoria é “adaptativo” (não fixo) e gera warnings,
sem bloquear publicação.
1) Fundamentos técnicos (para Codex não inventar
nada)
1.1 Stack e padrões já existentes
● App usa Next.js (App Router / NextResponse) e endpoints em app/api/...
● Auth/identidade via Supabase server client (createSupabaseServer,
ensureAuthenticated).
● DB via Prisma (prisma).
● Padrão novo: respostas API com envelope (jsonWrap, withApiEnvelope).
1.2 Inventário real de rotas Padel já no repo (para reaproveitar)
Há endpoints Padel específicos já listados (players, calendar, matches, auto-schedule,
live/sse, onboarding, etc.).
E já existe base /api/padel/calendar (GET/POST/DELETE) no inventário (ver docs/v9_inventory_api.md).
2) UX alvo (estrutura final obrigatória)
2.1 Layout “Padel Hub” com tabs fixas
● Header fixo: título “Padel”, seletor de torneio (quando aplicável), estado
(DRAFT/PUBLISHED/LIVE/FINISHED), e botão “Criar torneio” sempre visível.
● Tabs fixas (sem sub-subnav):
1. Criar torneio
2. Torneios
3. Calendário
4. Gestão
5. Jogadores
2.2 Princípios UX (para evitar os problemas atuais)
● Matchmaking é sempre por categoria (tipo+nivel), nunca “global do torneio”.
● Avisos (nível, conflitos de agenda) nunca bloqueiam, só informam, com override
admin/organizador.
3) Modelo de dados (backend) — o que tem de existir
“perfeito”
3.1 Estados de inscrição
Usar e estender o estado já previsto para inscrições Padel: PENDING, CONFIRMED,
CANCELLED, WAITLISTED, REFUNDED.
Regras SSOT:
● PENDING: capitão pagou, parceiro ainda não → não conta para lotação.
● CONFIRMED: ambos pagos → conta para lotação.
● WAITLISTED: dupla/jogador aguardando vaga (por falta de lotação quando tentou
confirmar).
● CANCELLED/REFUNDED: saídas automáticas do fluxo 48h/24h e incompatibilidades.
3.2 Entidades mínimas (tudo auditável)
● Tournament (com format, config, inscriptionDeadlineAt) + Event
associado.
● Category = (tipo + nível) (e regras de género: masc/fem/mistos se aplicável).
● Registration/Pair (capitão+parceiro) + Payment intents + Webhooks Stripe.
● Waitlist (fila por categoria) e MatchmakingQueue (fila por categoria).
4) Plano por fases (tarefas + UX + backend +
integrações + aceitação)
FASE 0 — “Hardening” de fundações (1º PR)
Objetivo: garantir que Padel segue padrões de segurança/permissões/envelope e que a
navegação fica estável.
Tarefas (backend)
● Garantir que todos os endpoints Padel usam withApiEnvelope/jsonWrap
(padrão repo).
● Garantir autenticação/papeis em endpoints sensíveis (padrão
ensureAuthenticated + permissões).
Tarefas (UX)
● Criar “shell” do Padel Hub com tabs fixas e roteamento consistente (sem
sub-subnav).
Critérios de aceitação
● Todas as rotas API Padel respondem com envelope padrão.
● Sem sessão → 401 consistente; sem permissões → 403 consistente.
● Tabs Padel aparecem sempre e não existe sub-subnav.
FASE 1 — Navegação final + rotas (UX e IA “definitivo”)
Objetivo: acabar com a confusão atual e deixar Padel com “uma casa” única.
UX
● Implementar /organizacao/padel como entrada única.
● Tabs:
○ Criar torneio (wizard)
○ Torneios (lista + filtros)
○ Calendário (agenda por courts/slots)
○ Gestão (settings)
○ Jogadores (diretório + perfis)
Backend
● Ajustar links internos para apontar para a casa Padel (sem “atalhos” que criem
loops).
● Garantir que páginas que hoje vivem em torneios/eventos ficam “embedadas”
no Hub (ou re-roteadas com parâmetros).
Integrações
● Permissões por role: OWNER/ADMIN/STAFF e módulos (padrão
ensureMemberModuleAccess).
Critérios de aceitação
● Existe 1 URL “canónica” por vista (sem duplicados).
● Navegação consistente: back/forward do browser não perde tab/estado.
● Permissions: STAFF sem EDIT não consegue editar torneio/config.
FASE 2 — Criar torneio (Wizard) + DRAFT → PUBLISHED
Objetivo: criação perfeita, sem estados impossíveis.
UX (wizard)
1. Base: nome, datas, local/clube (com override “sem clube” se permitido), timezone
2. Formato único por torneio (default) + opção discreta para override por categoria (não
default). Default mantém-se formato único.
3. Categorias: (tipo + nível), preço, deadlines, regras de inscrições
4. Courts/agenda: duração jogo, intervalo, janelas, regras de atraso
5. Publicação: validações finais + pré-visualização
Backend
● Endpoints de create/update tournament/config (padrão “PATCH tournament”).
● Persistir format, config, inscriptionDeadlineAt.
Critérios de aceitação
● DRAFT pode ser guardado incompleto.
● PUBLISHED exige validações mínimas (categorias, preços, deadlines, courts/slots
ou regra de geração).
● Alterar formato depois de haver inscrições CONFIRMED dispara aviso forte + exige
confirmação admin.
FASE 3 — Inscrições + split payment + waitlist (core crítico)
Objetivo: “pagou → tem slot”, sem conflitos, e com lista de espera a funcionar como tu
queres.
UX
● Fluxo de inscrição por categoria:
○ escolher “já tenho parceiro” ou “matchmaking”
○ checkout do capitão → cria PENDING
○ parceiro recebe link/pedido → paga → vira CONFIRMED
● “Área da dupla”:
○ estado: PENDING/CONFIRMED/WAITLISTED
○ ações: trocar parceiro (permitido antes do parceiro pagar), cancelar, entrar
em matchmaking (janela 48h→24h)
Backend
● Máquina de estados em Registration:
○ PENDING não conta; CONFIRMED conta; sem vaga quando confirmar →
WAITLISTED.
● Implementar cron/worker (ou job) para:
○ T-48h: verificar parceiros não pagos → abrir janela 1h regularização; senão
transição para matchmaking/fluxo.
○ T-24h: fechar matchmaking → cancelar/reembolsar incompatíveis.
● Reembolsos via Stripe (sem wallet monetária; loyalty/pontos ok) e menos processing fees.
● Lista de espera por categoria: entra quando tenta confirmar sem vaga.
Integrações
● Stripe Checkout + webhooks para atualizar estados (idempotente).
● Notificações (email/push) para: pedido de pagamento, lembrete 48h, janela 1h, fecho
24h, confirmação, reembolso.
Critérios de aceitação
● Pagamento do capitão cria PENDING e não bloqueia inscrições de outras
categorias.
● Parceiro paga → vira CONFIRMED e ocupa vaga; se não houver vaga →
WAITLISTED.
● A 48h: se parceiro não pagou, ambos recebem aviso; após 1h aplica regra decidida.
● A 24h: matchmaking fecha; todos os casos ímpares/incompatíveis são
reembolsados e removidos automaticamente.
● Tudo idempotente (webhooks repetidos não duplicam inscrição).
FASE 4 — Matchmaking “perfeito” (por categoria) + override organizador
Objetivo: formar duplas automaticamente e permitir ao organizador corrigir sem partir
consistência.
UX
● Vista por categoria:
○ fila de matchmaking (jogadores)
○ duplas formadas automaticamente
○ “swap” admin: trocar jogadores entre 2 duplas (override)
● Preferências:
○ lado (direita/esquerda) = “soft preference”
○ nível = só aviso
Backend
● Algoritmo:
○ pool por categoria (tipo+nivel)
○ quando 2 compatíveis → cria dupla e marca CONFIRMED se ambos pagos /
ou mantém PENDING conforme pagamentos
● Logs/audit: toda ação de override fica auditada (quem fez, quando, antes/depois).
Critérios de aceitação
● Nunca mistura categorias (tipo+nivel).
● Dupla é criada automaticamente ao encontrar 2 compatíveis (sem intervenção).
● Override admin não pode criar estado impossível (ex.: duplicar jogador em 2 duplas).
FASE 5 — Auto-schedule + capacidade + conflitos (ponto 11)
Objetivo: gerar calendário sem conflitos e com regras realistas (duração, intervalos, courts).
UX
● “Gerar calendário” (auto-schedule) com:
○ inputs: duração jogo, intervalo, janelas de início/fim, courts disponíveis
○ preview de slots + alertas (ex.: “capacidade recomendada excedida”)
○ botão “Aplicar”
● Avisos de conflito de agenda do jogador (não bloqueia; admin pode permitir).
Backend
● Usar endpoints já previstos para calendário/auto-schedule (há rotas Padel e
auto-schedule no inventário).
● Motor de agenda deve respeitar hierarquia de “bloqueios” (para evitar conflitos):
HardBlock > MatchSlot > Booking > SoftBlock.
Decisão fechada
● Limite recomendado adaptativo por categoria: sugerir máximos por categoria com
base em (courts * janela_tempo_total) / (duração_jogo + intervalo) e nº de rondas
do formato. Não é hard-limit; é “recommended + warning”.
Critérios de aceitação
● Auto-schedule nunca cria 2 matches no mesmo court/slot.
● Alterar duração/intervalo recalcula capacidade e mostra warning.
● Conflitos de jogador aparecem como warning; admin pode override.
FASE 6 — Live + Monitor (operacional no dia do torneio)
Objetivo: gestão em tempo real: resultados, atrasos, walkovers, estados.
UX
● Monitor (por courts):
○ próximo jogo por court
○ estado: chamado / em jogo / terminado / atraso
○ ações: inserir score, marcar desistência/derrota, adiar jogo, mover court
(admin)
● Live (público/participantes):
○ resultados em tempo real, bracket/tabela, próximos jogos
Backend
● Atualizações em tempo real via endpoint live (inventário inclui
/api/padel/live/... e SSE).
● Endpoint de atraso de match existe no inventário.
● Regras de “desistência vs derrota”: desistência conta como derrota (walkover) no resultado final.
Critérios de aceitação
● Inserir score atualiza bracket/tabela imediatamente.
● Atraso move horários seguintes conforme regra do torneio (ou marca conflito).
● “Walkover/desistência” fecha match de forma consistente e audita.
FASE 7 — Gestão (clube, staff, settings, formatos, regras)
Objetivo: permitir ao organizador configurar tudo sem mexer em código.
UX
● Gestão do torneio:
○ regras (tie-break, sets, etc.) com defaults e overrides
○ staff/permissões (quem pode fazer override, editar calendário, etc.)
○ comunicação (notificações em massa)
● Gestão do clube:
○ courts, horários, bloqueios (hard/soft), preços
Backend
● Persistência de regras no tournament.config.
● Permissões: só roles autorizadas podem editar (padrão
ensureMemberModuleAccess).
Critérios de aceitação
● Tudo o que altera estado operacional (calendário/duplas/scores) exige role
apropriada.
● Alterações críticas pedem confirmação e ficam auditadas.
FASE 8 — Jogadores (CRM + perfis + diretório)
Objetivo: unificar jogador (CRM) com o Padel (nível, lado, histórico, warnings).
UX
● Diretório de jogadores por clube/organização:
○ filtros: género, nível (informativo), histórico, no-shows
● Perfil:
○ género (sempre M/F), nível, lado preferido, estatísticas
Backend
● Garantir que Profile.gender é obrigatório no onboarding (validação frontend +
fallback backend).
● Guardar histórico de inscrições/matches por jogador.
Critérios de aceitação
● Não existe perfil sem género (M/F) após onboarding.
● Matchmaking usa sempre categoria e nunca bloqueia por nível.
5) Integrações (checklist obrigatório)
Stripe (pagamentos e reembolsos)
● Checkout capitão + link parceiro + webhooks idempotentes.
● Reembolsos sempre via Stripe (sem wallet monetária; loyalty/pontos ok).
Notificações
● Templates para: convite parceiro, lembrete 48h, janela 1h, fecho 24h, confirmação,
waitlist, vaga libertada, reembolso.
Supabase Auth + permissões organização
● Sempre ensureAuthenticated + validação de membership/role antes de ações
sensíveis.
Maps/Address (se usado no clube)
● Blueprint prevê Apple MapKit/Address service no stack.
6) Definition of Done (para “implementação perfeita”)
● Zero estados impossíveis (ex.: dupla confirmada sem pagamentos, jogador em 2
duplas, waitlist furada).
● Auditoria: todas as ações admin (override, swaps, re-schedule, cancelamentos)
ficam registadas.
● Idempotência: webhooks e jobs podem correr 2x sem duplicar efeitos.
● Observabilidade: logs + métricas (inscrições pendentes, conversão para
confirmadas, reembolsos, tempo médio de matchmaking).
● Testes: unit (máquina de estados), integração (webhooks), e2e (fluxo de inscrição
até live).
7) Decisões fechadas (confirmadas)
1. Nível do jogador: apenas informativo (não bloqueia inscrição) e pode gerar avisos.
2. Unidade de contagem da lotação/matchmaking: dupla confirmada.
3. Pending não conta para lotação; confirmação sem vaga → waitlist.
4. Matchmaking sempre por categoria (tipo+nivel), nunca global.
5. Avisos de nível/conflitos nunca bloqueiam (só informam, com override admin).
6. Reembolsos sempre via Stripe; sem wallet monetária (apenas loyalty/pontos).
7. Misto default estrito (1 homem + 1 mulher). Pode existir opção “misto livre” com aviso claro.
8. Limite recomendado adaptativo por categoria, com warnings (sem bloquear).
9. Troca de parceiro após ambos pagos: exigir confirmação de ambos; reembolso só quando novo parceiro pagar.

8) Decisões fechadas adicionais
1. Formato único por torneio é o default. Existe override por categoria, mas assume sempre o formato único se não houver override explícito.
2. Desistência conta como derrota (walkover) no resultado final.

Se queres, eu já preparo a lista de tickets (Jira-style) por fase com estimativa de
dependências técnicas (migrations, endpoints, UI components) exatamente no formato que
o Codex “engole” melhor.
