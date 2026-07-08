// Supabase helper (ES module)
// Replace the URL and ANON KEY with your project's values in README instructions.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'REPLACE_WITH_YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'REPLACE_WITH_YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Insert a submission row. Payload should match the `submissions` table schema.
export async function insertSubmission(payload) {
  // Insert the payload directly; ensure the table columns match the keys in payload.
  return supabase.from('submissions').insert([payload]).select();
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
