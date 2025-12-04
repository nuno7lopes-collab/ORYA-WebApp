import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local (fallback to .env)
config({ path: ".env.local" });
config();

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
const email = process.argv[2];

if (!url || !serviceRole) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env.");
  process.exit(1);
}
if (!email) {
  console.error("Usage: ts-node hard-delete-user.ts user@example.com");
  process.exit(1);
}

async function main() {
  const supabase = createClient(url as string, serviceRole as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    console.error("listUsers error:", error);
    process.exit(1);
  }
  const user = data?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!user) {
    console.log("User not found for email", email);
    return;
  }

  const { error: delErr } = await supabase.auth.admin.deleteUser(user.id, false);

  if (delErr) {
    console.error("deleteUser error:", delErr);
    process.exit(1);
  }

  console.log("Hard deleted user", user.id, "for email", email);
}

main();
