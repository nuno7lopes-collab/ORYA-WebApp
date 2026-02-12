# Discover + Geo Manual Monitoring (Dev)

## Objetivo
Monitorização manual dos fluxos de descoberta e geocoding sem alarmes automáticos.

## Escopo
- `GET /api/address/autocomplete`
- `GET /api/address/details`
- `GET /api/address/reverse`
- `GET /api/explorar/list`
- `GET /api/padel/discover`
- `GET /api/padel/public/open-pairings`
- `GET /api/servicos/list`
- `POST /api/me/events/signals`

## Rotina recomendada (durante desenvolvimento)
1. Executar navegação manual em `/descobrir/eventos`, `/descobrir/torneios`, `/descobrir/reservas`.
2. Validar respostas HTTP e payload em DevTools (Network).
3. Confirmar que filtros `city`, `date`, `price` e `categories` são refletidos nas requests.
4. Forçar cenários de erro (query inválida, timeout local, serviço indisponível).
5. Inspecionar logs estruturados por scope:
   - `api.address.autocomplete`
   - `api.address.details`
   - `api.address.reverse`
   - `api.explorar.list`
   - `api.padel.discover`
   - `api.padel.public.open_pairings`
   - `api.servicos.list`
   - `api.me.events.signals`

## Checklist operacional rápido
- [ ] `city` aplicado em todos os mundos.
- [ ] `date=upcoming` devolve resultados consistentes em eventos/padel.
- [ ] `/api/explorar/list` devolve `500` em erro interno (sem fallback 200 silencioso).
- [ ] Sinais `CLICK/VIEW/DWELL/FAVORITE/HIDE_EVENT` chegam ao backend quando autenticado.
- [ ] Guest não persiste sinais no backend.

