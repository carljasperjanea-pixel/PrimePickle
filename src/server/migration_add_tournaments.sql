-- Create tournaments table
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    format TEXT NOT NULL, -- 'single_elimination', 'double_elimination', 'round_robin'
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'in_progress', 'completed'
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create tournament_participants table
CREATE TABLE IF NOT EXISTS public.tournament_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(tournament_id, profile_id)
);

-- Create tournament_matches table
CREATE TABLE IF NOT EXISTS public.tournament_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    round_name TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    match_order INTEGER NOT NULL,
    player1_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    player2_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    score TEXT,
    next_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
    next_match_player_slot INTEGER,
    loser_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
    loser_match_slot INTEGER,
    is_bye BOOLEAN DEFAULT false
);

-- Add RLS policies
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- Admins can do everything, everyone can read
CREATE POLICY "Tournaments are viewable by everyone" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admins can insert tournaments" ON public.tournaments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins can update tournaments" ON public.tournaments FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins can delete tournaments" ON public.tournaments FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Participants are viewable by everyone" ON public.tournament_participants FOR SELECT USING (true);
CREATE POLICY "Admins can insert participants" ON public.tournament_participants FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins can delete participants" ON public.tournament_participants FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Matches are viewable by everyone" ON public.tournament_matches FOR SELECT USING (true);
CREATE POLICY "Admins can insert matches" ON public.tournament_matches FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins can update matches" ON public.tournament_matches FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins can delete matches" ON public.tournament_matches FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
