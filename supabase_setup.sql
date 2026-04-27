-- Supabase setup for sales tracker (phone/email auth compatible)
-- Run this whole file once in Supabase SQL Editor.

-- 1) Main table: one row per sale record
create table if not exists public.sales_records (
  record_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sales_records_updated_at on public.sales_records;
create trigger trg_sales_records_updated_at
before update on public.sales_records
for each row
execute function public.set_updated_at();

-- 2) Enable Row Level Security
alter table public.sales_records enable row level security;

-- 3) Clean previous policies (safe re-run)
drop policy if exists "sales_records_select_own" on public.sales_records;
drop policy if exists "sales_records_insert_own" on public.sales_records;
drop policy if exists "sales_records_update_own" on public.sales_records;
drop policy if exists "sales_records_delete_own" on public.sales_records;

-- 4) Per-user policies
create policy "sales_records_select_own"
on public.sales_records
for select
using (auth.uid() is not null and owner_id = auth.uid());

create policy "sales_records_insert_own"
on public.sales_records
for insert
with check (auth.uid() is not null and owner_id = auth.uid());

create policy "sales_records_update_own"
on public.sales_records
for update
using (auth.uid() is not null and owner_id = auth.uid())
with check (auth.uid() is not null and owner_id = auth.uid());

create policy "sales_records_delete_own"
on public.sales_records
for delete
using (auth.uid() is not null and owner_id = auth.uid());

-- 5) Helpful index
create index if not exists idx_sales_records_owner_created
on public.sales_records (owner_id, created_at desc);

-- 6) Optional quick check (run after login from app)
-- select * from public.sales_records order by created_at desc;
-- 7) DANGER ZONE: reset ALL users and data (run only when needed)
-- This removes every app account and every related sales record.
-- Execute manually in Supabase SQL Editor.
--
-- delete from public.sales_records;
-- delete from auth.identities;
-- delete from auth.users; 