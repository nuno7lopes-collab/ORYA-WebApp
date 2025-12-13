# Release checklist ORYA (organizador + público)

- Explorar
  - Carrega a página `/explorar`
  - Aplica filtro de preço (mover ambos os handles)
  - Aplica filtro de datas (Hoje/Próximos dias)
  - Aplica filtro de localização (cidade da whitelist)
  - Verifica se o empty state surge quando não há resultados e se “Limpar filtros” devolve resultados
- Criação de evento simples
  - Cria um evento básico (gratuito) e confirma que aparece em `/explorar`
  - Cria evento pago e valida que bloqueia publicação se o organizer não tiver Stripe ligado
- Stripe Connect / Finanças
  - Abre tab Finanças
  - Clica “Ligar conta Stripe” (ou “Rever ligação” se incompleto)
  - Conclui onboarding → estado “Ativo” na tab
  - Se houver requirements pendentes, verifica o callout e CTA “Rever ligação”
- Checkout / promo codes
  - Cria código em Marketing > Códigos
  - Vai a um evento pago, aplica código no checkout e verifica desconto
  - Para evento gratuito, confirma que o checkout salta Stripe e cria bilhete/reserva
- Navegação organizador
  - Sidebar ativa uma tab de cada vez
  - Dropdown Categorias abre/fecha e mantém active state correto
  - BackButton volta ao expected path/tab
- Padel (se aplicável)
  - Criar/editar clube, courts, staff
  - Wizard padel respeita nº máximo de courts ativos e só mostra clubes/courts ativos
- Delete/Arquivo
  - Dashboard eventos: DRAFT apaga com confirmação; restantes arquivam e somem de /explorar
  - Clubes/courts: confirmação antes de arquivar/desativar/reativar; courts inativos não aparecem em sugestões
- Notificações
  - Definições `/me/settings`: toggles de email/reminders/friend requests/vendas/Stripe/anúncios do sistema guardam prefs
  - Campainha mostra tabs (Todas/Vendas/Convites/Sistema/Social) e badge de não lidas
- Smoke responsivo
  - DevTools mobile 320–414px: filtros/popovers viram modal, sem scroll horizontal

Executa testes automáticos antes de deploy:
- Unit (node test runner): `node --test tests/filters.test.mjs`
- e2e (se configurado/Playwright/Cypress): `npm run test:e2e` (quando disponível)***
