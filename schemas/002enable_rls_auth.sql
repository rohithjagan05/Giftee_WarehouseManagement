alter table projects enable row level security;
alter table lpos enable row level security;
alter table grns enable row level security;
alter table grn_items enable row level security;
alter table gdns enable row level security;
alter table gdn_items enable row level security;
alter table audit_log enable row level security;
alter table counters enable row level security;

create policy "Authenticated access only" on projects for all using (auth.uid() is not null);
create policy "Authenticated access only" on lpos for all using (auth.uid() is not null);
create policy "Authenticated access only" on grns for all using (auth.uid() is not null);
create policy "Authenticated access only" on grn_items for all using (auth.uid() is not null);
create policy "Authenticated access only" on gdns for all using (auth.uid() is not null);
create policy "Authenticated access only" on gdn_items for all using (auth.uid() is not null);
create policy "Authenticated access only" on audit_log for all using (auth.uid() is not null);
create policy "Authenticated access only" on counters for all using (auth.uid() is not null);