-- Supabase SQL: create submissions table and example RLS policies

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- Table: submissions
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  program text,
  program_key text,
  semester text,
  student_name text,
  roll_number text,
  semester_gpa_including_failed numeric,
  semester_gpa_excluding_failed numeric,
  final_cgpa numeric,
  total_credits integer,
  subjects jsonb
);

-- Enable Row Level Security
alter table public.submissions enable row level security;

-- Policy: allow anonymous inserts (so the public website can submit)
-- Adjust this according to your security posture.
create policy allow_anon_insert on public.submissions
  for insert
  using (auth.role() = 'anon');

-- Policy: allow authenticated users to select and delete
create policy allow_authenticated_select on public.submissions
  for select
  using (auth.role() = 'authenticated');

create policy allow_authenticated_delete on public.submissions
  for delete
  using (auth.role() = 'authenticated');

-- If you want to allow public (anon) reads (not recommended), add:
-- create policy allow_anon_select on public.submissions for select using (true);

-- Index to speed queries by creation time
create index if not exists idx_submissions_created_at on public.submissions(created_at desc);
