# CI/CD (GitHub Actions → ECS)

This repository ships with `.github/workflows/deploy-ecs.yml` for prod deploys.

## Required repo secrets
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (e.g. `eu-west-1`)
- `AWS_ACCOUNT_ID` (e.g. `495219734037`)
- `ECR_REPOSITORY_WEB` (e.g. `orya-web`)
- `ECR_REPOSITORY_WORKER` (e.g. `orya-worker`)
- `ECS_CLUSTER` (e.g. `orya-prod`)
- `ECS_SERVICE_WEB` (e.g. `orya-prod-web`)
- `ECS_SERVICE_WORKER` (e.g. `orya-prod-worker`)

## Optional (OIDC instead of static keys)
Configure `aws-actions/configure-aws-credentials` with OIDC and set:
- `AWS_ROLE_TO_ASSUME`
- `AWS_REGION`

## TaskDefinition rendering
`deploy-ecs.yml` runs `scripts/render-taskdef.py` to replace:
- `{{ECR_URI}}` → `${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com`
- `{{orya/prod/NAME}}` → `arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:orya/prod/NAME`

## Coverage & lint
The workflow runs:
- `npm run lint`
- `npx vitest run --coverage`

Ensure `@vitest/coverage-v8` is present in devDependencies.

## Mock mode (tests)
To force mock-only behavior in tests, run:
```bash
USE_MOCKS=true npm run test
```
Or use `scripts/test-with-mocks.sh`.
