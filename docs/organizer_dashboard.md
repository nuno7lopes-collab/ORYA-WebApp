# Organizer dashboard (mapa rápido)

- Secções esperadas: Informações do evento, Bilhetes & preços, Participantes/Inscrições, Vendas & relatórios, Staff & permissões.
- Cartões/listagens de eventos devem mostrar: nome, data, estado (draft/published/running/ended) e ações principais.
- Feedback: todos os POST/PUT/DELETE devem devolver toast de sucesso/erro com mensagem específica (escopo mínimo desta fase; redesign completo fica fora de scope).
- Erros de API: normalizar para `{ code, message }` e expor mensagens claras (evitar “Algo correu mal” genérico).
- Navegação: usar tabs/section keys consistentes entre servidor e cliente.
