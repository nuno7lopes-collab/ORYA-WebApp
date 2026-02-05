# Cost optimization (prod)

Goal: minimize AWS cost without sacrificing robustness.

## ECS/Fargate
- Keep web service on **FARGATE** (min 2 tasks for HA).
- Use **FARGATE_SPOT** for worker with on-demand fallback (already in infra skeleton).
- Consider scheduled scaling for low-traffic windows (reduce worker desired count).

## ECR
- Lifecycle policy: keep last 20 images (enabled in CFN skeleton).

## CloudWatch
- Log retention: 14–30 days (parameterized in CFN).
- Use Insights queries for debugging; avoid full export unless necessary.

## ALB
- Keep a single ALB per environment.
- Enable access logs only when needed to reduce S3 costs.

## EventBridge
- Use a 1-minute schedule for outbox; avoid overly frequent schedules.

## Secrets Manager
- One secret per key for least privilege.

## Observability
- AWS‑only: CloudWatch Logs + native ALB/ECS metrics (evita custos de custom metrics).

## Supabase
- Monitor DB usage; keep connection pooling configured.
