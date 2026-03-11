-- Add photo_url and achievements to clubs table
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS achievements JSONB DEFAULT '[]'::jsonb;
