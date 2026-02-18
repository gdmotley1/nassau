-- Phase 2 Migration: Guest Players + Nassau Game Support
-- Run this in your Supabase SQL editor AFTER the initial migration.sql

-- ============================================
-- 1. GUEST PLAYER SUPPORT
-- ============================================

-- Allow guest players (user_id nullable)
ALTER TABLE public.game_players ALTER COLUMN user_id DROP NOT NULL;

-- Drop the unique constraint that requires user_id
ALTER TABLE public.game_players DROP CONSTRAINT game_players_game_id_user_id_key;

-- Add guest player fields
ALTER TABLE public.game_players ADD COLUMN guest_name TEXT;
ALTER TABLE public.game_players ADD COLUMN guest_handicap NUMERIC(4,1);

-- ============================================
-- 2. PLAYER PAIR TRACKING ON BETS
-- ============================================

-- For Nassau round-robin: track which two players each bet is between
ALTER TABLE public.game_bets ADD COLUMN player_a_id UUID REFERENCES public.game_players(id);
ALTER TABLE public.game_bets ADD COLUMN player_b_id UUID REFERENCES public.game_players(id);

-- ============================================
-- 3. PLAYER-BASED SETTLEMENTS (guest-compatible)
-- ============================================

-- Add game_player references (works for both registered and guest players)
ALTER TABLE public.settlements ADD COLUMN from_player_id UUID REFERENCES public.game_players(id);
ALTER TABLE public.settlements ADD COLUMN to_player_id UUID REFERENCES public.game_players(id);

-- Make user references nullable (guests don't have user accounts)
ALTER TABLE public.settlements ALTER COLUMN from_user_id DROP NOT NULL;
ALTER TABLE public.settlements ALTER COLUMN to_user_id DROP NOT NULL;

-- ============================================
-- 4. RE-REFERENCE SCORES TO GAME_PLAYERS
-- ============================================

-- Scores.player_id should reference game_players.id (not users.id)
-- This allows guest players to have scores
ALTER TABLE public.scores DROP CONSTRAINT scores_player_id_fkey;
ALTER TABLE public.scores ADD CONSTRAINT scores_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.game_players(id);

-- Recreate unique constraint with new FK
ALTER TABLE public.scores DROP CONSTRAINT scores_game_id_hole_number_player_id_key;
ALTER TABLE public.scores ADD CONSTRAINT scores_game_id_hole_number_player_id_key
  UNIQUE(game_id, hole_number, player_id);

-- ============================================
-- 5. RE-REFERENCE GAME_BETS WINNER TO GAME_PLAYERS
-- ============================================

ALTER TABLE public.game_bets DROP CONSTRAINT game_bets_winner_id_fkey;
ALTER TABLE public.game_bets ADD CONSTRAINT game_bets_winner_id_fkey
  FOREIGN KEY (winner_id) REFERENCES public.game_players(id);

-- ============================================
-- 6. ADDITIONAL RLS POLICIES
-- ============================================

-- Game creator can update any game_players in their games (including guests)
CREATE POLICY "Game creator can update game_players" ON public.game_players
  FOR UPDATE USING (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
  );

-- Game creator can delete game_players in their games
CREATE POLICY "Game creator can delete game_players" ON public.game_players
  FOR DELETE USING (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
  );

-- Game creator can insert scores for all players (including guests)
CREATE POLICY "Game creator can insert all scores" ON public.scores
  FOR INSERT WITH CHECK (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
  );

-- Game creator can update scores for all players
CREATE POLICY "Game creator can update all scores" ON public.scores
  FOR UPDATE USING (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
  );

-- Game creator can view their own game players (for games with only guest players)
CREATE POLICY "Game creator can view game players" ON public.game_players
  FOR SELECT USING (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
  );

-- Game creator can view settlements in their games
CREATE POLICY "Game creator can view game settlements" ON public.settlements
  FOR SELECT USING (
    game_id IN (SELECT id FROM public.games WHERE created_by = auth.uid())
  );

-- ============================================
-- 7. ENABLE REAL-TIME ON GAME_BETS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_bets;

-- ============================================
-- 8. NEW INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_scores_game_player ON public.scores(game_id, player_id);
CREATE INDEX IF NOT EXISTS idx_game_bets_players ON public.game_bets(game_id, player_a_id, player_b_id);
