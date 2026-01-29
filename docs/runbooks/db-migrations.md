# DB migrations (prod)

## Preflight
- Ensure `DATABASE_URL` and `DIRECT_URL` in Secrets Manager.
- Confirm `prisma migrate deploy` runs in read-write window.

## One-off task (ECS)
```bash
aws ecs run-task --cluster orya-prod \
  --task-definition orya-worker \
  --launch-type FARGATE \
  --overrides '{"containerOverrides":[{"name":"orya-worker","command":["npm","run","db:deploy"]}]}' \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-123],securityGroups=[sg-123],assignPublicIp=ENABLED}"
```

## Validation
- `npm run db:status` in a one-off task
- Check `prisma_migrations` table

## Rollback
- Use hotfix migration or manual SQL based on Prisma plan.
