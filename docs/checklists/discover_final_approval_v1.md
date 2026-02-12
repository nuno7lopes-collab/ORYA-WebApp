# Descobrir Final Approval Checklist (Dev)

## Funcional
- [ ] `/descobrir` abre em `Eventos`.
- [ ] `date=upcoming` funciona no web sem degradar para `all`.
- [ ] Estado vazio mostra sugestões assistidas (não apenas limpar filtros).
- [ ] CTA explícito para app (`orya://map`) visível no web.

## API / Contratos
- [ ] `GET /api/servicos/list` aplica `city`.
- [ ] `GET /api/padel/discover` aplica `city`.
- [ ] `GET /api/padel/public/open-pairings` aplica `city`.
- [ ] `GET /api/explorar/list` devolve erro real com status `500` em falha.

## Personalização / Ranking
- [ ] Web envia sinais autenticados: `CLICK`, `VIEW`, `DWELL`, `FAVORITE`, `HIDE_EVENT`.
- [ ] Guest fica em estado local (sem persistência de sinal).
- [ ] Dedupe/throttle ativo para sinais de interação rápida.

## Qualidade
- [ ] Testes novos/alterados passam.
- [ ] Não há regressões nos testes de pesquisa existentes.
- [ ] Logs estruturados ativos nos endpoints geocoding/discover/sinais.

## Evidências
- [ ] Anexar resultados de teste desta entrega.
- [ ] Anexar matriz de contratos API antes/depois.
- [ ] Anexar capturas manuais antes/depois (loading, resultados, vazio, erro).

