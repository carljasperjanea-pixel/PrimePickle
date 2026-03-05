-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles Table
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  password_hash text not null,
  full_name text,
  display_name text,
  role text default 'player',
  avatar_url text,
  address text,
  phone text,
  mmr integer default 1000,
  games_played integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Lobbies Table
create table if not exists lobbies (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references profiles(id),
  qr_payload text unique not null,
  status text default 'open', -- open, full, in_progress, completed
  started_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Lobby Players Table
create table if not exists lobby_players (
  id uuid primary key default uuid_generate_v4(),
  lobby_id uuid references lobbies(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  team text, -- 'A' or 'B'
  is_ready boolean default false,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(lobby_id, profile_id)
);

-- Matches Table
create table if not exists matches (
  id uuid primary key default uuid_generate_v4(),
  lobby_id uuid references lobbies(id),
  winner_team text, -- 'A' or 'B'
  score text,
  mmr_delta integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Optional but recommended)
alter table profiles enable row level security;
alter table lobbies enable row level security;
alter table lobby_players enable row level security;
alter table matches enable row level security;

-- Allow public read access to profiles (for leaderboards etc)
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

-- Allow users to update their own profile
create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Allow service role full access (implicit, but good to note)
-- Note: Service Role bypasses RLS automatically.

-- Allow authenticated users to view lobbies
create policy "Lobbies are viewable by authenticated users"
  on lobbies for select
  to authenticated
  using ( true );

-- Allow authenticated users to insert lobbies (admin only logic handled in app)
create policy "Authenticated users can create lobbies"
  on lobbies for insert
  to authenticated
  with check ( true );

-- Allow authenticated users to update lobbies
create policy "Authenticated users can update lobbies"
  on lobbies for update
  to authenticated
  using ( true );

-- Allow authenticated users to view lobby players
create policy "Lobby players are viewable by authenticated users"
  on lobby_players for select
  to authenticated
  using ( true );

-- Allow authenticated users to join lobbies
create policy "Authenticated users can join lobbies"
  on lobby_players for insert
  to authenticated
  with check ( true );

-- Allow authenticated users to update their own lobby status (ready, team)
create policy "Users can update their own lobby status"
  on lobby_players for update
  to authenticated
  using ( auth.uid() = profile_id );

-- Allow authenticated users to leave lobbies
create policy "Users can leave lobbies"
  on lobby_players for delete
  to authenticated
  using ( auth.uid() = profile_id );
