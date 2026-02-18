-- Phase 2 RLS Fix: Eliminate infinite recursion in game_players policies
-- Run this AFTER phase2_migration.sql

-- ============================================
-- 1. FIX GAME_PLAYERS SELECT POLICY
-- The original policy queries game_players FROM game_players → infinite recursion
-- Replace with: creator can see all, participants check via games table
-- ============================================

-- Drop the problematic self-referencing SELECT policy
DROP POLICY IF EXISTS "Users can view game players in their games" ON public.game_players;

-- Drop the Phase 2 duplicate we added (also references games, which is fine, but let's consolidate)
DROP POLICY IF EXISTS "Game creator can view game players" ON public.game_players;

-- New SELECT policy: check games table (no self-reference)
CREATE POLICY "Users can view game players" ON public.game_players
  FOR SELECT USING (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
    OR user_id = auth.uid()
  );

-- ============================================
-- 2. FIX GAME_BETS SELECT/INSERT/UPDATE POLICIES
-- These also query game_players internally → can trigger recursion
-- ============================================

DROP POLICY IF EXISTS "Users can view bets in their games" ON public.game_bets;
CREATE POLICY "Users can view bets in their games" ON public.game_bets
  FOR SELECT USING (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
    OR game_id IN (SELECT game_id FROM public.game_players WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Game players can create bets" ON public.game_bets;
CREATE POLICY "Game players can create bets" ON public.game_bets
  FOR INSERT WITH CHECK (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Game players can update bets" ON public.game_bets;
CREATE POLICY "Game players can update bets" ON public.game_bets
  FOR UPDATE USING (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
  );

-- ============================================
-- 3. FIX SCORES SELECT/INSERT/UPDATE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Game players can view scores" ON public.scores;
CREATE POLICY "Game players can view scores" ON public.scores
  FOR SELECT USING (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
    OR game_id IN (SELECT game_id FROM public.game_players WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Game players can insert scores" ON public.scores;
-- Keep the Phase 2 "Game creator can insert all scores" policy, drop the old one
-- The Phase 2 migration already added creator-based insert policy

DROP POLICY IF EXISTS "Game players can update scores" ON public.scores;
-- Keep the Phase 2 "Game creator can update all scores" policy, drop the old one

-- ============================================
-- 4. FIX SETTLEMENTS SELECT/INSERT POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view their settlements" ON public.settlements;
CREATE POLICY "Users can view their settlements" ON public.settlements
  FOR SELECT USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Game players can create settlements" ON public.settlements;
CREATE POLICY "Game players can create settlements" ON public.settlements
  FOR INSERT WITH CHECK (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
  );

-- Drop the Phase 2 duplicate viewer if it exists
DROP POLICY IF EXISTS "Game creator can view game settlements" ON public.settlements;

-- ============================================
-- 5. FIX WOLF_CHOICES SELECT POLICY
-- ============================================

DROP POLICY IF EXISTS "Game players can view wolf choices" ON public.wolf_choices;
CREATE POLICY "Game players can view wolf choices" ON public.wolf_choices
  FOR SELECT USING (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
    OR game_id IN (SELECT game_id FROM public.game_players WHERE user_id = auth.uid())
  );
