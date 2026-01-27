# Covers Library (packs) — runbook

## SSOT (static)
- Assets: `public/covers/library/<categoria>/` (eventos, padel, reservas, geral)
- Thumbs: `public/covers/library/thumbs/<categoria>/` (`*.thumb.jpg`)
- Manifest: `lib/coverLibrary.ts` (gerado)

## Adicionar um pack (20 imagens)
1) Copiar originais para `public/covers/library/<categoria>/`
2) Gerar thumbs:
   - `npm run covers:thumbs`
3) Regenerar manifest:
   - `npm run covers:manifest`
4) Validar:
   - `npm run covers:validate`

## Como adicionar imagens novas em 30s
1) Copiar ficheiros para `public/covers/library/<categoria>/`
2) `npm run covers:all`
3) Abrir o modal e validar a biblioteca

## Regras (validate)
- filenames: kebab-case ASCII (ex: `padel-sunset-01.jpg`)
- thumb correspondente obrigatório (`.thumb.jpg`)
- `scenario`, `businessType`, `useCase` obrigatórios (enums fixos)
- `active` default `true`
- `priority` default `100` quando não definido
