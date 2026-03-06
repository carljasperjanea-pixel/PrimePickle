-- Add behavior_score column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS behavior_score INTEGER DEFAULT 100;

-- Update existing rows to have default behavior_score if they are null
UPDATE profiles 
SET behavior_score = 100 
WHERE behavior_score IS NULL;
