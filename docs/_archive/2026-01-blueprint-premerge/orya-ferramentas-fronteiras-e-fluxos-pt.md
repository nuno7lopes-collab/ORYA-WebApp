# ORYA — Ferramentas Core: Sub-navegação, Papéis, Fronteiras e Integrações

> Fonte: código em `/Users/nuno/orya/ORYA-WebApp`. Itens não confirmados no código estão marcados como **(em falta)**.

---

## 1) Sub-navegações (listas confirmadas no código)

### 1.1 Reservas
Fonte: `app/organizacao/objectiveNav.ts`.
- **Agenda:** `/organizacao/reservas`
- **Disponibilidade:** `/organizacao/reservas?tab=availability`
- **Serviços:** `/organizacao/reservas/servicos`
- **Clientes:** `/organizacao/reservas/clientes`
- **Profissionais:** `/organizacao/reservas/profissionais`
- **Recursos:** `/organizacao/reservas/recursos`
- **Políticas:** `/organizacao/reservas/politicas`

### 1.2 Eventos / Torneios
Fonte: `app/organizacao/objectiveNav.ts`.

**Eventos:**
- **Eventos:** `/organizacao/eventos`
- **Criar evento:** `/organizacao/eventos/novo`
- **Formulários:** `/organizacao/inscricoes` (se módulo ativo)

**Torneios (Padel):**
- **Torneios:** `/organizacao/torneios`
- **Criar torneio:** `/organizacao/torneios/novo`
- **Categorias:** `/organizacao/torneios?section=padel-hub&padel=categories`
- **Clube → Clubes:** `/organizacao/torneios?section=padel-hub&padel=clubs`
- **Clube → Campos:** `/organizacao/torneios?section=padel-hub&padel=courts`
- **Calendário → Jogos:** `/organizacao/torneios?section=padel-hub&padel=calendar`
- **Pessoas → Jogadores:** `/organizacao/torneios?section=padel-hub&padel=players`
- **Pessoas → Treinadores:** `/organizacao/torneios?section=padel-hub&padel=trainers`
- **Aulas:** `/organizacao/torneios?section=padel-hub&padel=lessons`
- **Caixa:** `/organizacao/clube/caixa` (fora do modo dashboard)

### 1.3 Serviços
Fonte: `app/organizacao/(dashboard)/reservas/servicos/page.tsx`.
- **Listagem:** `/organizacao/reservas/servicos`
- **Criar serviço:** `/organizacao/reservas?create=service`
- **Detalhe do serviço:** `/organizacao/reservas/[id]`
- **Sub-navegação própria:** **(em falta)** (não há tabs dedicadas no código)

### 1.4 CRM / Seguidores
Fonte: `app/organizacao/(dashboard)/crm/CrmSubnav.tsx` e `components/profile/*`.

**CRM:**
- **Clientes:** `/organizacao/crm/clientes`
- **Segmentos:** `/organizacao/crm/segmentos`
- **Campanhas:** `/organizacao/crm/campanhas`
- **Relatórios:** `/organizacao/crm/relatorios`
- **Pontos & recompensas:** `/organizacao/crm/loyalty`

**Seguidores:**
- Aparece no perfil público (`components/profile/ProfileHeader.tsx`, `OrganizationProfileHeader.tsx`).
- Sub-navegação própria: **(em falta)**.

### 1.5 Finanças
Fonte: `app/organizacao/objectiveNav.ts`.
- **Visão geral:** `/organizacao?tab=analyze&section=overview`
- **Vendas:** `/organizacao?tab=analyze&section=vendas`
- **Finanças:** `/organizacao?tab=analyze&section=financas`
- **Faturação:** `/organizacao?tab=analyze&section=invoices`

### 1.6 Equipa
Fonte: `app/organizacao/(dashboard)/staff/page.tsx`.
- **Equipa:** `/organizacao/staff`
- **Convidados:** `/organizacao/staff?staff=convidados`
- **Permissões:** `/organizacao/staff?staff=permissoes` (se autorizado)
- **Auditoria:** `/organizacao/staff?staff=auditoria` (se autorizado)

### 1.7 Check-in
Fonte: `app/organizacao/(dashboard)/scan/page.tsx`.
- **Check-in:** `/organizacao/scan`
- Sub-navegação própria: **(em falta)**.

---

## 2) Papéis, Fronteiras e Limites (por ferramenta)

### 2.1 Reservas
**Papel (owner):**
- Agenda/slots, disponibilidade e bookings de serviços.
- Recursos e profissionais associados a serviços.

**Entidades (AS-IS):**
- Serviços, Reservas, Disponibilidade, Profissionais, Recursos, Clientes.  
  (ver rotas em `app/organizacao/(dashboard)/reservas/*` e `/api/organizacao/reservas/*`)

**Fluxos principais (confirmados):**
- Criar/editar serviços (`/organizacao/reservas?create=service`, `/organizacao/reservas/servicos`).
- Gerir disponibilidade (`/organizacao/reservas?tab=availability`).
- Gerir recursos (`/organizacao/reservas/recursos`) e profissionais (`/organizacao/reservas/profissionais`).
- Criar/editar reservas (`/api/organizacao/reservas`).
- Checkout de reserva (`/api/organizacao/reservas/[id]/checkout`).
- Reagendar (`/api/organizacao/reservas/[id]/reschedule`).
- Cancelar (`/api/organizacao/reservas/[id]/cancel`).
- Marcar no-show (`/api/organizacao/reservas/[id]/no-show`).

**Integrações:**
- **Finanças:** checkout e pagamentos.
- **CRM:** interações de reserva/cancelamento (logs em `/api/organizacao/reservas/...`).
- **Equipa:** profissionais e permissões.

**Limites (não deve fazer):**
- Não gere o ledger nem payouts (Finanças).
- Não gere check-in (Check-in).
- Não gere comunicação massiva (CRM).

**Deveria fazer (gaps):**
- Waitlist de reservas **(em falta)**.
- Guest booking com pagamento por link **(em falta)**.

### 2.2 Eventos / Torneios

**Eventos (geral):**
- **Papel:** catálogo de eventos, tickets, páginas públicas gerais.
- **Fluxos (confirmados):**
  - Criar evento: `/organizacao/eventos/novo`.
  - Listagem: `/organizacao/eventos`.
  - Edição: `/organizacao/eventos/[id]/edit`.
  - Público: `/eventos/[slug]`.
- **Limites:** não gere competição (isso é Padel).

**Torneios (Padel):**
- **Papel:** formatos, categorias, regras, geração de jogos, operação live e páginas públicas específicas.
- **Fluxos (confirmados):**
  - Criar torneio: `/organizacao/torneios/novo`.
  - Gestão: `/organizacao/torneios/[id]` (tabs de torneio).
  - Padel Hub: categorias, clubes, courts, calendário, jogadores, treinadores, aulas.
  - Público: `/eventos/[slug]`, `/eventos/[slug]/score`, `/widgets/padel/*`.
- **Integrações:**
  - **Check-in:** presenças (via `/organizacao/scan`).
  - **Finanças:** tickets e pagamentos.
  - **CRM:** participantes, convites, histórico.
  - **Reservas:** bloqueios no calendário (via agenda engine).

**Limites (não deve fazer):**
- Não gerir pagamentos/ledger.
- Não gerir RBAC global.
- Não gerir check-in diretamente.

### 2.3 Serviços
**Papel (owner):**
- Catálogo de serviços reserváveis (ex.: aulas, courts, packs).

**Fluxos (confirmados):**
- Listagem e criação (`/organizacao/reservas/servicos`, `/organizacao/reservas?create=service`).
- Detalhe do serviço (`/organizacao/reservas/[id]`).
- Disponibilidade e packs (via `/api/organizacao/servicos/*`).

**Limites:**
- Não gere pagamentos diretamente (Finanças).
- Não gere comunicação com clientes (CRM).

### 2.4 CRM / Seguidores
**Papel (owner):**
- CRM é dono de clientes, segmentos, campanhas, relatórios e loyalty.
- Seguidores é parte do perfil público (não do CRM).

**Fluxos (confirmados):**
- CRM: clientes, segmentos, campanhas, relatórios, pontos & recompensas.
- Seguidores: visível em perfis públicos (sem subnav dedicada).

**Integrações:**
- Recebe eventos de Reservas e Torneios (ex.: cancelamentos, participação).

**Limites:**
- Não deve gerir operações de torneios nem pagamentos.

### 2.5 Finanças
**Papel (owner):**
- Ledger, payouts, refunds e faturação.

**Fluxos (confirmados):**
- Visão geral, vendas, finanças, faturação (tab analyze).
- Avisos de ligação Stripe em eventos/torneios (ex.: “Finanças & Payouts”).

**Limites:**
- Não deve gerir lógica de reservas ou competição.

**Gaps:**
- UI dedicada de payouts/chargebacks **(em falta)**.

### 2.6 Equipa
**Papel (owner):**
- Gestão de membros, convites, permissões e auditoria.

**Fluxos (confirmados):**
- Tabs: Equipa, Convidados, Permissões, Auditoria.
- Ações: convidar membro, transferir organização (quando permitido).

**Integrações:**
- RBAC aplicado a Reservas, Eventos e Torneios.

**Limites:**
- Não gere regras de competição nem pagamentos.

### 2.7 Check-in
**Papel (owner):**
- Validação presencial (scanner, confirmação).

**Fluxos (confirmados):**
- Scanner e confirmação de check-in (`/organizacao/scan`).
- Check-in associado à janela do evento (mensagens em `CheckinScanner.tsx`).

**Integrações:**
- Eventos/Torneios (presenças).
- CRM (registo de presença, se aplicável).

**Limites:**
- Não deve gerir participantes (CRM) nem pagamentos (Finanças).

---

## 3) Integrações e ligação ao utilizador final

**Superfícies públicas (confirmadas):**
- Eventos/Torneios: `/eventos/[slug]`, `/eventos/[slug]/score`.
- Widgets de Padel: `/widgets/padel/*`.
- Perfil público (org/user): `components/profile/*` com “Seguidores”.
- Reservas públicas: seções de reservas nos perfis públicos (`OrganizationPublicProfilePanel.tsx`).

**Ligação entre ferramentas (fluxos chave):**
- Reserva criada → Finanças (pagamento) → CRM (interação).
- Torneio criado → Eventos (base) + Padel (competição) → Check-in (presença) → CRM (histórico).
- Serviços/Aulas → Reservas (disponibilidade) → Agenda Engine única.

**Gaps visíveis ao utilizador:**
- Subnav de Seguidores não existe no CRM.
- Check-in é uma página única (sem subsecções).
- Finanças ainda parece concentrado na área de análise (detalhe de payouts **em falta**).
