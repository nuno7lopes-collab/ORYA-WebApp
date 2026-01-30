# Pause/Resume Prod

## Objetivo
Pausar e retomar a infra de produção com custo mínimo, preservando segurança.

## Soft pause (scale-to-zero)
- Mantém a stack, reduz tasks a 0.

```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \
  scripts/deploy-cf.sh --pause
```

## Resume (scale-up)
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \
  scripts/deploy-cf.sh --resume
```

## Hard pause (delete stack)
> Use apenas em emergência ou fora de horas.

```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \
  scripts/deploy-cf.sh --hard-pause
```

## Verificações
- `scripts/healthcheck.sh https://app.orya.pt`
- CloudWatch logs ativos e sem erros 5xx.
- `aws ecs describe-services` com desiredCount esperado.
