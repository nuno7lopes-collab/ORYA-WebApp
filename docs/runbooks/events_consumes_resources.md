# Runbook: Event `consumesResources`

## Objetivo
Operar e validar o bloqueio de recursos em eventos quando `consumesResources=true`, usando `agenda_resource_claims` como fonte canónica de bloqueio no calendário.

## Feature flag
- `FEATURE_EVENT_CONSUMES_RESOURCES=false` por omissão.
- Ativar em staging:

```bash
FEATURE_EVENT_CONSUMES_RESOURCES=true
```

## Validação em staging (smoke)
1. Criar evento com:
   - `consumesResources=true`
   - pelo menos um `professionalId` ou `resourceId`
2. Publicar evento.
3. Verificar claims criados:

```sql
SELECT id, source_type, source_id, resource_type, resource_id, starts_at, ends_at, status
FROM app_v3.agenda_resource_claims
WHERE source_type = 'EVENT'
  AND source_id = '<EVENT_ID>'
ORDER BY id DESC;
```

4. Tentar criar reserva sobreposta no mesmo recurso/profissional:
   - Resultado esperado: `409` com `AGENDA_CONFLICT`.
5. Editar evento (horário/recursos):
   - Resultado esperado: claims antigos libertados e claims novos aplicados sem duplicados.
6. Apagar draft (`deleteDraft=true`):
   - Resultado esperado: claims libertados + evento removido.

## Diagnóstico de conflitos
### Claims ativos por organização
```sql
SELECT source_id, resource_type, resource_id, starts_at, ends_at, status
FROM app_v3.agenda_resource_claims
WHERE organization_id = <ORG_ID>
  AND source_type = 'EVENT'
  AND status = 'CLAIMED'
ORDER BY starts_at ASC;
```

### Overlaps com bookings
```sql
SELECT b.id AS booking_id, b.starts_at, b.duration_minutes, b.professional_id, b.resource_id, b.court_id
FROM app_v3.bookings b
WHERE b.organization_id = <ORG_ID>
  AND b.starts_at < <RANGE_END>
  AND (b.starts_at + make_interval(mins => b.duration_minutes)) > <RANGE_START>;
```

## Métricas esperadas (logs estruturados)
- `event_consumes_resources.create`
- `event_consumes_resources.update`
- `event_consumes_resources.delete`
- `event_consumes_resources.conflict`

Exemplo de log:

```json
{"kind":"event_metric","metric":"event_consumes_resources.conflict","organizationId":12,"eventId":99,"conflictsCount":1}
```

## Troubleshooting rápido
1. Confirmar feature flag ativa em runtime.
2. Confirmar seleção em `app_v3.event_resources`.
3. Confirmar claims em `app_v3.agenda_resource_claims` com `status='CLAIMED'`.
4. Se conflito inesperado, comparar janelas temporais (`starts_at`/`ends_at`) com bookings/class sessions.
5. Se necessário, repetir publish após corrigir recursos/horário.

## Rollback
1. Desativar feature:

```bash
FEATURE_EVENT_CONSUMES_RESOURCES=false
```

2. Libertar claims de evento que tenham ficado ativos (apenas operação controlada):

```sql
UPDATE app_v3.agenda_resource_claims
SET status = 'RELEASED'
WHERE source_type = 'EVENT'
  AND status = 'CLAIMED'
  AND organization_id = <ORG_ID>;
```

3. Revalidar criação de reservas e publicar evento sem consumo de recursos.
