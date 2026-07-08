// Supabase helper (ES module)
// Replace the URL and ANON KEY with your project's values in README instructions.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://mcwvflsdbdrnsyktxfrv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jd3ZmbHNkYmRybnN5a3R4ZnJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDM0NTQsImV4cCI6MjA5OTA3OTQ1NH0.etiLtWFrxqWYoqY5IUudXyKaprwrpnORL73Fyh92I9k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);



// Insert a submission row. Payload should match the `submissions` table schema.
export async function insertSubmission(payload) {
  // Use a direct fetch to the REST endpoint with the anon key to avoid
  // the client-side 401/RLS mismatch observed in some environments.
  // NOTE: We use 'return=minimal' because the anon role has no SELECT
  // policy, so 'return=representation' (which uses RETURNING *) would
  // fail the RLS SELECT check and reject the entire insert.
  const url = `${SUPABASE_URL}/rest/v1/submissions`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (res.status >= 200 && res.status < 300) {
      return { data: { success: true }, error: null };
    }

    // Non-2xx: try to parse error JSON
    const err = await res.json().catch(() => ({ message: res.statusText, status: res.status }));
    return { data: null, error: err };
  } catch (err) {
    return { data: null, error: err };
  }
}

// Fetch submissions (owner view). Returns rows ordered by created_at desc by default.
export async function fetchSubmissions() {
  return supabase.from('submissions').select('*').order('created_at', { ascending: false });
}

// Delete a submission by id
export async function deleteSubmission(id) {
  return supabase.from('submissions').delete().eq('id', id);
}

// Auth helpers (used on results page)
export async function signInWithEmail(email) {
  return supabase.auth.signInWithOtp({ email });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export default supabase;
