# Cost optimization (prod)

Objetivo: custo **mínimo possível** mantendo a plataforma funcional em produção
(não "0 euros" com local). Este documento define o **baseline atual** e não
propõe variantes "melhores".

## ECS/Fargate
- Web em **FARGATE** com **1 task** (custo mínimo; sem HA).
- Worker **desligado por padrão**; ligar apenas quando necessário e por janelas curtas.
- **Sem FARGATE_SPOT** por padrão; a poupança vem do dimensionamento mínimo e do tempo
  de execução, não de complexidade adicional.

## ECR
- Lifecycle policy: **manter as últimas 5 imagens** (rollback curto, custo mínimo).

## CloudWatch
- Retenção de logs: **30 dias** (mínimo aceitável para diagnóstico).
- Usar Insights apenas quando necessário; evitar exports.

## ALB
- **Um ALB** por ambiente.
- Access logs só quando necessário.

## EventBridge
- Agendamentos **apenas se necessários** e no intervalo mínimo.

## Secrets Manager
- Um segredo por chave (mínimo necessário).

## Observabilidade
- AWS‑only: CloudWatch Logs + métricas nativas (sem métricas custom).

## Supabase
- Monitorar uso de DB; pooling configurado para evitar custo extra.
