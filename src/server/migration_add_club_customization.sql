-- Create club_achievements table
CREATE TABLE IF NOT EXISTS public.club_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create club_photos table
CREATE TABLE IF NOT EXISTS public.club_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.club_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_photos ENABLE ROW LEVEL SECURITY;

-- Achievements Policies
CREATE POLICY "Anyone can view club achievements" ON public.club_achievements FOR SELECT USING (true);

-- Photos Policies
CREATE POLICY "Anyone can view club photos" ON public.club_photos FOR SELECT USING (true);
