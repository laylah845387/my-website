import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient<any>> | null = null;

export function getSupabase(): ReturnType<typeof createClient<any>> {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    client = createClient<any>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
