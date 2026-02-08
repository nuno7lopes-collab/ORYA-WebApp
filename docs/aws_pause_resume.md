# AWS Pause/Start (prod)

Este runbook cria um "pause" controlado para reduzir custos de:
- Amazon Elastic Load Balancing (ALB)
- Amazon ECS (Fargate)
- Amazon VPC (custos de IPv4 publico associados ao ALB)

## O que o pause faz
- Remove o ALB do stack (via CloudFormation), eliminando custo de Load Balancer e IPs publicos associados.
- Faz scale do ECS para 0 (Fargate para).
- Guarda estado (parametros do stack + desired counts) num ficheiro local.

Impacto: **downtime total** enquanto estiver pausado.

## O que o start faz
- Recria o ALB se estava ativo antes do pause.
- Restaura parametros do stack e desired counts anteriores.
- Faz scale do ECS para os valores originais.

## Requisitos
- AWS CLI configurado
- Profile com acesso a CloudFormation/ECS/ELB
- `AWS_PROFILE` e `AWS_REGION` definidos (ou defaults `codex` e `eu-west-1`)
- Stack CloudFormation em estado estavel (`UPDATE_COMPLETE` ou `UPDATE_ROLLBACK_COMPLETE`)

## Uso

Pause:
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/aws/pause-prod.sh
```

Start:
```bash
AWS_PROFILE=codex AWS_REGION=eu-west-1 scripts/aws/start-prod.sh
```

Opcional (dry-run):
```bash
DRY_RUN=true scripts/aws/pause-prod.sh
DRY_RUN=true scripts/aws/start-prod.sh
```

Estado:
- Fica em `scripts/aws/state/orya-prod-pause.json` (podes definir `STATE_FILE`).

## Notas importantes
- O pause remove o ALB e pode apagar registos DNS (se existirem no stack).
- O VPC nao e apagado; apenas deixam de existir custos de IPv4 publico associados ao ALB.
- Se precisares de manter DNS ativo, nao uses este pause.
- Se precisas de Free Tier no CloudWatch, desativa `Container Insights` no ECS.
- Para pausar novamente, remove o ficheiro de estado ou define `STATE_FILE` para um novo caminho.
