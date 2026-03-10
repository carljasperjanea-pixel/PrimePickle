
-- Ensure profiles table has necessary columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS mmr INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'player',
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;

-- Enable RLS on tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Ensure lobbies table has necessary columns
ALTER TABLE lobbies 
ADD COLUMN IF NOT EXISTS match_goal INTEGER DEFAULT 11,
ADD COLUMN IF NOT EXISTS team_a_captain_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS team_b_captain_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open',
ADD COLUMN IF NOT EXISTS qr_payload TEXT,
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES profiles(id);

-- Ensure lobby_players table has necessary columns
ALTER TABLE lobby_players 
ADD COLUMN IF NOT EXISTS is_ready BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS team TEXT;

-- PROFILES
-- Allow public read access (needed for login/signup checks)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);

-- Allow public update access (needed for MMR updates if server uses anon key)
DROP POLICY IF EXISTS "Public profiles are updatable" ON profiles;
CREATE POLICY "Public profiles are updatable" ON profiles FOR UPDATE USING (true);

-- Allow public insert access (needed for signup if server uses anon key)
DROP POLICY IF EXISTS "Public profiles are insertable" ON profiles;
CREATE POLICY "Public profiles are insertable" ON profiles FOR INSERT WITH CHECK (true);


-- LOBBIES
-- Allow full access to lobbies for everyone (needed for create/join/leave/start if server uses anon key)
DROP POLICY IF EXISTS "Enable all access for lobbies" ON lobbies;
CREATE POLICY "Enable all access for lobbies" ON lobbies FOR ALL USING (true) WITH CHECK (true);


-- LOBBY PLAYERS
-- Allow full access to lobby_players for everyone
DROP POLICY IF EXISTS "Enable all access for lobby_players" ON lobby_players;
CREATE POLICY "Enable all access for lobby_players" ON lobby_players FOR ALL USING (true) WITH CHECK (true);


-- MATCHES
-- Allow full access to matches for everyone
DROP POLICY IF EXISTS "Enable all access for matches" ON matches;
CREATE POLICY "Enable all access for matches" ON matches FOR ALL USING (true) WITH CHECK (true);


-- Force schema cache reload
NOTIFY pgrst, 'reload config';
