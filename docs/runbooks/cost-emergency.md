# Cost Emergency (Hard Pause)

## Objetivo
Parar custos rapidamente em produção.

## Passos
1. Hard pause da stack:
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \
  scripts/deploy-cf.sh --hard-pause
```
2. Confirmar que o stack foi removido:
```bash
aws cloudformation describe-stacks --stack-name orya-prod
```
3. Se houver serviços ainda ativos, forçar `desiredCount=0`.

## Nota
- Reativação requer `scripts/deploy-cf.sh --resume`.
