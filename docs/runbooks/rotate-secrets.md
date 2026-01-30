# Rotate Secrets

## Objetivo
Atualizar secrets no AWS Secrets Manager sem expor valores no repo.

## Processo (prod + dev)
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \
  scripts/upload-secrets.sh /tmp/orya-prod-secrets.json
```

## Rotação por grupo
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 \
  ONLY_GROUPS=payments ONLY_ENVS=prod \
  scripts/create-secrets-json.sh /tmp/orya-prod-secrets.json
```

## Notas
- Valores vazios ou `REPLACE_ME_*` são ignorados.
- Para dev, placeholders são permitidos (`ALLOW_PLACEHOLDERS_DEV=true`).
