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
