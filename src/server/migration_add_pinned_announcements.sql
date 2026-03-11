-- Add is_pinned column to club_announcements
ALTER TABLE public.club_announcements ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Update RLS policy to allow owners to update announcements (for pinning)
CREATE POLICY "Owners can update announcements" ON public.club_announcements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = club_id AND cm.user_id = auth.uid() AND cm.role = 'owner')
);
