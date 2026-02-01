# Runbook - DSAR (RGPD)

Objetivo: cumprir pedidos de titular de dados (export + delete) com tracking e evidência.

## Exportar dados (download my data)
Endpoint:
- `GET /api/me/dsar/export`

Notas:
- Requer sessão válida.
- Resposta inclui `dsarCaseId` + payload consolidado.

## Delete account (DSAR delete)
Endpoints:
- `POST /api/me/settings/delete` (agenda eliminação)
- `POST /api/me/settings/delete/cancel` (cancelar dentro da janela)

Tracking:
- Cada pedido cria/atualiza `dsar_cases`.
- Status final marcado quando o purge automático corre.

## Operação (purge)
Endpoint admin:
- `POST /api/admin/users/purge-pending`

Fluxo:
- Anonimiza perfil + remove memberships.
- Atualiza `dsar_cases` para COMPLETED.
- Se houver legal hold (ex.: vendas/tickets em disputa), regista `legalHold=true` nos metadados e mantém dados financeiros intactos.

## Retenção (resumo)
Categorias e tratamento no delete:
- Financeiro/Auditoria: preservar por obrigação legal; remover PII direta.
- Identidade/Perfil: manter ID pseudónimo; limpar nome/email/telefone.
- Tickets/Entitlements/Check-in: preservar integridade; owner passa a pseudónimo quando aplicável.
- Notificações/Support: remover PII quando possível.

## O que NÃO fazer
- Não eliminar dados financeiros/ledger.
- Não exportar segredos ou dados de terceiros.
- Não apagar manualmente rows sem registo de auditoria.
