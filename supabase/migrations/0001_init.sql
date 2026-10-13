-- ─────────────────────────────────────────────────────────────────────────────
-- Lattice — Supabase / PostgreSQL schema (free tier compatible)
--
-- Apply with:  supabase db push   (or paste into the SQL editor)
--
-- Design notes:
--   * auth.users is owned by Supabase Auth; `profiles` mirrors the subset of
--     account data Lattice needs.
--   * Row Level Security is enabled everywhere so a user can only ever reach
--     their own rows, even if a client key leaks.
--   * ON DELETE CASCADE ensures account deletion removes all derived data.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid unique references auth.users (id) on delete cascade,
  email             text unique not null,
  plan              text not null default 'free',
  status            text not null default 'active',
  consent_status    text not null default 'pending',
  marketing_opt_in  boolean not null default false,
  terms_version     text not null default '1.0',
  privacy_version   text not null default '1.0',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ── saved items ──────────────────────────────────────────────────────────────
create table if not exists public.saved_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  ref_id      text not null,
  title       text not null,
  url         text,
  payload     jsonb,
  created_at  timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

create index if not exists saved_items_user_idx on public.saved_items (user_id, created_at desc);

-- ── explorations ─────────────────────────────────────────────────────────────
create table if not exists public.explorations (
  id          text primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  label       text not null,
  kind        text not null,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists explorations_user_idx on public.explorations (user_id, created_at desc);

-- ── documents (uploaded material) ────────────────────────────────────────────
-- Only metadata and derived analysis are stored here by default. The raw file
-- lives in private storage with a non-guessable path; it is never public.
create table if not exists public.documents (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  filename          text not null,
  mime_type         text,
  byte_size         bigint,
  document_type     text,
  content_hash      text,
  storage_path      text,          -- private bucket path, never a public URL
  analysis          jsonb,         -- DocumentAnalysis output
  created_at        timestamptz not null default now()
);

create index if not exists documents_user_idx on public.documents (user_id, created_at desc);
create index if not exists documents_hash_idx on public.documents (content_hash);

-- ── usage logs ───────────────────────────────────────────────────────────────
create table if not exists public.usage_logs (
  id                  bigserial primary key,
  user_id             uuid references public.profiles (id) on delete cascade,
  feature             text not null,
  ai_calls            integer not null default 0,
  search_calls        integer not null default 0,
  embedding_calls     integer not null default 0,
  input_tokens        integer not null default 0,
  output_tokens       integer not null default 0,
  estimated_cost      numeric(12, 6) not null default 0,
  processing_time_ms  integer not null default 0,
  cache_hit           boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists usage_logs_user_idx on public.usage_logs (user_id, created_at desc);

-- ── privacy requests ─────────────────────────────────────────────────────────
create table if not exists public.privacy_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  email       text not null,
  type        text not null,
  message     text,
  status      text not null default 'REQUESTED',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists privacy_requests_status_idx on public.privacy_requests (status, created_at desc);

-- ── consent records ──────────────────────────────────────────────────────────
create table if not exists public.consent_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  terms_version   text not null,
  privacy_version text not null,
  marketing_opt_in boolean not null default false,
  accepted_at     timestamptz not null default now()
);

-- ── audit log (admin actions) ────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id          bigserial primary key,
  actor_email text not null,
  action      text not null,
  target      text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.saved_items       enable row level security;
alter table public.explorations      enable row level security;
alter table public.documents         enable row level security;
alter table public.usage_logs        enable row level security;
alter table public.privacy_requests  enable row level security;
alter table public.consent_records   enable row level security;
alter table public.audit_logs        enable row level security;

-- A helper that maps the current auth user to their profile id.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

-- profiles: read and update your own row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth_user_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth_user_id = auth.uid());

-- saved items: full control of your own rows.
drop policy if exists saved_items_own on public.saved_items;
create policy saved_items_own on public.saved_items
  for all using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

-- explorations
drop policy if exists explorations_own on public.explorations;
create policy explorations_own on public.explorations
  for all using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

-- documents: strictly owner-only. No public read path exists.
drop policy if exists documents_own on public.documents;
create policy documents_own on public.documents
  for all using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

-- usage logs: read your own; inserts come from the server (service role).
drop policy if exists usage_logs_select_own on public.usage_logs;
create policy usage_logs_select_own on public.usage_logs
  for select using (user_id = public.current_profile_id());

-- privacy requests: you may create and read your own.
drop policy if exists privacy_requests_own on public.privacy_requests;
create policy privacy_requests_own on public.privacy_requests
  for select using (user_id = public.current_profile_id());

drop policy if exists privacy_requests_insert on public.privacy_requests;
create policy privacy_requests_insert on public.privacy_requests
  for insert with check (true);

-- consent records
drop policy if exists consent_records_own on public.consent_records;
create policy consent_records_own on public.consent_records
  for all using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

-- audit logs: admin-only via service role; no user policies on purpose.

-- ─────────────────────────────────────────────────────────────────────────────
-- Private storage bucket for uploaded documents
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_storage_own on storage.objects;
create policy documents_storage_own on storage.objects
  for all
  using (
    bucket_id = 'documents'
    and owner = auth.uid()
  )
  with check (
    bucket_id = 'documents'
    and owner = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Optional: full-text search index for the internal library, should you move
-- it into the database. Safe to leave unused while the library is seed data.
-- ─────────────────────────────────────────────────────────────────────────────
-- create extension if not exists pg_trgm;
