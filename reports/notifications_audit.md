# Auditoria de Notificações ORYA (Full Stack)

## Escopo
- Backend: schema, outbox/consumer, prefs, APIs e triggers de criação.
- Web: NotificationBell e SocialHub.
- Mobile: feed, ações inline, navegação e badges.

## Inventário por ficheiro (resumo)
- `prisma/schema.prisma`
  - Enum `NotificationType` e modelos `Notification`, `NotificationPreference`, `NotificationMute`, `NotificationOutbox`.
  - Ponto crítico: dispersão de categorias e preferências (corrigido via registry).
- `domain/notifications/registry.ts`
  - Fonte única de verdade para categoria, copy, CTA, ações, prioridade e validação de campos obrigatórios.
- `domain/notifications/prefs.ts`
  - Mapeamento único categoria → preferências.
- `domain/notifications/consumer.ts`
  - Geração de notificações a partir do outbox.
  - Antes: copy ad‑hoc e fallback genérico.
  - Agora: usa registry para NotificationType, push respeita prefs por tipo e mutes.
- `lib/notifications.ts`
  - Criação canónica com dedupe + payload.
  - Sanitização de `ctaUrl` e validação de campos obrigatórios.
- `app/api/me/notifications/feed/route.ts`
  - Feed agregado, agrupamento 24h e filtros por prefs/mutes.
  - Copy/CTA/ações migradas para registry.
  - Payload e payloadKind expostos para UI (ex: pairing invite).
- `app/api/notifications/mark-read/route.ts`
  - Marca como lidas sem tab; exclui chat por defeito.
- `app/api/notifications/mark-click/route.ts`
  - Mantém tracking de campanhas (CRM).
- `app/components/notifications/NotificationBell.tsx`
  - Consome feed agregado, filtros client‑side, sem dependência do endpoint legacy.
- `app/social/page.tsx`
  - Consome feed agregado, mostra ações inline (accept/decline/follow/open).
- `apps/mobile/features/notifications/*`
  - API e hooks simplificados (sem tabs).
- `apps/mobile/app/notifications/index.tsx`
  - Ações inline continuam, sem dependência de tab no backend.

## Pontos Críticos Identificados
- Duplicação de copy/CTA no feed e no consumer → consolidado no registry.
- Fallbacks genéricos (“Notificação”) em vários caminhos → removidos/evitados.
- Push ignorava prefs por tipo → agora respeita `shouldNotify`.
- `ctaUrl` podia apontar para `/notifications` → sanitizado.

## Decisões Aplicadas
- Registry central para copy/CTA/ações/categorias/push.
- Soft‑migration (sem reescrever notificações antigas na BD).
- Web e mobile unificados no feed agregado.
- PT‑PT como língua única.

## Próximos passos recomendados
- Monitorizar logs de `missing_fields` para identificar notificações com contexto incompleto.
- Validar em staging a consistência de `ctaUrl` por tipo.
