-- This script ONLY adds the missing columns. It does NOT touch permissions.
-- Run this in Supabase SQL Editor to fix the "Failed to start game" error.

-- 1. Add started_at to lobbies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'started_at') THEN
        ALTER TABLE lobbies ADD COLUMN started_at timestamp with time zone;
    END IF;
END $$;

-- 2. Add is_ready to lobby_players
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobby_players' AND column_name = 'is_ready') THEN
        ALTER TABLE lobby_players ADD COLUMN is_ready boolean default false;
    END IF;
END $$;

-- 3. Add team to lobby_players
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobby_players' AND column_name = 'team') THEN
        ALTER TABLE lobby_players ADD COLUMN team text;
    END IF;
END $$;
