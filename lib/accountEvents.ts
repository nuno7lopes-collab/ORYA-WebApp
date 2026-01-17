export async function logAccountEvent(params: {
  userId: string;
  type:
    | "account_delete_requested"
    | "account_delete_cancelled"
    | "account_delete_completed"
    | "account_restored"
    | "admin_user_ban"
    | "admin_user_unban"
    | "admin_user_hard_delete";
  metadata?: Record<string, unknown>;
}) {
  console.info("[accountEvents] event", {
    userId: params.userId,
    type: params.type,
    metadata: params.metadata ?? {},
  });
}
