# Organizacoes e Multi-Organizacoes - Contratos Canonicos

## 1) Estado
- Estado de produto: FECHADO.
- Estado de decisao: sem pendencias de produto.
- Proxima fase: implementacao tecnica.

## 2) Glossario Canonico
- Group: entidade mae de agregacao.
- Organization: entidade operacional (filial).
- OWNER (Group): owner unico do group.
- OWNER (Organization): owner unico de cada organizacao.
- CO_OWNER (Organization): papel operacional elevado na organizacao.

## 3) Contrato Estrutural
- Nome canonical: Group.
- Group e read-only de dominio (agregacao/visao).
- Excecao no Group: governanca de membership (entrada/saida de organizacoes).
- Group tem exatamente 1 OWNER (sem CO_OWNER/Admin no nivel Group).
- O OWNER do Group deve ser OWNER em todas as organizacoes do Group.
- Cada Organization tem exatamente 1 OWNER.
- Cada Organization pode ter varios CO_OWNER.

## 4) Contrato de Criacao e Onboarding
- Fluxo canonical de criacao: /api/org-hub/organizations.
- /api/org-hub/become fica deprecado.
- Onboarding por passos, com navegacao frente/tras sem efeitos finais.
- Username nao fica reservado durante preenchimento.
- A criacao final so acontece no clique explicito em "Criar organizacao".
- Nesse clique final, a validacao e atomica:
  - email oficial verificado,
  - username disponivel,
  - dados obrigatorios validos.
- Se falhar no clique final, nao cria organizacao nem reserva username.

## 5) Contrato de Entrada de Organization em Group
- Entrada exige consentimento forte bilateral.
- Handshake tecnico:
  - 2 codigos secretos (uma parte gera o seu codigo e a outra parte gera o seu),
  - TTL do codigo: 10 min,
  - janela de pareamento: 5 min,
  - max 5 tentativas,
  - lockout 30 min apos exceder tentativas,
  - anti-replay: codigo one-time, invalida no uso e no reenvio.
- Confirmacao por email obrigatoria de ambos os OWNERs.
- Politica email:
  - TTL link 30 min,
  - max 3 reenvios/hora (max 6 por operacao),
  - reenvio invalida tokens anteriores,
  - operacao expira em 24h sem dupla confirmacao.

## 6) Contrato de Saida de Organization do Group
- Saida exige aprovacao explicita do OWNER do Group.
- Fluxo obriga escolha:
  - manter owner atual da organization de saida, ou
  - trocar owner por username antes de concluir.
- Se houver troca de owner na saida:
  - exige duplo codigo (owner atual + owner novo),
  - exige confirmacao por email de ambos,
  - so depois efetiva a saida.
- Auditoria obrigatoria de todo o fluxo (before/after).

## 7) Contrato RBAC e Acoes de Risco
- Group:
  - apenas OWNER unico para governanca de membership.
- Organization:
  - OWNER unico,
  - CO_OWNER com poderes operacionais amplos.
- Acoes exclusivas de OWNER (risco):
  - Stripe account,
  - dados fiscais,
  - payouts,
  - official email,
  - transfer ownership,
  - delete organization,
  - entrada/saida de group,
  - remocao do OWNER,
  - alteracoes criticas de conta.

## 8) Contrato de Contexto, Rotas e Canonicalidade
- /api/org/:orgId/*: orgId canonical por path.
- /api/org-hub/*: pode aceitar body/query para operacoes de hub.
- Hard-cut legacy aprovado:
  - remover /organizacao/*,
  - remover /api/organizacao/*,
  - sem excecoes.
- Hard-cut fisico global e imediato, com eliminacao total de re-exports legacy no write-path.

## 9) Contrato Cross-Org e Parcerias
- Recurso partilhado cross-org: chave global por autoridade:
  - resourceType:authorityOrgId:resourceId
- Parcerias: modelo hibrido
  - contrato base transversal,
  - extensoes por modulo.

## 10) Contrato de Support / Recovery (D-MO-17)
- Owner recovery e break-glass nao sao self-service.
- Abertura de ticket e apenas por formulario de suporte.
- Email do requester e obrigatorio no formulario.
- Email direto para admin@orya.pt nao abre ticket automaticamente.
- Ticket gera:
  - numero,
  - assunto canonical: [TICKET-<numero>] <assunto_user>,
  - descricao,
  - trilha de auditoria.
- Estados canonicos v1:
  - OPEN,
  - IN_PROGRESS,
  - CLOSED.
- Tratamento operacional na consola admin (secao suporte/tickets).
- Execucao por administradores da plataforma, com auditoria completa.

## 11) Migração e Operacao
- Cutover global unico (nao faseado).
- Higienizacao e limpeza total de legacy.
- Runbooks, logs e eventos com naming canonical unico:
  - /org,
  - /org-hub.
- Sem convivencia legacy em operacao final.

## 12) Decisoes Aprovadas (Mapa Final)
- D-MO-01: Group como entidade canonical de agregacao.
- D-MO-02: criacao canonical em /api/org-hub/organizations.
- D-MO-03: default single-org em 1 group; multi-org quando >=2 orgs.
- D-MO-04: entrada no group com duplo codigo + email bilateral.
- D-MO-05: saida com aprovacao do owner do group.
- D-MO-06: contrato de org context por superficie.
- D-MO-07: hard-cut legacy total.
- D-MO-08: hard-cut fisico global e imediato.
- D-MO-09: group read-only de dominio, com excecao para governanca de membership.
- D-MO-10: chave global de recurso partilhado cross-org.
- D-MO-11: parcerias hibridas (base + extensoes).
- D-MO-12: onboarding com criacao atomica no clique final.
- D-MO-13: RBAC final group/organization.
- D-MO-14: lista final de acoes exclusivas de owner.
- D-MO-15: politica final de codigos (TTL/tentativas/lockout/anti-replay).
- D-MO-16: politica final de confirmacao por email (TTL/reenvio/expiracao).
- D-MO-17: support/recovery por ticket na consola admin.
- D-MO-18: cutover global unico com rollback por release.
- D-MO-19: runbook e observabilidade canonical sem legacy.
- D-MO-20: saida de org com manter/trocar owner e dupla confirmacao na troca.

## 13) Resultado
- Contratos fechados.
- Regras fechadas.
- Canonicalidade fechada.
- Documento pronto para guiar implementacao.
