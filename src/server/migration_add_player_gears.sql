
-- Create player_gears table
CREATE TABLE IF NOT EXISTS player_gears (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Paddle', 'Shoes', 'Apparel', etc.
  image_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE player_gears ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own gears"
  ON player_gears FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Users can insert their own gears"
  ON player_gears FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their own gears"
  ON player_gears FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Users can delete their own gears"
  ON player_gears FOR DELETE
  USING (auth.uid() = player_id);

-- Public access for showcasing (optional, if other players can see it)
CREATE POLICY "Public can view gears"
  ON player_gears FOR SELECT
  USING (true);
