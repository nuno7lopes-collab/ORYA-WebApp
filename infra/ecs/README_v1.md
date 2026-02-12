# ORYA ECS/Fargate (prod) — Skeleton

This folder contains infrastructure-as-code artifacts for prod-ready ECS Fargate with optional ALB, ECR, IAM roles, and EventBridge run-task for outbox.

## Files
- `orya-ecs-stack.yaml` — CloudFormation (ALB optional + ECS + ECR + IAM + EventBridge)
- `route53-acm.yaml` — ACM cert + Route53 DNS validation
- `taskdef-web.json` — task definition example for web
- `taskdef-worker.json` — task definition example for worker

## Placeholders
Secrets are grouped into JSON secrets (`orya/prod/app`, `orya/prod/supabase`, `orya/prod/payments`, `orya/prod/apple`, `orya/prod/email`, `orya/prod/admin`).

## Deploy outline
1) Create/ensure ACM cert for the domain and validate in Route53.
2) Deploy `orya-ecs-stack.yaml` with your VPC/Subnet IDs and images (ALB optional).
3) Register task definitions (or use the CFN task resources) and update ECS services.
4) Ensure ALB health check points to `/api/internal/ops/health`.

## Minimal parameters
- `VpcId`, `PublicSubnets`, `ServiceSubnets`, `AssignPublicIp`
- `AlbCertificateArn` (if `CreateALB=true`)
- `WebImage`, `WorkerImage`

## Notes
- Health check uses `x-orya-cron-secret` header. Ensure `ORYA_CRON_SECRET` is available.
- Worker uses Fargate Spot with fallback to Fargate for cost control.
- ECR lifecycle policy keeps last 5 images to control storage cost.
