-- Create club_announcements table
CREATE TABLE IF NOT EXISTS public.club_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create club_announcement_reactions table
CREATE TABLE IF NOT EXISTS public.club_announcement_reactions (
  announcement_id UUID REFERENCES public.club_announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

-- RLS Policies
ALTER TABLE public.club_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_announcement_reactions ENABLE ROW LEVEL SECURITY;

-- Announcements Policies
CREATE POLICY "Members can view announcements" ON public.club_announcements FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = club_id AND cm.user_id = auth.uid() AND cm.role != 'invited')
);
CREATE POLICY "Owners can create announcements" ON public.club_announcements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = club_id AND cm.user_id = auth.uid() AND cm.role = 'owner')
);
CREATE POLICY "Owners can delete announcements" ON public.club_announcements FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = club_id AND cm.user_id = auth.uid() AND cm.role = 'owner')
);

-- Reactions Policies
CREATE POLICY "Members can view reactions" ON public.club_announcement_reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.club_announcements ca
    JOIN public.club_members cm ON cm.club_id = ca.club_id
    WHERE ca.id = announcement_id AND cm.user_id = auth.uid() AND cm.role != 'invited'
  )
);
CREATE POLICY "Members can add/update reactions" ON public.club_announcement_reactions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_announcements ca
    JOIN public.club_members cm ON cm.club_id = ca.club_id
    WHERE ca.id = announcement_id AND cm.user_id = auth.uid() AND cm.role != 'invited'
  )
);
CREATE POLICY "Members can update their own reactions" ON public.club_announcement_reactions FOR UPDATE USING (
  user_id = auth.uid()
);
CREATE POLICY "Members can delete their own reactions" ON public.club_announcement_reactions FOR DELETE USING (
  user_id = auth.uid()
);
