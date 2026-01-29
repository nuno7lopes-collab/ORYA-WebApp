# Deploy rollback (prod)

## ECS rollback
1) Identify last known good task definition revision.
2) Update service to that revision.

```bash
aws ecs update-service --cluster orya-prod --service orya-prod-web --task-definition orya-web:REVISION
aws ecs update-service --cluster orya-prod --service orya-prod-worker --task-definition orya-worker:REVISION
```

## ALB
- Keep previous target group healthy; avoid forced deregistration.

## Validate
- `/api/internal/health` returns 200
- Smoke test checkout page

## Post-rollback
- Capture logs and requestIds for incident analysis.
