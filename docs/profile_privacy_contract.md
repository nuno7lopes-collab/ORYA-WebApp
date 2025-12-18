# Profile Privacy Contract (Bloco 3)

Hard rules
- Wallet só visível no perfil privado do próprio utilizador autenticado.
- Perfil público nunca mostra entitlements (mesmo que o owner queira partilhar).
- ADMIN pode aceder via ferramentas de suporte, não via perfil público.

Implementação
- Rota `/me/wallet` requer sessão; 403 se não for o próprio.
- Páginas públicas de perfil (ex.: `/u/[username]`) não carregam wallet nem contagem de entitlements.
- URLs de detalhe `/me/wallet/[entitlementId]` não são acessíveis por terceiros (404/403).

Auditoria
- Logs devem incluir role/resultCode em qualquer tentativa de acesso indevido.
