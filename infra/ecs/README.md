# ORYA ECS/Fargate (prod) — Skeleton

This folder contains infrastructure-as-code artifacts for prod-ready ECS Fargate with ALB, ECR, IAM roles, and EventBridge run-task for outbox.

## Files
- `orya-ecs-stack.yaml` — CloudFormation skeleton (ALB + ECS + ECR + IAM + EventBridge)
- `route53-acm.yaml` — ACM cert + Route53 DNS validation (skeleton)
- `taskdef-web.json` — task definition example for web
- `taskdef-worker.json` — task definition example for worker

## Placeholders
Secrets are referenced by name only (no values). Replace placeholders like `{{orya/prod/DATABASE_URL}}` with the full Secrets Manager ARN:

`arn:aws:secretsmanager:eu-west-1:495219734037:secret:orya/prod/DATABASE_URL`

## Deploy outline
1) Create/ensure ACM cert for the domain and validate in Route53.
2) Deploy `orya-ecs-stack.yaml` with your VPC/Subnet IDs and images.
3) Register task definitions (or use the CFN task resources) and update ECS services.
4) Ensure ALB health check points to `/api/internal/health`.

## Minimal parameters
- `VpcId`, `PublicSubnets`, `PrivateSubnets`
- `AlbCertificateArn`
- `WebImage`, `WorkerImage`

## Notes
- Health check uses `x-orya-cron-secret` header. Ensure `ORYA_CRON_SECRET` is available.
- Worker uses Fargate Spot with fallback to Fargate for cost control.
