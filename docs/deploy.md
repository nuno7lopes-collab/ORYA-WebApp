o comando `git push origin developer` ativa o deploy automático do **web** (não publica worker).

para publicar worker, usa `workflow_dispatch` no GitHub Actions com `target=worker` (ou `all`).

o workflow de deploy aplica migrations (`npm run db:deploy`) antes do rollout ECS e valida drift com `npm run db:status`.
