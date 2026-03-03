-- 1. Fix Permissions (Idempotent)
-- Drop existing policies to avoid conflicts
drop policy if exists "Enable access to profiles for all" on profiles;
drop policy if exists "Enable access to lobbies for all" on lobbies;
drop policy if exists "Enable access to lobby_players for all" on lobby_players;
drop policy if exists "Enable access to matches for all" on matches;

-- Re-create policies
create policy "Enable access to profiles for all" on profiles for all using (true) with check (true);
create policy "Enable access to lobbies for all" on lobbies for all using (true) with check (true);
create policy "Enable access to lobby_players for all" on lobby_players for all using (true) with check (true);
create policy "Enable access to matches for all" on matches for all using (true) with check (true);


-- 2. Fix Schema Columns (Idempotent)
-- Add started_at to lobbies if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'started_at') THEN
        ALTER TABLE lobbies ADD COLUMN started_at timestamp with time zone;
    END IF;
END $$;

-- Add is_ready to lobby_players if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobby_players' AND column_name = 'is_ready') THEN
        ALTER TABLE lobby_players ADD COLUMN is_ready boolean default false;
    END IF;
END $$;

-- Add team to lobby_players if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobby_players' AND column_name = 'team') THEN
        ALTER TABLE lobby_players ADD COLUMN team text;
    END IF;
END $$;
