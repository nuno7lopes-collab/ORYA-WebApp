## Branches e ambientes

- `main` → produção (porto seguro, auth estável). Deploy de produção em Vercel.
- `developer` → dev contínuo com novas áreas (admin, checkout, organizador/Stripe, home) mas lógica de auth da `main`. Deploy de preview/staging em Vercel.

## Fluxo de trabalho

- Desenvolvimento normal: `git checkout developer` → commits → `git push origin developer` (gera preview ligado à DB DEV).
- Release: `git checkout main` → `git merge developer` (ou PR) → `git push origin main` (deploy produção).
- Hotfix prod: `git checkout main`, corrigir, `git push origin main`; depois `git checkout developer` → `git merge main` → `git push origin developer`.
- Se a `developer` ficar estragada: `git checkout developer` → `git reset --hard main` → `git push -f origin developer` (só se necessário).

## Supabase

Recomendado: projeto separado para DEV (ex.: `orya-dev`) com schema clonado da produção (`orya_supabase_schema.sql` ou migrations).  
Ambiente PROD (main) usa o projeto atual.  
Ambiente DEV (developer) usa o projeto novo.

Variáveis a definir em Vercel:
- PROD (main): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- DEV/previews (developer): mesmos nomes mas apontados ao projeto DEV.

## Stripe / Resend / webhooks

- Guardar chaves separadas para DEV (Stripe test mode) e PROD.  
- Configurar webhooks de Stripe/Resend para o domínio de preview (developer) com as chaves de DEV, e para o domínio prod (main) com chaves de PROD.

## Deploys em Vercel

- Production branch: `main` → domínio prod (ex.: `https://orya.pt`).  
- Preview branches (incl. `developer`): URLs `https://<project>-git-<branch>-*.vercel.app` → usar envs DEV.
