-- Create clubs table
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create club_members table
CREATE TABLE IF NOT EXISTS public.club_members (
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'invited'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

-- RLS Policies
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- Clubs Policies
CREATE POLICY "Anyone can view clubs" ON public.clubs FOR SELECT USING (true);
CREATE POLICY "Users can create clubs" ON public.clubs FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update clubs" ON public.clubs FOR UPDATE USING (auth.uid() = owner_id);

-- Club Members Policies
CREATE POLICY "Anyone can view club members" ON public.club_members FOR SELECT USING (true);
CREATE POLICY "Owners/Admins can invite" ON public.club_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_members cm 
    WHERE cm.club_id = club_id AND cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin')
  ) OR auth.uid() IN (SELECT owner_id FROM public.clubs WHERE id = club_id)
);
CREATE POLICY "Users can accept/reject invites" ON public.club_members FOR UPDATE USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = club_id AND cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin'))
);
CREATE POLICY "Users can leave or be kicked" ON public.club_members FOR DELETE USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = club_id AND cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin'))
);
