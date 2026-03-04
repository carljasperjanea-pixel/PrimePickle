-- Add columns for match setup
ALTER TABLE lobbies 
ADD COLUMN IF NOT EXISTS match_goal INTEGER DEFAULT 11,
ADD COLUMN IF NOT EXISTS team_a_captain_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS team_b_captain_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE lobby_players 
ADD COLUMN IF NOT EXISTS is_ready BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS team TEXT;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
