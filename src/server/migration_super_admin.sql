-- Super Admin Schema Updates

-- Audit Logs Table
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references profiles(id),
  action_performed text not null,
  target_id uuid,
  ip_address text,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Feature Flags Table
create table if not exists feature_flags (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  is_enabled boolean default false,
  description text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Global Settings Table (for maintenance mode, etc)
create table if not exists global_settings (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert default feature flags
insert into feature_flags (key, is_enabled, description) values
  ('maintenance_mode', false, 'Global Kill-Switch for maintenance mode'),
  ('user_registration', true, 'Allow new users to register')
on conflict (key) do nothing;

-- RLS Policies
alter table audit_logs enable row level security;
alter table feature_flags enable row level security;
alter table global_settings enable row level security;

-- Only super_admins can view/insert audit logs
create policy "Super admins can view audit logs"
  on audit_logs for select
  to authenticated
  using ( exists (select 1 from profiles where id = auth.uid() and role = 'super_admin') );

create policy "Super admins can insert audit logs"
  on audit_logs for insert
  to authenticated
  with check ( exists (select 1 from profiles where id = auth.uid() and role = 'super_admin') );

-- Feature flags are viewable by everyone (to check maintenance mode)
create policy "Feature flags are viewable by everyone"
  on feature_flags for select
  using ( true );

create policy "Super admins can update feature flags"
  on feature_flags for update
  to authenticated
  using ( exists (select 1 from profiles where id = auth.uid() and role = 'super_admin') );

-- Global settings are viewable by everyone
create policy "Global settings are viewable by everyone"
  on global_settings for select
  using ( true );

create policy "Super admins can update global settings"
  on global_settings for update
  to authenticated
  using ( exists (select 1 from profiles where id = auth.uid() and role = 'super_admin') );
