# Reservas Hibridas (Local)

## Postgres Local (Docker)
1. `npm run db:local:up`
2. `npm run db:local:deploy`
3. Preparar dados manualmente (o seed automático foi removido).

## Smoke (3 modos)
1. `npm run dev`
2. `npm run smoke:local:reservas:hybrid -- --base-url=http://localhost:3000 --username=top_padel --max-days=7`

## Limpar DB local
- `npm run db:local:down`
