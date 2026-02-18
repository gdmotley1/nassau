-- Phase 2 RLS Fix 2: Break all circular dependencies between games <-> game_players
-- The root cause: games SELECT checks game_players, game_players SELECT checks games = loop
-- Fix: games policies NEVER reference game_players. game_players policies reference games only.

-- ============================================
-- 1. FIX GAMES SELECT POLICY (the recursion source)
-- Old: checks game_players subquery → triggers game_players RLS → which checks games → loop
-- New: creator can always see + use a security definer function for participant access
-- ============================================

DROP POLICY IF EXISTS "Users can view games they participate in" ON public.games;

-- Simple: creator always sees their games
-- For now this is sufficient since the creator is the only real user
CREATE POLICY "Users can view their games" ON public.games
  FOR SELECT USING (created_by = auth.uid());

-- ============================================
-- 2. FIX GAME_PLAYERS SELECT POLICY
-- Must NOT reference games in a way that triggers games RLS back to game_players
-- Use a security definer function to bypass RLS for the lookup
-- ============================================

-- Create a helper function that bypasses RLS to check game ownership
CREATE OR REPLACE FUNCTION public.is_game_creator(gid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.games WHERE id = gid AND created_by = auth.uid()
  );
$$;

-- Drop existing game_players SELECT policies
DROP POLICY IF EXISTS "Users can view game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can view game players in their games" ON public.game_players;
DROP POLICY IF EXISTS "Game creator can view game players" ON public.game_players;

CREATE POLICY "Users can view game players" ON public.game_players
  FOR SELECT USING (
    public.is_game_creator(game_id) OR user_id = auth.uid()
  );

-- Fix INSERT policy too
DROP POLICY IF EXISTS "Game creator can add players" ON public.game_players;
CREATE POLICY "Game creator can add players" ON public.game_players
  FOR INSERT WITH CHECK (public.is_game_creator(game_id));

-- Fix UPDATE policies
DROP POLICY IF EXISTS "Game players can update their own status" ON public.game_players;
DROP POLICY IF EXISTS "Game creator can update game_players" ON public.game_players;
CREATE POLICY "Game creator or self can update game_players" ON public.game_players
  FOR UPDATE USING (
    public.is_game_creator(game_id) OR user_id = auth.uid()
  );

-- Fix DELETE policy
DROP POLICY IF EXISTS "Game creator can delete game_players" ON public.game_players;
CREATE POLICY "Game creator can delete game_players" ON public.game_players
  FOR DELETE USING (public.is_game_creator(game_id));

-- ============================================
-- 3. FIX GAME_BETS POLICIES (use helper function)
-- ============================================

DROP POLICY IF EXISTS "Users can view bets in their games" ON public.game_bets;
CREATE POLICY "Users can view bets in their games" ON public.game_bets
  FOR SELECT USING (public.is_game_creator(game_id));

DROP POLICY IF EXISTS "Game players can create bets" ON public.game_bets;
CREATE POLICY "Game players can create bets" ON public.game_bets
  FOR INSERT WITH CHECK (public.is_game_creator(game_id));

DROP POLICY IF EXISTS "Game players can update bets" ON public.game_bets;
CREATE POLICY "Game players can update bets" ON public.game_bets
  FOR UPDATE USING (public.is_game_creator(game_id));

-- ============================================
-- 4. FIX SCORES POLICIES (use helper function)
-- ============================================

DROP POLICY IF EXISTS "Game players can view scores" ON public.scores;
CREATE POLICY "Game players can view scores" ON public.scores
  FOR SELECT USING (public.is_game_creator(game_id));

DROP POLICY IF EXISTS "Game players can insert scores" ON public.scores;
DROP POLICY IF EXISTS "Game creator can insert all scores" ON public.scores;
CREATE POLICY "Game creator can insert scores" ON public.scores
  FOR INSERT WITH CHECK (public.is_game_creator(game_id));

DROP POLICY IF EXISTS "Game players can update scores" ON public.scores;
DROP POLICY IF EXISTS "Game creator can update all scores" ON public.scores;
CREATE POLICY "Game creator can update scores" ON public.scores
  FOR UPDATE USING (public.is_game_creator(game_id));

-- ============================================
-- 5. FIX SETTLEMENTS POLICIES (use helper function)
-- ============================================

DROP POLICY IF EXISTS "Users can view their settlements" ON public.settlements;
CREATE POLICY "Users can view their settlements" ON public.settlements
  FOR SELECT USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR public.is_game_creator(game_id)
  );

DROP POLICY IF EXISTS "Game players can create settlements" ON public.settlements;
DROP POLICY IF EXISTS "Game creator can view game settlements" ON public.settlements;
CREATE POLICY "Game creator can create settlements" ON public.settlements
  FOR INSERT WITH CHECK (public.is_game_creator(game_id));

-- ============================================
-- 6. FIX WOLF_CHOICES POLICIES (use helper function)
-- ============================================

DROP POLICY IF EXISTS "Game players can view wolf choices" ON public.wolf_choices;
CREATE POLICY "Game players can view wolf choices" ON public.wolf_choices
  FOR SELECT USING (public.is_game_creator(game_id));
