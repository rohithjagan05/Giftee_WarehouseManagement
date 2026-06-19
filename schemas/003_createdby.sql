alter table grns add column created_by uuid references auth.users(id);
alter table gdns add column created_by uuid references auth.users(id);
alter table projects add column created_by uuid references auth.users(id);
alter table lpos add column created_by uuid references auth.users(id);