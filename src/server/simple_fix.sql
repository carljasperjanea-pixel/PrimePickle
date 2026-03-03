-- Run this script in the Supabase SQL Editor.
-- It adds the missing columns required for the game to start.
-- It uses "IF NOT EXISTS" so it is safe to run even if some columns are already there.

ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS is_ready boolean default false;
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS team text;
