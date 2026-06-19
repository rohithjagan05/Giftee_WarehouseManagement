create table projects (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  name text,
  location text,
  remarks text,
  created_at timestamptz default now()
);

create table lpos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  number text not null,
  supplier text,
  address text,
  created_at timestamptz default now()
);

create table grns (
  id uuid primary key default gen_random_uuid(),
  lpo_id uuid references lpos(id),
  number text not null,
  date date,
  remarks text,
  deleted_at timestamptz default null,
  created_at timestamptz default now()
);

create table grn_items (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid references grns(id),
  product_code text,
  oem_code text,
  description text,
  unit text,
  qty numeric,
  unit_price numeric,
  total_price numeric
);

create table gdns (
  id uuid primary key default gen_random_uuid(),
  lpo_id uuid references lpos(id),
  number text not null,
  date date,
  consignee_name text,
  consignee_address text,
  deleted_at timestamptz default null,
  created_at timestamptz default now()
);

create table gdn_items (
  id uuid primary key default gen_random_uuid(),
  gdn_id uuid references gdns(id),
  product_code text,
  oem_code text,
  description text,
  unit text,
  qty_delivered numeric
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text,
  record_id text,
  action text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

create table counters (
  name text primary key,
  value integer default 0
);

insert into counters values ('grn', 0), ('gdn', 0);