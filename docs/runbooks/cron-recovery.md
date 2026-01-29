# Cron recovery (prod)

## When to use
- scheduled jobs failed or not running
- data drift in reservations/loyalty/CRM

## Steps
1) Verify EventBridge rules are enabled.
2) Re-run job manually via ECS run-task or internal endpoint (requires ORYA_CRON_SECRET).

## Manual run examples
```bash
# Example: invoke cron endpoint
curl -s -H "x-orya-cron-secret: $ORYA_CRON_SECRET" https://app.orya.pt/api/cron/loyalty/expire

# Example: run task
aws ecs run-task --cluster orya-prod --task-definition orya-worker --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-123],securityGroups=[sg-123],assignPublicIp=ENABLED}"
```

## Validate
- Check CloudWatch logs for requestId/correlationId
- Verify job results in DB
