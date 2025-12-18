# Entitlement Snapshot Policy (Bloco 3)

Snapshot é guardado na linha do entitlement e é a fonte padrão para UI/Emails, evitando regressões quando o evento muda.

## Campos mínimos
- snapshotTitle
- snapshotCoverUrl
- snapshotVenueName
- snapshotStartAt
- snapshotTimezone

## Regras de apresentação
- UI/Emails usam o snapshot por defeito.
- Se houver dados atualizados do evento, mostrar apenas como informação secundária (“Atualizado”), nunca substituir silentemente o snapshot.
- Snapshot é preenchido/atualizado pelo worker (emissão/refresco); Bloco 3 não recalcula snapshot.

## Validação
- Todos os entitlements devem ter snapshot completo para renderizar cartão/detalhe/email sem dependências externas.
- Mudança de horário/local/capa do evento não altera retroativamente o snapshot salvo; novo valor só aparece em seção “Atualizado”.
