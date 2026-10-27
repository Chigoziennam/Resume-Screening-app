-- Run this in your Supabase SQL Editor to create the screening_results table

create table if not exists screening_results (
  id uuid default gen_random_uuid() primary key,
  candidate_name text not null,
  email text,
  phone text,
  job_category text,
  skills jsonb default '{}'::jsonb,
  recommendations jsonb default '[]'::jsonb,
  strengths jsonb default '[]'::jsonb,
  improvements jsonb default '[]'::jsonb,
  full_result jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table screening_results enable row level security;

-- Allow anonymous inserts and reads
create policy "Allow anonymous insert" on screening_results for insert with check (true);
create policy "Allow anonymous select" on screening_results for select using (true);
