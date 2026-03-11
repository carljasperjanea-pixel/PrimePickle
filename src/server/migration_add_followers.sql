CREATE TABLE IF NOT EXISTS followers (
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (follower_id, following_id)
);

-- RLS
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all followers"
    ON followers FOR SELECT
    USING (true);

CREATE POLICY "Users can follow others"
    ON followers FOR INSERT
    WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others"
    ON followers FOR DELETE
    USING (auth.uid() = follower_id);
