import { createClient } from "@/lib/supabase/client";

/**
 * Ensures the current browser has a Supabase session (anonymous sign-in under the
 * hood) and a matching `users` row with the given display name. Anonymous auth is
 * invisible to the player — they just typed their name — but it gives them a real
 * auth.uid() so RLS can enforce role/word secrecy server-side.
 */
export async function ensureGuestSession(displayName: string) {
  const supabase = createClient();

  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    user = data.user;
  }
  if (!user) throw new Error("Failed to establish a session");

  const { error: upsertError } = await supabase
    .from("users")
    .upsert({ id: user.id, display_name: displayName, is_guest: true }, { onConflict: "id" });
  if (upsertError) throw upsertError;

  return user.id;
}
