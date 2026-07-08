
check it out on https://musakhan123.github.io/BCS-GPA-CALCULATOR/


# GPA & CGPA Calculator — Supabase Submission Integration

This project is a static GPA & CGPA calculator that now supports submitting calculated results to a Supabase (Postgres) backend and a dedicated Results admin page to view, search, export, and manage submissions.

Overview:
- Students can calculate GPA/CGPA on the existing static site and click **Submit Result** to save a submission to Supabase.
- Admins can view submissions on `results.html`, search, sort, export (CSV/Excel/PDF), view details, and delete entries.

Important: The frontend uses only the Supabase **anon (public)** key. Never expose your Supabase **service_role** (secret) key in frontend code — it belongs on a secure server.

## Files added/modified
- Modified: `index.html`, `style.css`, `script.js`
- Added: `supabase.js`, `submit.js`, `results.html`, `results.js`, `results.css`, `supabase.sql`, `README.md`

## Supabase table schema
See `supabase.sql` for a ready-to-run SQL script. It creates a `submissions` table with the following columns:
- `id` (uuid)
- `created_at` (timestamp)
- `program`, `program_key`, `semester`
- `student_name`, `roll_number`
- `semester_gpa_including_failed`, `semester_gpa_excluding_failed`, `final_cgpa`
- `total_credits`
- `subjects` (JSONB array of subject objects with `name`, `credits`, `marks`, `gpa`, `status`)

It also adds example Row Level Security (RLS) policies. Review and adapt these policies to your security needs.

## Supabase setup (step-by-step)
1. Create a Supabase project at https://app.supabase.com.
2. Go to the SQL Editor and run the contents of `supabase.sql` to create the table and example policies.
3. In the Supabase project settings, on the "API" page, copy the **Project URL** and the **anon public** key.
4. Open `supabase.js` and replace the placeholders:

   SUPABASE_URL = 'https://your-project-ref.supabase.co'

   SUPABASE_ANON_KEY = 'your-anon-public-key'

5. Deploy the static site to GitHub Pages or GitHub static hosting.

## Row Level Security and best practices
- The example `supabase.sql` provides an RLS policy that allows anonymous inserts (so students can submit). It restricts selects and deletes to authenticated users.
- Recommended: keep `select` and `delete` restricted to authenticated admin accounts. Use Supabase Auth to sign in as admin on `results.html` (magic link flow is implemented) and view/manage submissions.
- Never put the **service_role** key in any client code. The service role key has full DB privileges and must be stored securely (server environment variables).

## How the frontend connects
- `supabase.js` is an ES module that creates a Supabase client using the public anon key and exports helper functions used by the app:
  - `insertSubmission(payload)` — insert a submission record
  - `fetchSubmissions()` — fetch all submissions
  - `deleteSubmission(id)` — delete a record by id
  - `signInWithEmail(email)` — send magic link to admin email

Replace the placeholders in `supabase.js` with your Project URL and Anon Key.

## Behavior and validation
- The `Submit Result` button validates that at least one subject has marks and that a semester GPA exists. If validation fails, it shows a friendly error.
- On submit the user is asked: "Are you sure you want to submit?"
- The button is disabled while uploading and a loading text is shown.
- After successful upload a notification is shown.

## Results page (`results.html`)
- Fetches submissions from Supabase and renders a responsive table.
- Search by student name and roll number.
- Sort by newest/oldest.
- View a row to open details with subject-level breakdown.
- Export to CSV, Excel (XLSX), or PDF.
- Delete a submission after confirmation. Deletion requires appropriate DB policy (authenticated user).

## Exports
- CSV: simple generation and download
- Excel: uses SheetJS (`xlsx`) from CDN (client-side)
- PDF: uses `jsPDF` from CDN

## Security notes
- Public website uses only the **anon** key — this is expected for static sites that accept public writes.
- Limit what anon can do via RLS. Common pattern:
  - Allow `INSERT` for anon (so students can submit)
  - Allow `SELECT` and `DELETE` only for authenticated admin users
- If you need server-side operations (e.g., exporting all data programmatically or backups), use the **service_role** key on a secure server.

## Troubleshooting
- If submissions fail: check browser console for Supabase errors. Common causes:
  - `supabase.js` still has placeholder values
  - RLS policies blocking anon inserts
- If `results.html` cannot fetch data: ensure RLS allows `SELECT` for your role (or sign in as admin).

## Next steps / improvements
- Add an admin-only login flow and a user management dashboard.
- Add export history and download links.
- Add CAPTCHA or rate-limiting for public submissions.

---
If you'd like, I can:
- Patch `supabase.js` with your real Project URL and Anon Key when you provide them, or
- Add an admin sign-in UI on `results.html` that enforces auth before showing data.
