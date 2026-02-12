# ORYA dev serverless (AWS SAM)

This template is a **minimal** serverless dev stack. It uses an HTTP API + Lambda container image.

## Notes
- The Lambda image should be built with a Lambda Web Adapter (or any compatible runtime) so it can serve HTTP requests.
- Secrets are read from `orya/dev/*` grouped JSON secrets.

## Deploy
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \
  IMAGE_URI=495219734037.dkr.ecr.eu-west-1.amazonaws.com/orya-web:latest \
  scripts/deploy-dev.sh
```

## Required inputs
- `IMAGE_URI`: ECR image built for Lambda (HTTP).
- `orya/dev/*` secrets must exist (use `scripts/upload-secrets.sh`).
