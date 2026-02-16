# Split V2 SSOT Bridge (Recovered)
Estado documental: `NORMATIVO_TRANSICAO_B1_B9`

## Escopo
Documento ponte de transicao para regras de split, com norma consolidada no SSOT.

## Decisoes fechadas
- Nome canonico unico: `SPLIT_GARANTIDO`.
- Contrato legado D12 (48/24) esta revogado como norma ativa.
- Norma ativa de split: `S01..S09` conforme `G08.002`.
- Snapshot de liquidacao e imutavel e versionado.
- Fluxo de settle/debt/outbox deve ser idempotente.
- Validacao obrigatoria em Stripe sandbox (`test mode`), sem cobranca real.

## Mapeamento por orgType
- `EXTERNAL` -> Stripe Connect (Standard nesta fase).
- `PLATFORM` -> conta Stripe da ORYA (nao-Connect).

## Referencias no SSOT
- `docs/ssot_registry_v1.md`: `G08.002`, `G08.003`, aditamento owner (`101`) e indice de gaps (`102`).
