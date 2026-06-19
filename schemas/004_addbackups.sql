create table backups (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  created_at timestamptz default now()
);
alter table backups enable row level security;
create policy "Authenticated access only" on backups for all using (auth.uid() is not null);