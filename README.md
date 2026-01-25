This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database gates
- Prisma deve ser corrido via scripts (`npm run db:gates`).
- Os scripts aplicam caches locais em `.cache/` (não usar env inline).
- Se aparecer EPERM/ENOENT/Schema engine error, usa os scripts acima.
- Não corras `prisma` direto; usa `db:status`, `db:deploy`, `db:generate`.
- `.env` no root é a fonte canónica para Prisma CLI.
- `CHECKPOINT_DISABLE=1` deve estar ativo nos envs.
- Em CI, usa `npm run db:gates` (não usar comandos Prisma diretos).
- Em ambientes sem rede/DNS, usa `DB_GATES_MODE=offline npm run db:gates` (offline só valida/generate + testes).
- `DB_GATES_MODE=offline` é apenas para ambientes sem rede/DNS; em dev normal usa `npm run db:gates` (online default).

## Apple (D17) — envs mínimos
- Sign in with Apple:
  - `APPLE_SIGNIN_SERVICE_ID=`
  - `APPLE_SIGNIN_REDIRECT_URI=`
  - `APPLE_SIGNIN_TEAM_ID=`
  - `APPLE_SIGNIN_KEY_ID=`
  - `APPLE_SIGNIN_PRIVATE_KEY_BASE64=`
- APNs (token-based):
  - `APNS_TEAM_ID=`
  - `APNS_KEY_ID=`
  - `APNS_PRIVATE_KEY_BASE64=`
  - `APNS_TOPIC=`

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
