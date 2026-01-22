# ORYA — Pádel (AS-IS) — Estado Atual Completo

> Fonte: código em `/Users/nuno/orya/ORYA-WebApp`. Itens marcados como **(em falta)** não foram encontrados de forma explícita no código lido.

---

## 1) Contexto e Objetivo do “Padel” na ORYA

**O que é “Padel” dentro da ORYA (AS‑IS):**
- Padel é um **preset de torneio** (`EventTemplateType.PADEL`) dentro do módulo de eventos/torneios.
- Inclui: gestão de clubes/campos/staff (Hub Padel), criação de torneios multi‑categoria, inscrições por dupla, geração de jogos (grupos/KO), resultados live, standings e páginas públicas.
- Existe **perfil competitivo de padel** para jogadores (onboarding + perfil público `/@user/padel`).
- Existem **widgets públicos** (bracket, calendário, standings, próximos jogos).
- Existe **calendarização** (manual + auto‑schedule) e logs/analytics via endpoints de organização.

**Público‑alvo e casos de uso principais (AS‑IS):**
- **Organizador/Clube:** criar torneios, configurar clubes/courts/staff, gerir inscrições/duplas, gerar jogos, inserir resultados e operar o calendário.
- **Jogador/Participante:** criar/entrar em dupla, pagar inscrição, aceitar convite, acompanhar resultados e standings, ter perfil competitivo.
- **Público:** ver páginas públicas do torneio (jogos, classificação, live, widgets).

---

## 2) Inventário de Tudo o que Existe Hoje (Mapa geral)

### 2.1 Páginas e superfícies públicas (front‑office)
| Superfície | Rota | Ficheiro | Notas |
|---|---|---|---|
| Onboarding Padel | `/onboarding/padel` | `app/onboarding/padel/page.tsx` | Perfil competitivo obrigatório para inscrições Padel v2. |
| Perfil Padel do utilizador | `/[username]/padel` | `app/[username]/padel/page.tsx` | Estatísticas, histórico, badges, disputas. |
| Evento público | `/eventos/[slug]` | `app/eventos/[slug]/page.tsx` + `EventPageClient.tsx` | Página pública do torneio/evento com inscrições. |
| Live do evento | `/eventos/[slug]/score` | `app/eventos/[slug]/score/page.tsx` + `PadelScoreboardClient.tsx` | Scoreboard live (SSE). |
| Monitor | `/eventos/[slug]/monitor` | `app/eventos/[slug]/monitor/page.tsx` | Monitor/TV. |
| Widgets Padel | `/widgets/padel/*` | `app/widgets/padel/*` | Bracket, calendário, standings, próximos jogos. |
| Padel Tables (público) | (embutido em `/eventos/[slug]`) | `app/eventos/[slug]/PadelPublicTablesClient.tsx` | Classificações + jogos + KO. |
| Padel Signup inline | (embutido em `/eventos/[slug]`) | `app/eventos/[slug]/PadelSignupInline.tsx` | Botões “Pagar dupla / Pagar lugar”. |

### 2.2 Organização / back‑office
| Superfície | Rota | Ficheiro | Notas |
|---|---|---|---|
| Criar torneio (wizard) | `/organizacao/torneios/novo` | `app/organizacao/(dashboard)/torneios/novo/page.tsx` → `eventos/novo` | Preset Padel com seção própria. |
| Criar evento (geral) | `/organizacao/eventos/novo` | `app/organizacao/(dashboard)/eventos/novo/page.tsx` | Contém seção Padel quando preset = Padel. |
| Detalhe do torneio | `/organizacao/torneios/[id]` | `app/organizacao/(dashboard)/eventos/[id]/page.tsx` + `PadelTournamentTabs.tsx` | Gestão de duplas, jogos, standings, KO, live, audit. |
| Editar evento/torneio | `/organizacao/eventos/[id]/edit` | `app/organizacao/(dashboard)/eventos/[id]/edit/page.tsx` | (detalhes Padel específicos em falta). |
| Hub Padel | `/organizacao/torneios?section=padel-hub` | `app/organizacao/(dashboard)/padel/PadelHubClient.tsx` | Tabs: calendar, clubs, courts, categories, players, trainers, lessons. |
| Redirect Hub | `/organizacao/padel` | `app/organizacao/(dashboard)/padel/page.tsx` | Redireciona para `padel-hub`. |
| Padel Mix rápido | `/organizacao/padel/mix/novo` | `app/organizacao/(dashboard)/padel/mix/novo/page.tsx` | Cria “Mix rápido”. |
| Categorias (atalho) | `/organizacao/categorias/padel` | `app/organizacao/(dashboard)/categorias/padel/page.tsx` | Redireciona para Hub -> categorias. |

### 2.3 Componentes relacionados
- `app/components/notifications/PairingInviteCard.tsx` (convites de dupla, ações, erros).
- `app/eventos/[slug]/EventLiveClient.tsx` (live do evento).
- `app/eventos/[slug]/InviteGateClient.tsx` (gate de convites).
- `app/eventos/[slug]/WavesSectionClient.tsx` (waves de tickets com Padel).
- `app/eventos/[slug]/PadelPublicTablesClient.tsx` (jogos/standings públicos).
- `app/eventos/[slug]/PadelSignupInline.tsx` (inscrição Padel).
- `app/[username]/padel/PadelDisputeButton.tsx` (disputas de resultado).

### 2.4 APIs (ver seção 6 para detalhe)
- `/api/padel/*` (core)
- `/api/organizacao/padel/*` (back‑office / exports / waitlist / analytics)
- `/api/widgets/padel/*` (widgets públicos)
- `/api/cron/padel/*` (jobs de expiração/lembranças)

---

## 3) Modal de Padel (AS‑IS) — Especificação total

> **Interpretação AS‑IS:** o “modal de padel” hoje é a **seção Padel** dentro do wizard de criação de torneios em `app/organizacao/(dashboard)/eventos/novo/page.tsx`, incluindo sub‑painéis “Inscrições” e “Operação”. Não existe um modal isolado dedicado apenas a Padel; é um bloco dentro do wizard.

### 3.1 Onde abre (trigger) e contexto
- **Página:** `/organizacao/torneios/novo` (preset Padel) ou `/organizacao/eventos/novo` quando preset = Padel.
- **Trigger:** `selectedPreset === "padel"` → render da seção Padel.
- **Atalho:** botão “Hub” aponta para `/organizacao/torneios?section=padel-hub`.
- **Dependências:** carrega `/api/padel/clubs`, `/api/padel/clubs/:id/courts`, `/api/padel/clubs/:id/staff`, `/api/padel/categories/my`, `/api/padel/rulesets`, `/api/padel/public/clubs`.

### 3.2 Layout & hierarquia (AS‑IS)
- Header da seção:
  - Texto: `Padel` (caps) + `Configuração`.
  - Botão: `Hub`.
- Chips de resumo:
  - `Formato: {padelFormatLabel}`
  - `{padelCategoryCountLabel}`
  - `RuleSet: {padelRuleSetLabel}`
- Bloco 1: **Tipo de clube** + descrição
- Bloco 2: **Checklist** (Clube, Courts, Categorias, Inscrições, Staff)
- Bloco 3: **Formato** (chips)
- Bloco 4: **RuleSet** (select)
- Bloco 5: **Categorias** (chips + tabela por categoria)
- Bloco 6: **Inscrições** (painel de tickets)
- Bloco 7: **Operação** (clubes/courts/staff)

### 3.3 Elementos UI e copy (extraídos do código)

#### 3.3.1 Bloco “Tipo de clube”
- Label: `Tipo de clube`
- Pills:
  - `Tenho clube` (OWN)
  - `Clube parceiro` (PARTNER)
- Badge estado: `Parceiro` | `Próprio`
- Texto explicativo:
  - OWN: `Usa um clube da tua organização para gerir courts e staff.`
  - PARTNER: `Usa um clube de terceiros. Procura no diretorio e confirma o staff local.`
- Botões (quando PARTNER):
  - `Abrir diretorio`
  - `Criar clube rapido`
- Empty state (OWN sem clubes):
  - `Sem clubes ativos` + `Adiciona um clube ou muda para clube parceiro.`

#### 3.3.2 Checklist
- Cabeçalho: `Checklist`
- Itens:
  - `Clube` → `Seleciona um clube.`
  - `Courts` → `Seleciona pelo menos 1 court.` / `Seleciona um clube para carregar courts.`
  - `Categorias` → `Seleciona pelo menos 1 categoria.`
  - `{ticketLabelPluralCap}` → `Confirma inscrições por categoria.`
  - `Staff` → `Seleciona staff local do clube parceiro.` (quando aplicável) / `Opcional (recomendado).`
- Status badge: `OK`, `Opcional`, `Em falta`
- Atalhos: `Categorias`, `Inscrições`, `Operação`

#### 3.3.3 Formato
- Label: `Formato`
- Opções (chips):
  - `Todos vs todos` (TODOS_CONTRA_TODOS)
  - `Eliminatório` (QUADRO_ELIMINATORIO)
  - `Grupos + KO` (GRUPOS_ELIMINATORIAS)
  - `Quadro A/B` (QUADRO_AB)
  - `Dupla eliminação` (DUPLA_ELIMINACAO)
  - `Non-stop` (NON_STOP)
  - `Campeonato/Liga` (CAMPEONATO_LIGA)

#### 3.3.4 RuleSet
- Label: `RuleSet`
- Select:
  - Default option: `Padrão`
  - Options from `/api/padel/rulesets`

#### 3.3.5 Categorias
- Label: `Categorias`
- Buttons auxiliares (quando >1):
  - `Aplicar formato do torneio`
  - `Replicar capacidade` (apenas se não pago)
- Empty state: `Sem categorias`
- Chips por categoria (texto = `cat.label`)
- Tabela por categoria:
  - Colunas: `Categoria`, `Formato`, `Capacidade` (ou `Capacidade (inscrições)` quando pago)
  - Select formato: `Formato (torneio)` + options do formato
  - Input capacidade: placeholder `Capacidade`

#### 3.3.6 Inscrições (tickets)
- Label principal: `{ticketLabelPluralCap}`
- Resumo: `{ticketsSummary}` + `{accessSummary}`
- Mensagens:
  - `Capacidade e preço são definidos nas inscrições por categoria.` (quando pago)
  - `Criamos uma inscrição gratuita por categoria.` (quando free)
- Ações para aplicar por categoria (pago):
  - `Aplicar preço a todas`
  - `Aplicar capacidade a todas`
  - `Aplicar nome a todas`
- Campos de ticket (via `renderTicketsPanel`): **(detalhe completo em falta)**

#### 3.3.7 Operação (clubes/courts/staff)
- Label: `Operação`
- Resumo: `Clube: {nome} · Courts: {n}` / `Staff: {n}`
- Conteúdo (painel expandido):
  - Secção Clube:
    - Label: `Clube`
    - Tabs: `Meus clubes` | `Parceiros`
    - Select: placeholder `Clube`
    - Empty: `Sem clubes na tua organizacao.`
    - Ações: `Procurar no diretorio`, `Criar clube rapido`
  - Diretório de clubes:
    - Input: placeholder `Pesquisar clube, cidade, organizacao`
    - Loading: `A procurar clubes...`
    - Empty: `Sem resultados no diretorio.`
    - Card: `Adicionar parceiro` / `A adicionar...`
  - Courts:
    - Label: `Courts`
    - Empty: `Seleciona um clube para carregar courts.`
    - Empty list: `Sem courts.`
    - Error: `Seleciona 1 court.`
  - Staff:
    - Label: `Staff`
    - Notice partner: `Obrigatório para clubes parceiros.`
    - Empty: `Seleciona um clube para carregar staff.` / `Sem staff.`
    - Badge `auto` para staff herdável

### 3.4 Estados
- **Default:** seção Padel visível apenas quando preset = Padel.
- **Loading:**
  - Diretório: `A procurar clubes...`
  - Rulesets/Categories/Clubs carregam via SWR (sem labels específicas).
- **Sem resultados:** `Sem resultados no diretorio.` / `Sem categorias` / `Sem courts.` / `Sem staff.`
- **Erro:**
  - Diretório: `Nao foi possivel criar o clube parceiro.` / `Erro ao criar clube parceiro.`
  - Validações (ver 3.5)
- **Sucesso:** toast de criação global (fora da seção Padel): `Torneio criado` / `Evento criado`.

### 3.5 Validações e mensagens (AS‑IS)

**Erros gerais do wizard:**
- `Título obrigatório.`
- `Data/hora de início obrigatória.`
- `Cidade obrigatória.`
- `Local obrigatório.`
- `Seleciona uma sugestão de localização.`
- `Confirma a localização antes de guardar.`
- `A data/hora de fim tem de ser depois do início.`

**Tickets (pagos):**
- `Preço tem de ser positivo.`
- `Para torneios pagos, cada inscrição tem de custar pelo menos 1 €.`
- `Liga o Stripe e verifica o email oficial da organização para vender inscrições pagos.`

**Padel (wizard):**
- `Seleciona um clube de padel para o torneio.`
- `Seleciona pelo menos 1 court para o torneio de padel.`
- `Seleciona staff local para o clube parceiro.`
- `Seleciona pelo menos uma categoria de padel.` / `Cria pelo menos uma categoria de padel.`
- `Cria uma inscrição por categoria de padel.`
- `Cada inscrição deve apontar para uma categoria diferente.`
- `O nome da inscrição deve incluir o código da categoria (ex: M4).`
- `A data de fecho das inscrições deve ser depois da abertura.`

### 3.6 Regras de negócio atuais (AS‑IS)
- Clube obrigatório + pelo menos 1 court selecionado.
- Clube parceiro exige staff local (se existir staff no clube).
- Deve existir pelo menos 1 categoria Padel ativa.
- Para torneios pagos: 1 inscrição por categoria; nomes das inscrições incluem tag (ex: `M4`).
- Split deadline/inscrições configuráveis (horas, janela, limites).

### 3.7 Pricing / fees / cancelamentos
- **Pricing mínimo:** 1€ por inscrição paga (regra no wizard).
- **Fees:** **(em falta)** detalhes de fee/commission específicos para Padel.
- **Cancelamento / reembolso:** **(em falta)** regra específica de Padel (usa regras gerais de eventos/pagamentos).

### 3.8 Acessibilidade básica
- Não há indicações explícitas de suporte a teclado/focus além de inputs. **(em falta)**

---

## 4) Fluxos End‑to‑End (passo a passo)

### A) Criar jogo / marcar jogo (organizador)
**Passos do utilizador:**
1. Criar torneio com preset Padel (wizard).
2. Selecionar clube/courts/staff.
3. Definir categorias e formato.
4. Gerar jogos (grupos e/ou eliminatórias) em `PadelTournamentTabs`.
5. Agendar jogos no calendário (Hub Padel → Calendário) ou auto‑schedule.

**O sistema faz:**
- Gera jogos via `/api/padel/matches/generate`.
- Calendariza via `/api/padel/calendar` ou `/api/padel/calendar/auto-schedule`.

**Regras/validações:**
- Club/court/staff obrigatórios conforme wizard.
- Calendarização respeita janela do evento, buffer, conflitos. (ver `domain/padel/autoSchedule.ts`).

**Pontos de falha / mensagens:**
- `Falha ao gerar jogos...` (ver `PadelTournamentTabs.tsx` → `resolveGenerationError`).
- `Sem jogos.` / `Sem eliminatórias.`
- Erros de calendário: mensagens `calendarError` / `calendarWarning` no Hub.

### B) Entrar num jogo existente (jogador)
**Passos do utilizador:**
1. Abrir página do torneio público.
2. Escolher categoria e iniciar inscrição (Pagar dupla / lugar).
3. Receber convite e aceitar via notificação.

**O sistema faz:**
- Cria pairing (`/api/padel/pairings`), gera convite/token e slots.
- Verifica elegibilidade e limites.
- Notifica parceiro (notificações + link).

**Mensagens/erros (exemplos):**
- `Categoria cheia. Tenta outra ou aguarda vaga.`
- `Já estás inscrito nesta categoria.`
- `Já atingiste o limite de categorias neste torneio.`
- `Torneio cheio. Aguarda vaga na lista de espera.`
- `As inscrições ainda não estão abertas.` / `As inscrições já fecharam.`
- `O torneio já começou. Inscrições encerradas.`

### C) Convidar amigos / partilhar
**Passos:**
1. Capitão cria dupla (modo split ou full).
2. Sistema gera link/convite.
3. Parceiro aceita ou recusa.

**UI/Copy:**
- `Convite pendente`, `Convite para dupla`, `Capitão`, `Parceiro`, `Pagamento pendente`.
- Ações: `Aceitar`, `Recusar`, `Pagar`, `Trocar parceiro`, `Cancelar` (depende do estado).

**Erros:**
- `Este convite expirou.`, `Esta dupla foi cancelada.`, `Precisas de pagar para aceitar este convite.`

### D) Pagamento
**Passos:**
1. Escolhe `Pagar dupla` (FULL) ou `Pagar lugar` (SPLIT).
2. Checkout (via `/api/padel/pairings/[id]/checkout` + `/api/payments/intent`).

**Mensagens:**
- `Sem configuração válida para inscrição Padel.`
- `A preparar…`

**Regras:**
- Padel v2 precisa `padelV2Enabled` no config.

### E) Confirmação / check‑in
- **AS‑IS:** não há flow explícito de check‑in em UI. **(em falta)**

### F) Cancelar / reagendar
- **Cancelar dupla:** `/api/padel/pairings/[id]/cancel`.
- **Reabrir dupla:** `/api/padel/pairings/[id]/reopen`.
- **Matches:** `/api/padel/matches/[id]/delay`, `/walkover`, `/undo`.
- **Calendário:** drag/drop + `/api/padel/calendar`.

### G) Pós‑jogo (resultados, feedback, chat, etc.)
- Resultados live via SSE (`/api/padel/live`).
- Standings públicas (`PadelPublicTablesClient`).
- Perfil competitivo com histórico e estatísticas (`/[username]/padel`).
- Chat pós‑jogo: **(em falta)**

---

## 5) Dados & Modelos (AS‑IS)

> Fonte: `prisma/schema.prisma`.

### 5.1 Entidades principais (campos)

**PadelPlayerProfile**
- `id` Int (PK)
- `organizationId` Int (obrig.)
- `userId` String? (UUID)
- `fullName` String (obrig.)
- `email` String?
- `phone` String?
- `gender` String?
- `level` String?
- `displayName` String?
- `preferredSide` PadelPreferredSide?
- `clubName` String?
- `birthDate` DateTime?
- `notes` String?
- `isActive` Boolean
- `createdAt`, `updatedAt`
- Relações: slots, rankings, availabilities

**PadelClub**
- `id`, `organizationId`, `name` (obrig.)
- `shortName`?, `city`?, `address`?
- `kind` (OWN/PARTNER)
- `sourceClubId`?
- `locationSource` (OSM/MANUAL)
- `locationProviderId`?, `locationFormattedAddress`?, `locationComponents`?
- `latitude`, `longitude`?
- `courtsCount`, `hours`?
- `favoriteCategoryIds` []
- `slug`?
- `isActive`, `isDefault`?
- `deletedAt`?
- Relações: courts, staff, calendarBlocks, tournaments

**PadelClubCourt**
- `id`, `padelClubId` (obrig.)
- `name` (obrig.)
- `description`?, `surface`?, `indoor`?, `isActive`, `displayOrder`
- Relações: matches, blocks, bookings

**PadelClubStaff**
- `id`, `padelClubId` (obrig.)
- `userId`?, `email`?
- `role` (string)
- `inheritToEvents` (bool)
- `isActive`, `deletedAt`?

**PadelCategory**
- `id`, `organizationId`, `label` (obrig.)
- `genderRestriction`?, `minLevel`?, `maxLevel`?
- `isDefault`, `isActive`, `season`?, `year`?

**PadelEventCategoryLink**
- `id`, `eventId`, `padelCategoryId` (obrig.)
- `format` (padel_format?)
- `capacityTeams`?, `capacityPlayers`?
- `liveStreamUrl`?
- `isEnabled`, `isHidden`
- Relação com TicketTypes

**PadelRuleSet**
- `id`, `organizationId`, `name` (obrig.)
- `tieBreakRules` (JSON)
- `pointsTable` (JSON)
- `enabledFormats` (string[])
- `season`?, `year`?

**PadelTournamentConfig**
- `eventId` (unique)
- `organizationId`
- `format` (padel_format)
- `numberOfCourts`
- `ruleSetId`?, `defaultCategoryId`?
- `enabledFormats` []
- `padelV2Enabled` (bool)
- `splitDeadlineHours`?
- `padelClubId`?
- `partnerClubIds` []
- `advancedSettings` (JSON)
- `eligibilityType` (PadelEligibilityType)

**PadelCourtBlock**
- `organizationId`, `eventId` (obrig.)
- `padelClubId`?, `courtId`?
- `startAt`, `endAt` (obrig.)
- `label`?, `kind`?, `note`?

**PadelAvailability**
- `organizationId`, `eventId` (obrig.)
- `playerProfileId`?, `playerName`?, `playerEmail`?
- `startAt`, `endAt` (obrig.)
- `note`?

**PadelPairing**
- `eventId`, `organizationId` (obrig.)
- `categoryId`?
- `player1UserId`?, `player2UserId`?
- `payment_mode` (FULL/SPLIT)
- `pairingStatus`, `lifecycleStatus`
- `pairingJoinMode` (INVITE_PARTNER / LOOKING_FOR_PARTNER)
- `createdByUserId`?
- `createdByTicketId`?
- `partnerInviteToken`?, `partnerLinkToken`?, `partnerLinkExpiresAt`?
- `deadlineAt`?, `partnerSwapAllowedUntilAt`?
- `lockedUntil`?, `graceUntilAt`?
- `guaranteeStatus`?, `paymentMethodId`?
- `isPublicOpen`, `invitedContact`?

**PadelPairingSlot**
- `pairingId` (obrig.)
- `ticketId`?
- `profileId`?
- `invitedUserId`?
- `slot_role`, `slotStatus`, `paymentStatus`
- `invitedContact`?
- `isPublicOpen`

**PadelPairingHold**
- `pairingId`, `eventId` (obrig.)
- `holds`, `status`, `expiresAt`?

**PadelWaitlistEntry**
- `eventId`, `organizationId`, `userId` (obrig.)
- `categoryId`?
- `paymentMode`, `pairingJoinMode`
- `invitedContact`?
- `status` (PENDING/PROMOTED/CANCELLED/EXPIRED)
- `promotedPairingId`?

**PadelMatch**
- `eventId` (obrig.)
- `categoryId`?
- `courtId`?, `courtNumber`?, `courtName`?
- `startTime`?, `plannedStartAt`?, `plannedEndAt`?, `plannedDurationMinutes`?
- `actualStartAt`?, `actualEndAt`?
- `roundLabel`?, `roundType`?, `groupLabel`?
- `score` (JSON), `scoreSets` (JSON)
- `status` (padel_match_status)
- `pairingAId`?, `pairingBId`?, `winnerPairingId`?

**PadelRankingEntry**
- `organizationId`, `playerId`, `eventId` (obrig.)
- `points`, `position`?, `level`?, `season`?, `year`?

**TournamentEntry** (ligação com torneios)
- `eventId`, `userId` (obrig.)
- `categoryId`?, `pairingId`?
- `status`, `role`
- `purchaseId`?, `saleSummaryId`?

### 5.2 Enums relevantes
- `padel_format`: `TODOS_CONTRA_TODOS`, `QUADRO_ELIMINATORIO`, `GRUPOS_ELIMINATORIAS`, `CAMPEONATO_LIGA`, `QUADRO_AB`, `DUPLA_ELIMINACAO`, `NON_STOP`.
- `padel_match_status`: `PENDING`, `IN_PROGRESS`, `DONE`, `CANCELLED`.
- `PadelClubKind`: `OWN`, `PARTNER`.
- `PadelEligibilityType`: `OPEN`, `MALE_ONLY`, `FEMALE_ONLY`, `MIXED`.
- `PadelPairingStatus`: `INCOMPLETE`, `COMPLETE`, `CANCELLED`.
- `PadelPairingLifecycleStatus`: `PENDING_ONE_PAID`, `PENDING_PARTNER_PAYMENT`, `CONFIRMED_BOTH_PAID`, `CONFIRMED_CAPTAIN_FULL`, `CANCELLED_INCOMPLETE`.
- `PadelPairingJoinMode`: `INVITE_PARTNER`, `LOOKING_FOR_PARTNER`.
- `PadelPaymentMode`: `FULL`, `SPLIT`.
- `PadelWaitlistStatus`: `PENDING`, `PROMOTED`, `CANCELLED`, `EXPIRED`.
- `PadelPairingSlotStatus`: `PENDING`, `FILLED`, `CANCELLED`.
- `PadelPairingPaymentStatus`: `UNPAID`, `PAID`.

---

## 6) Backend / API / Integrações (AS‑IS)

### 6.1 Core Padel API (`/api/padel/*`)
> **Nota:** payloads/responses completos devem ser confirmados por inspeção de cada ficheiro. Onde não detalhado, fica **(em falta)**.

| Método | Path | Descrição | Inputs | Output |
|---|---|---|---|---|
| GET | `/api/padel/onboarding` | Carrega dados para onboarding Padel | query: `eventId?`, `organizationId?`, `categoryId?` | `ok`, `profile`, `padelProfile`, `missing`, `completed`, `event`, `category` |
| POST | `/api/padel/onboarding` | Guarda perfil Padel | body: `fullName`, `username`, `contactPhone`, `gender`, `level`, `preferredSide`, `clubName?` | `ok` / erro |
| GET | `/api/padel/clubs` | Lista clubes Padel | query: `organizationId?`, `includeInactive?` | `items` |
| POST | `/api/padel/clubs` | Criar/editar clube | body (ex): `organizationId`, `name`, `city`, `address`, `kind`, `location*`, `courtsCount`, `isActive` | `club` |
| DELETE | `/api/padel/clubs` | Apagar clube | query: `id` | `ok` |
| GET | `/api/padel/clubs/[id]/courts` | Lista courts | query: `includeInactive?` | `items` |
| POST | `/api/padel/clubs/[id]/courts` | Criar/editar court | body: `name`, `surface?`, `indoor`, `displayOrder` | `court` |
| DELETE | `/api/padel/clubs/[id]/courts` | Apagar court | query: `courtId` | `ok` |
| GET | `/api/padel/clubs/[id]/staff` | Lista staff |  | `items` |
| POST | `/api/padel/clubs/[id]/staff` | Criar/editar staff | body: `email?`, `userId?`, `role`, `inheritToEvents` | `staff` |
| DELETE | `/api/padel/clubs/[id]/staff` | Remover staff | query: `staffId` | `ok` |
| GET | `/api/padel/categories/my` | Lista categorias | query: `organizationId`, `includeInactive?` | `items` |
| POST | `/api/padel/categories/my` | Criar/editar categoria | body (label, genderRestriction, minLevel, maxLevel, isActive, season, year) | `category` |
| DELETE | `/api/padel/categories/my` | Apagar categoria | query: `id` | `ok` |
| GET | `/api/padel/rulesets` | Lista rulesets | query: `organizationId` | `items` |
| POST | `/api/padel/rulesets` | Criar ruleset | body: `name`, `tieBreakRules`, `pointsTable`, `enabledFormats` | `ruleset` |
| GET | `/api/padel/tournaments/config` | Config do torneio | query: `eventId` | `config`, `tournament` |
| POST | `/api/padel/tournaments/config` | Atualiza config | body: `organizationId`, `eventId`, `format`, `groups`, `scoreRules`, etc | `ok` |
| POST | `/api/padel/tournaments/seeds` | Grava seeds | body: `eventId`, `categoryId`, `seeds` | `ok` |
| POST | `/api/padel/event-categories` | Ativa/desativa link categoria/evento | body: `eventId`, `categoryId`, `isEnabled`, `capacity` | `ok` |
| GET | `/api/padel/event-categories` | Lista links | query: `eventId` | `items` |
| POST | `/api/padel/matches/generate` | Gera jogos (grupos/KO) | body: `eventId`, `categoryId?`, `phase?` | `ok`, `matches` |
| GET | `/api/padel/matches` | Lista matches | query: `eventId`, `categoryId?` | `items` |
| POST | `/api/padel/matches` | Report score | body: `matchId`, `score`, `scoreSets`, `status` | `ok`, `match` |
| POST | `/api/padel/matches/[id]/delay` | Marca atraso | body: `delayStatus`, `delayReason` | `ok` |
| POST | `/api/padel/matches/[id]/walkover` | Marca WO | body: `winnerSide` | `ok` |
| POST | `/api/padel/matches/[id]/dispute` | Marca disputa | body: `disputeStatus`, `reason` | `ok` |
| POST | `/api/padel/matches/[id]/undo` | Undo resultado | body: `eventId` | `ok` |
| POST | `/api/padel/matches/assign` | Atribui court/tempo | body: `matchId`, `courtId`, `plannedStartAt`, `plannedDurationMinutes` | `ok` |
| GET | `/api/padel/standings` | Classificações | query: `eventId`, `categoryId?` | `standings` |
| GET | `/api/padel/live` | SSE de live | query: `eventId`, `categoryId?` | eventos `update` com `matches` + `standings` |
| GET | `/api/padel/discover` | Descobrir torneios | query: filtros | `items` |
| GET | `/api/padel/public/clubs` | Diretório público | query: `q?`, `limit?`, `includeCourts?` | `items` |
| GET | `/api/padel/public/open-pairings` | Pares abertos | query: `eventId`, `categoryId?` | `items` |
| GET | `/api/padel/public/calendar` | Calendário público | query: `eventId` | `items` |
| GET | `/api/padel/pairings` | Lista pairings | query: `eventId`, `categoryId?` | `pairings` |
| POST | `/api/padel/pairings` | Criar pairing (inscrição) | body: `eventId`, `organizationId`, `categoryId?`, `paymentMode`, `pairingJoinMode?` | `ok`, `pairing`, `waitlist?` |
| GET | `/api/padel/pairings/my` | Pairings do utilizador | query: `eventId`? | `items` |
| POST | `/api/padel/pairings/open` | Abrir pairing (procura parceiro) | body: `pairingId` | `ok` |
| GET | `/api/padel/pairings/claim/[token]` | Ver convite | params: `token` | `ok`, `pairing` |
| POST | `/api/padel/pairings/claim/[token]` | Aceitar convite | params: `token` | `ok` |
| GET | `/api/padel/pairings/invite-status` | Estado do convite | query: `pairingId` | `status`, `actions`, `urls` |
| POST | `/api/padel/pairings/[id]/invite` | Enviar convite | body: `contact`, `expiresAt?` | `ok` |
| POST | `/api/padel/pairings/[id]/accept` | Aceitar convite | body: `action?` | `ok` |
| POST | `/api/padel/pairings/[id]/decline` | Recusar convite | body: `reason?` | `ok` |
| POST | `/api/padel/pairings/[id]/swap` | Trocar parceiro | body: `invitedContact?` | `ok` |
| POST | `/api/padel/pairings/swap/confirm/[token]` | Confirmar troca | params: `token` | `ok` |
| POST | `/api/padel/pairings/[id]/checkout` | Criar checkout | body: `mode` | `ok`, `checkoutUrl` |
| POST | `/api/padel/pairings/[id]/cancel` | Cancelar pairing | body: `reason?` | `ok` |
| POST | `/api/padel/pairings/[id]/reopen` | Reabrir pairing | body: `reason?` | `ok` |
| POST | `/api/padel/pairings/[id]/regularize` | Regularizar pairing | body: `mode` | `ok` |
| POST | `/api/padel/pairings/[id]/assume` | Assumir pairing | body: `userId?` | `ok` |
| GET | `/api/padel/players` | Lista jogadores | query: `organizationId` | `items` |
| POST | `/api/padel/players` | Criar jogador | body: `fullName`, `email?`, `phone?`, `level?` | `player` |
| GET | `/api/padel/calendar` | Calendário Padel | query: `eventId` | blocks, availabilities, matches |
| POST | `/api/padel/calendar` | Cria/edita block/availability/match | body (varia por tipo) | `ok` |
| DELETE | `/api/padel/calendar` | Remove block/availability | query: `type`, `id` | `ok` |
| POST | `/api/padel/calendar/auto-schedule` | Auto‑schedule / preview | body: `eventId`, `categoryId?`, `config` | `ok`, `scheduled`, `skipped` |
| GET | `/api/padel/rankings` | Rankings | query: `eventId?`, `organizationId?` | `items` |
| POST | `/api/padel/rankings` | Recalcular rankings | body: `eventId`, `categoryId?` | `ok` |

### 6.2 APIs de organização (`/api/organizacao/padel/*`)
| Método | Path | Descrição | Inputs | Output |
|---|---|---|---|---|
| GET | `/api/organizacao/padel/analytics` | Analytics do torneio | query: `eventId` | `ok`, métricas |
| GET | `/api/organizacao/padel/audit` | Audit log | query: `eventId`, `actionPrefix` | `items` |
| GET | `/api/organizacao/padel/courts` | Courts por clube | query: `clubId` | `items` |
| POST | `/api/organizacao/padel/imports/inscritos` | Import CSV/XLSX | multipart | `preview` / `import` |
| GET | `/api/organizacao/padel/exports/*` | Export: analytics/bracket/inscritos/resultados/calendario | query: `eventId`, `format?` | PDF/HTML/CSV |
| POST | `/api/organizacao/padel/waitlist/promote` | Promover waitlist | body: `eventId`, `categoryId?` | `ok` |
| GET | `/api/organizacao/padel/waitlist` | Lista waitlist | query: `eventId`, `categoryId?` | `items` |
| POST | `/api/organizacao/padel/mix/create` | Criar Mix rápido | body: `title`, `startsAt`, `durationMinutes`, `teamsCount`, `format`, `locationName`, `locationCity` | `ok`, `eventId` |

### 6.3 Widgets (`/api/widgets/padel/*`)
| Método | Path | Descrição | Inputs | Output |
|---|---|---|---|---|
| GET | `/api/widgets/padel/bracket` | Bracket público | query: `eventId` | `rounds` |
| GET | `/api/widgets/padel/standings` | Standings público | query: `eventId` | `standings` |
| GET | `/api/widgets/padel/calendar` | Calendário público | query: `eventId` | `items` |
| GET | `/api/widgets/padel/next` | Próximos jogos | query: `eventId` | `items` |

### 6.4 Integrações externas
- **Mapas (OSM):** Geo autocomplete e normalização (via `/lib/geo/*`).
- **Pagamentos (Stripe):** `/api/payments/intent`, webhooks, payouts.
- **Realtime (SSE):** `/api/padel/live` (EventSource).
- **Notificações:** `domain/notifications/*` (convites, resultados, eliminados, campeão).

---

## 7) Analytics / Tracking

**Tracking (frontend):**
- `padel_club_created` / `padel_club_updated`
- `padel_club_marked_default`
- `padel_court_created` / `padel_court_updated`
- `padel_court_reactivated` / `padel_court_deactivated`
- `padel_club_reactivated` / `padel_club_archived`

**Analytics (backend):**
- `domain/padel/analytics.ts` calcula:
  - Ocupação, duração média, atrasos, matches, windowMinutes
  - Breakdown por fase (Grupos/KO A/KO B)
  - Breakdown por court/dia
  - Pagamentos por fase e categoria

**Métricas em falta:**
- Conversão inscrição → pairing → pagamento
- Funil convite → aceitação
- Tempo médio até completar dupla

---

## 8) Problemas Conhecidos / Dívida Técnica

**Observados no código / comportamento:**
- Não existe um modal dedicado apenas a Padel; está embutido no wizard. **(possível gap de UX)**
- Várias superfícies dependem de `advancedSettings` JSON (pouca tipagem).
- Padel Hub é um componente grande e monolítico (alta complexidade).
- Regras de cancelamento/reembolso específicas de Padel não estão explicitadas. **(em falta)**
- Acessibilidade formal (aria, navegação por teclado) não está documentada. **(em falta)**

**Erros recentes reportados (sessão dev):**
- `Cannot access 'ownPadelClubs' before initialization` (corrigido).
- `Cannot access 'selectedPadelClub' before initialization` (corrigido).
- `Maximum update depth exceeded` (corrigido).

---

## 9) Decisões em Aberto

- O “modal de Padel” deve ser separado do wizard principal? (decidir UX)
- O padrão de criação de clubes parceiros deve exigir staff sempre? (já obrigatório se existir staff)
- Qual o comportamento ideal para cancelamentos/reembolsos Padel? **(em falta)**
- Como expor/gerir regras de desempate no UI público? **(em falta)**
- Confirmar se check‑in/validação presencial é necessário. **(em falta)**

---

## 10) Checklist do que preciso de recolher (gaps)

- [ ] Detalhe completo do painel de inscrições (`renderTicketsPanel`) com campos e copy.
- [ ] Detalhes completos do calendário Padel no Hub (labels de botões, filtros e validações).
- [ ] Regras formais de cancelamento/reembolso para inscrições Padel.
- [ ] Copy/estados completos das páginas públicas de evento (tabs e mensagens).
- [ ] Acessibilidade: foco/teclado/aria/contrast (confirmar no UI real).
- [ ] Links de navegação exatos (menu, sidebar, etc.).
- [ ] Detalhes do fluxo de check‑in (se existir).
- [ ] Especificação do chat pós‑jogo (se existir).

---

## Resumo do AS‑IS (10 linhas)
1. Padel é um preset de torneio com wizard dedicado dentro da criação de eventos.
2. Existe Hub Padel para gestão de clubes, campos, categorias, calendário e jogadores.
3. Inscrições são por dupla, com pagamento total ou dividido.
4. Validações exigem clube, courts, categorias e tickets por categoria.
5. Match engine suporta grupos, KO, A/B e dupla eliminação.
6. Resultados e standings são atualizados em tempo real via SSE.
7. Há perfil competitivo público com estatísticas e histórico.
8. Há widgets públicos para bracket, standings e calendário.
9. Analytics e exports existem para organizadores.
10. Regras de cancelamento/check‑in e acessibilidade não estão explícitas.

---

## Top 10 prioridades (hipóteses)
1. Separar o “Modal Padel” do wizard para reduzir complexidade. **(hipótese)**
2. Simplificar seleção de clube/courts com defaults inteligentes. **(hipótese)**
3. Tornar ruleset/desempates visíveis no público. **(hipótese)**
4. Fluxo de pagamento split mais guiado (estado do parceiro). **(hipótese)**
5. Melhorar UX da calendarização (drag & drop e conflitos). **(hipótese)**
6. Export público do bracket em PDF/Imagem com layout premium. **(hipótese)**
7. Melhorar onboarding Padel com validações inline e preview do perfil. **(hipótese)**
8. Clarificar regras de cancelamento e prazos no checkout. **(hipótese)**
9. Consolidar logs/auditoria num painel único. **(hipótese)**
10. Acessibilidade formal (teclado + aria) nas principais superfícies. **(hipótese)**

---

## Referências Visuais
- [ ] Screenshot: Wizard Padel (seleção de clube/courts)
- [ ] Screenshot: Checklist + Operação
- [ ] Screenshot: Inscrições por categoria
- [ ] Screenshot: Padel Hub (Calendário)
- [ ] Screenshot: Padel Hub (Clube + Campos)
- [ ] Screenshot: Página pública (Jogos/Standings)
- [ ] Screenshot: Padel Onboarding

---

## Anexos
- (colar links/prints/documentos aqui)
