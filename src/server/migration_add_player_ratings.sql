-- Create player_ratings table
CREATE TABLE IF NOT EXISTS player_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) NOT NULL,
  rater_id UUID REFERENCES profiles(id) NOT NULL,
  rated_id UUID REFERENCES profiles(id) NOT NULL,
  sportsmanship INT CHECK (sportsmanship BETWEEN 1 AND 5),
  communication INT CHECK (communication BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(match_id, rater_id, rated_id)
);

-- Add behavior_score to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'behavior_score') THEN
        ALTER TABLE profiles ADD COLUMN behavior_score INT DEFAULT 100;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Ratings are viewable by everyone" ON player_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert their own ratings" ON player_ratings FOR INSERT WITH CHECK (auth.uid() = rater_id);
