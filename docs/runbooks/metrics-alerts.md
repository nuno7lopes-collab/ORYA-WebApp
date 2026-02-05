# Runbook — Metricas e alertas (minimo v10)

Objetivo: definir alertas basicos para operacao sem gaps.

## Fontes (AWS-only, baixo custo)
- Logs estruturados (requestId/correlationId) via CloudWatch Logs.
- Métricas nativas do ALB/ECS (sem custom metrics).
- `/api/internal/ops/health` e `/api/internal/ops/slo`.

## Alertas mínimos (AWS-only, sem custo extra)
- **ALB 5xx**:
  - `HTTPCode_Target_5XX_Count` > 0 por 5 min.
- **ECS task restarts**:
  - `ServiceRunningTasksCount` < desejado por 5 min.
- **CPU/Mem**:
  - `CPUUtilization` ou `MemoryUtilization` > 80% por 10 min.

## SLO basico (proposta)
- Disponibilidade API core: 99.5%/30d (checkout, webhook, worker).
- Outbox publish: < 5 min backlog em 95% do tempo.
- Check-in: 99% respostas < 2s.
 - Definicao completa: `docs/observability/slo_sli.md`.

## CloudWatch (exemplo)
- Criar alarmes com métricas nativas (ALB/ECS) acima.
- Não usar custom metrics para evitar custos adicionais.
## Notas
- Sem alertas -> blind spots.
- Ajustar thresholds por ambiente (staging vs prod).
 - Retenção de logs: 7–14 dias para minimizar custo.
 - `LOG_LEVEL=warn` em produção reduz volume.
