import { createClient } from "npm:@supabase/supabase-js";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_PUBLIC_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BUCKET = Deno.env.get("EXPO_PUBLIC_SUPABASE_BUCKET") || "profile-photos";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

async function deleteStorageFolder(userId: string) {
  // List objects under the user's folder and remove them
  const listRes = await supabase.storage
    .from(BUCKET)
    .list(`${userId}/`, { limit: 1000 });
  if (listRes.error) throw listRes.error;
  const objects = listRes.data || [];
  if (objects.length === 0) return;
  const keys = objects.map((o: any) => o.name);
  const delRes = await supabase.storage.from(BUCKET).remove(keys);
  if (delRes.error) throw delRes.error;
}

serve(async (req) => {
  try {
    const auth = req.headers.get("authorization");
    if (!auth)
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401 },
      );
    const token = auth.replace("Bearer ", "");

    // Verify token and get user
    const { data: userData, error: userErr } =
      await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
      });
    }

    const userId = userData.user.id;

    // 1) Delete storage objects in user's folder
    await deleteStorageFolder(userId);

    // 2) Call RPC to delete related DB rows
    const rpc = await supabase.rpc("delete_user_and_relations", {
      uid: userId,
    });
    if (rpc.error) throw rpc.error;

    // 3) Delete the Auth user
    const delUser = await supabase.auth.admin.deleteUser(userId);
    if (delUser.error) throw delUser.error;

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    console.error("delete-account error", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
    });
  }
});
