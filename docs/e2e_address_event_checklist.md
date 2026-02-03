# E2E Checklist Automatizada (Moradas + Eventos)

Este checklist valida o fluxo principal:

1. token Apple Maps (`/api/maps/apple-token`)
2. autocomplete de morada (`/api/geo/autocomplete`)
3. details + normalizacao (`/api/geo/details`)
4. criacao de evento com `locationSource=APPLE_MAPS`
5. listagem do evento na organizacao
6. edicao do evento mantendo morada normalizada
7. carregamento da pagina publica do evento
8. cleanup opcional (arquivar evento de teste)

## Comando

```bash
npm run e2e:address:checklist
```

## Variaveis de ambiente

- `ORYA_E2E_BASE_URL` (opcional, default: `http://localhost:3000`)
- `ORYA_E2E_COOKIE` (necessaria para passos autenticados create/update/list)
- `ORYA_E2E_ORGANIZATION_ID` (necessaria para passos autenticados)
- `ORYA_E2E_EVENT_ID` (opcional; usa evento existente em vez de criar novo)
- `ORYA_E2E_KEEP_EVENT` (opcional; `true` para nao arquivar evento criado)

## Exemplo

```bash
ORYA_E2E_BASE_URL=http://localhost:3000 \
ORYA_E2E_COOKIE='sb-access-token=...; sb-refresh-token=...' \
ORYA_E2E_ORGANIZATION_ID=2 \
npm run e2e:address:checklist
```

Se `ORYA_E2E_COOKIE`/`ORYA_E2E_ORGANIZATION_ID` nao forem fornecidas, o script executa apenas os passos publicos (Apple token + geo endpoints).
