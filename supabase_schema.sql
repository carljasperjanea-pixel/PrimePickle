-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  password_hash text not null,
  display_name text,
  role text default 'player',
  avatar_url text,
  phone text,
  address text,
  mmr int default 1000,
  games_played int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create lobbies table
create table if not exists lobbies (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references profiles(id) not null,
  qr_payload text unique not null,
  status text default 'open', -- open, full, completed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create lobby_players table (junction table)
create table if not exists lobby_players (
  lobby_id uuid references lobbies(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (lobby_id, profile_id)
);

-- Create matches table
create table if not exists matches (
  id uuid primary key default uuid_generate_v4(),
  lobby_id uuid references lobbies(id) not null,
  winner_team text, -- 'A' or 'B'
  score text,
  mmr_delta int,
  played_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
-- Note: Since we are using the Service Role Key on the server, these policies 
-- mainly affect client-side access (if you were using the anon key there).
-- For this app, we are doing everything server-side, but it's good practice to enable RLS.

alter table profiles enable row level security;
alter table lobbies enable row level security;
alter table lobby_players enable row level security;
alter table matches enable row level security;

-- Policies (Permissive for now, assuming server-side handling)
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

create policy "Lobbies are viewable by everyone" on lobbies for select using (true);
create policy "Lobby players are viewable by everyone" on lobby_players for select using (true);
