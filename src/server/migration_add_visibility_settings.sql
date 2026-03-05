
alter table profiles 
add column if not exists visibility_settings jsonb default '{"email": false, "phone": false, "address": false}';
