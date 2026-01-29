# Sentry + CloudWatch integration

## Setup
- Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in Secrets Manager (prod).
- Ensure ECS task definitions inject the env vars.

## What to look for
- Traces include `requestId` / `correlationId` in logs.
- Use Sentry search by `requestId` to jump from API failure to logs.

## CloudWatch Logs
Log group naming convention:
- `/ecs/orya/prod/web`
- `/ecs/orya/prod/worker`

### Insights queries
Find errors by requestId:
```sql
fields @timestamp, @message
| filter @message like /requestId=REQ_ID_HERE/ or @message like /correlationId=REQ_ID_HERE/
| sort @timestamp desc
| limit 50
```

Find Stripe webhook failures:
```sql
fields @timestamp, @message
| filter @message like /stripe/ and @message like /webhook/ and @message like /failed/
| sort @timestamp desc
| limit 50
```

Find outbox DLQ:
```sql
fields @timestamp, @message
| filter @message like /outbox.dead-letter/
| sort @timestamp desc
| limit 50
```
