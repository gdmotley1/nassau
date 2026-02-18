-- Nassau Golf Betting App - Phase 3: Friends System Migration
-- Run this in your Supabase SQL editor

-- ============================================
-- 1. ADD FRIEND CODE TO USERS
-- ============================================

-- Generate a unique 6-char alphanumeric friend code
CREATE OR REPLACE FUNCTION generate_friend_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  done BOOL := FALSE;
BEGIN
  WHILE NOT done LOOP
    -- Generate 6-char uppercase alphanumeric from md5 hash
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    -- Replace ambiguous characters for readability
    code := replace(replace(replace(code, 'O', 'X'), 'I', 'Y'), 'L', 'Z');
    -- Check uniqueness
    done := NOT EXISTS (SELECT 1 FROM users WHERE friend_code = code);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Add column (nullable first for backfill)
ALTER TABLE users ADD COLUMN IF NOT EXISTS friend_code TEXT UNIQUE;

-- Backfill existing users
UPDATE users SET friend_code = generate_friend_code() WHERE friend_code IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE users ALTER COLUMN friend_code SET NOT NULL;

-- Auto-generate friend_code on new user insert
CREATE OR REPLACE FUNCTION set_friend_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.friend_code IS NULL THEN
    NEW.friend_code := generate_friend_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_friend_code
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION set_friend_code();

-- ============================================
-- 2. FRIENDSHIPS TABLE
-- ============================================

CREATE TABLE public.friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);

-- Enable RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Users can view their own friendships
CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create friendships where they are user_id
CREATE POLICY "Users can create friendships"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete friendships where they are user_id
CREATE POLICY "Users can remove own friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = user_id);

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;

-- ============================================
-- 3. RPC FUNCTIONS (SECURITY DEFINER)
-- ============================================

-- Lookup user by friend code (safe public lookup)
CREATE OR REPLACE FUNCTION lookup_user_by_friend_code(code TEXT)
RETURNS TABLE(id UUID, name TEXT, handicap NUMERIC, friend_code TEXT)
SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT u.id, u.name, u.handicap, u.friend_code
    FROM users u
    WHERE u.friend_code = upper(code);
END;
$$ LANGUAGE plpgsql;

-- Add friend (atomic, bidirectional)
CREATE OR REPLACE FUNCTION add_friend(target_friend_code TEXT)
RETURNS JSON
SECURITY DEFINER AS $$
DECLARE
  current_user_id UUID;
  target_user_id UUID;
  target_name TEXT;
BEGIN
  current_user_id := auth.uid();

  -- Look up target user
  SELECT u.id, u.name INTO target_user_id, target_name
  FROM users u
  WHERE u.friend_code = upper(target_friend_code);

  IF target_user_id IS NULL THEN
    RETURN json_build_object('error', 'No user found with that code');
  END IF;

  IF target_user_id = current_user_id THEN
    RETURN json_build_object('error', 'You cannot add yourself');
  END IF;

  -- Check if already friends
  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE user_id = current_user_id AND friend_id = target_user_id
  ) THEN
    RETURN json_build_object('error', 'Already friends with ' || target_name);
  END IF;

  -- Insert both directions (bidirectional friendship)
  INSERT INTO friendships (user_id, friend_id)
  VALUES (current_user_id, target_user_id);
  INSERT INTO friendships (user_id, friend_id)
  VALUES (target_user_id, current_user_id);

  RETURN json_build_object('success', true, 'friend_id', target_user_id, 'friend_name', target_name);
END;
$$ LANGUAGE plpgsql;

-- Remove friend (atomic, bidirectional)
CREATE OR REPLACE FUNCTION remove_friend(target_user_id UUID)
RETURNS JSON
SECURITY DEFINER AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();

  DELETE FROM friendships
  WHERE (user_id = current_user_id AND friend_id = target_user_id)
     OR (user_id = target_user_id AND friend_id = current_user_id);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. RLS FOR SHARED GAMES
-- ============================================
-- Ensure players (not just creators) can read game data.
-- Uses SECURITY DEFINER function to avoid circular RLS deps.

CREATE OR REPLACE FUNCTION is_game_participant(gid UUID)
RETURNS BOOLEAN
SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM game_players
    WHERE game_id = gid AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

-- Games: participants can read
DO $$
BEGIN
  -- Drop existing policy if it only checks created_by
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'games' AND policyname = 'Users can view own games') THEN
    DROP POLICY "Users can view own games" ON games;
  END IF;
END $$;

CREATE POLICY "Users can view own games"
  ON games FOR SELECT
  USING (created_by = auth.uid() OR is_game_participant(id));

-- Game players: participants can read all players in their games
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'game_players' AND policyname = 'Users can view game players') THEN
    DROP POLICY "Users can view game players" ON game_players;
  END IF;
END $$;

CREATE POLICY "Users can view game players"
  ON game_players FOR SELECT
  USING (is_game_participant(game_id));

-- Game bets: participants can read
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'game_bets' AND policyname = 'Users can view game bets') THEN
    DROP POLICY "Users can view game bets" ON game_bets;
  END IF;
END $$;

CREATE POLICY "Users can view game bets"
  ON game_bets FOR SELECT
  USING (is_game_participant(game_id));

-- Scores: participants can read
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scores' AND policyname = 'Users can view scores') THEN
    DROP POLICY "Users can view scores" ON scores;
  END IF;
END $$;

CREATE POLICY "Users can view scores"
  ON scores FOR SELECT
  USING (is_game_participant(game_id));

-- Settlements: participants can read
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settlements' AND policyname = 'Users can view settlements') THEN
    DROP POLICY "Users can view settlements" ON settlements;
  END IF;
END $$;

CREATE POLICY "Users can view settlements"
  ON settlements FOR SELECT
  USING (is_game_participant(game_id));
