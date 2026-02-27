-- Run this script in your Supabase SQL Editor to fix the missing relationships

-- 1. Fix relationship between lobby_players and profiles
ALTER TABLE lobby_players
DROP CONSTRAINT IF EXISTS lobby_players_profile_id_fkey;

ALTER TABLE lobby_players
ADD CONSTRAINT lobby_players_profile_id_fkey
FOREIGN KEY (profile_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

-- 2. Fix relationship between lobby_players and lobbies
ALTER TABLE lobby_players
DROP CONSTRAINT IF EXISTS lobby_players_lobby_id_fkey;

ALTER TABLE lobby_players
ADD CONSTRAINT lobby_players_lobby_id_fkey
FOREIGN KEY (lobby_id)
REFERENCES lobbies(id)
ON DELETE CASCADE;

-- 3. Fix relationship between lobbies and profiles (admin)
ALTER TABLE lobbies
DROP CONSTRAINT IF EXISTS lobbies_admin_id_fkey;

ALTER TABLE lobbies
ADD CONSTRAINT lobbies_admin_id_fkey
FOREIGN KEY (admin_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

-- 4. Force schema cache reload
NOTIFY pgrst, 'reload config';
