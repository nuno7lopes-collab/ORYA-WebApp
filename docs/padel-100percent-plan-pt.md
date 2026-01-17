# Padel 100% Plan (PT)

## Objetivo
- Garantir fluxo claro para duas realidades: clube proprio vs organizador em clubes parceiros.
- Calendario de jogos com duas vistas (timeline e lista) e experiencia consistente em desktop/mobile.
- Onboarding e criacao de torneio com selecao de clubes e courts sem friccao.
- Seed completo para testar pares, jogos e auto-agendamento.

## Entregas de produto
1. Modo de operacao Padel
   - Toggle explicito: "Tenho clube" vs "Organizo em clubes parceiros".
   - Copys e CTAs ajustados por modo.
   - Criacao de clube ajustada (campo minimo para parceiros, completo para clube proprio).

2. Calendario de jogos (Padel Hub)
   - Vista Timeline (drag & drop, conflitos, resumos)
   - Vista Lista (mais compacta para muitos jogos)
   - Filtro por dia/semana e data fixa
   - Conflitos visiveis em ambas as vistas

3. Criacao de torneio Padel
   - Toggle de origem do clube (Meus clubes vs Diretorio)
   - Import rapido de clube parceiro com courts
   - Guards de estado quando nao ha clubes/courts/staff
   - Advanced settings com courts/staff por clube

4. Seed completo + auto-agendamento
   - Org + clubes + courts + categorias
   - Jogadores, pares e jogos de grupos
   - Auto-agendamento dentro da janela do evento

## Teste completo (passo a passo)
1. Seed de dados
   - Com DB local configurada, correr:
     - TS_NODE_COMPILER_OPTIONS='{"allowImportingTsExtensions":true}' USER_ID_TEST=<auth.users.id> npx ts-node scripts/seed_padel.ts
   - Guardar o eventId e slug que o script imprime.

2. Padel Hub (organizacao)
   - Abrir /organizacao/torneios?eventId=<eventId>
   - Ir a "Padel > Calendario"
   - Confirmar:
     - Timeline com jogos e drag & drop
     - Lista com itens agrupados por dia
     - Conflitos (se existir) visiveis
     - Troca de vista nao quebra layout

3. Criacao de torneio (wizard)
   - Abrir /organizacao/torneios/novo
   - Selecionar preset Padel
   - Testar toggle de origem de clube:
     - Meus clubes: selecionar clube e courts
     - Diretorio: importar clube parceiro
   - Confirmar que courts e staff ficam disponiveis

4. Auto-agendamento
   - No Padel Hub, usar "Auto-agendar jogos"
   - Validar janela do evento, slot, buffer, descanso
   - Confirmar que jogos recebem horarios e court

5. Mobile
   - Em resolucao pequena, validar:
     - Switch Timeline/Lista acessivel
     - Lista nao estoura layout
     - Cards nao crescem de forma irregular

## Notas
- O seed e seguro para correr varias vezes (cria evento novo por execucao).
- Se quiser reusar um eventId, ajustar o script para aceitar slug fixo.
