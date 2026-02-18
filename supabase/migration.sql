-- Nassau Golf Betting App - Database Schema
-- Run this in your Supabase SQL editor to create all tables

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  venmo_username TEXT,
  handicap DECIMAL(4,1) CHECK (handicap >= 0 AND handicap <= 54),
  subscription_status TEXT NOT NULL DEFAULT 'free' CHECK (subscription_status IN ('free', 'premium')),
  subscription_id TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- GAMES TABLE
-- ============================================
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  game_type TEXT NOT NULL CHECK (game_type IN ('nassau', 'skins', 'wolf', 'match_play')),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'completed', 'cancelled')),
  total_pot DECIMAL(10,2) NOT NULL DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{}',
  course_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ============================================
-- GAME PLAYERS TABLE
-- ============================================
CREATE TABLE public.game_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  paid_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (paid_status IN ('unpaid', 'paid_venmo', 'paid_zelle', 'paid_cash')),
  handicap_used DECIMAL(4,1),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

-- ============================================
-- GAME BETS TABLE
-- ============================================
CREATE TABLE public.game_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  bet_type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  winner_id UUID REFERENCES public.users(id),
  settled BOOLEAN NOT NULL DEFAULT FALSE,
  parent_bet_id UUID REFERENCES public.game_bets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SCORES TABLE
-- ============================================
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  player_id UUID NOT NULL REFERENCES public.users(id),
  strokes INTEGER NOT NULL CHECK (strokes >= 1 AND strokes <= 20),
  net_score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, hole_number, player_id)
);

-- ============================================
-- SETTLEMENTS TABLE
-- ============================================
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.users(id),
  to_user_id UUID NOT NULL REFERENCES public.users(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  settlement_method TEXT CHECK (settlement_method IN ('venmo', 'zelle', 'cash', 'other')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- WOLF CHOICES TABLE
-- ============================================
CREATE TABLE public.wolf_choices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  wolf_player_id UUID NOT NULL REFERENCES public.users(id),
  choice_type TEXT NOT NULL CHECK (choice_type IN ('solo', 'partner')),
  partner_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, hole_number)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_games_created_by ON public.games(created_by);
CREATE INDEX idx_games_status ON public.games(status);
CREATE INDEX idx_game_players_game_id ON public.game_players(game_id);
CREATE INDEX idx_game_players_user_id ON public.game_players(user_id);
CREATE INDEX idx_game_bets_game_id ON public.game_bets(game_id);
CREATE INDEX idx_scores_game_id ON public.scores(game_id);
CREATE INDEX idx_scores_player_id ON public.scores(player_id);
CREATE INDEX idx_settlements_game_id ON public.settlements(game_id);
CREATE INDEX idx_settlements_from_user ON public.settlements(from_user_id);
CREATE INDEX idx_settlements_to_user ON public.settlements(to_user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wolf_choices ENABLE ROW LEVEL SECURITY;

-- USERS: Users can read/write their own record
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to search for other users (for adding to games)
CREATE POLICY "Users can view other users basic info"
  ON public.users FOR SELECT
  USING (true);

-- GAMES: Users can see games they're part of
CREATE POLICY "Users can view games they participate in"
  ON public.games FOR SELECT
  USING (
    id IN (
      SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create games"
  ON public.games FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Game creator can update game"
  ON public.games FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Game creator can delete game"
  ON public.games FOR DELETE
  USING (created_by = auth.uid());

-- GAME PLAYERS: Users can see players in their games
CREATE POLICY "Users can view game players in their games"
  ON public.game_players FOR SELECT
  USING (
    game_id IN (
      SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Game creator can add players"
  ON public.game_players FOR INSERT
  WITH CHECK (
    game_id IN (
      SELECT id FROM public.games WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Game players can update their own status"
  ON public.game_players FOR UPDATE
  USING (user_id = auth.uid());

-- GAME BETS: Users can see bets in their games
CREATE POLICY "Users can view bets in their games"
  ON public.game_bets FOR SELECT
  USING (
    game_id IN (
      SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Game players can create bets"
  ON public.game_bets FOR INSERT
  WITH CHECK (
    game_id IN (
      SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Game players can update bets"
  ON public.game_bets FOR UPDATE
  USING (
    game_id IN (
      SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
    )
  );

-- SCORES: All game players can read/write scores
CREATE POLICY "Game players can view scores"
  ON public.scores FOR SELECT
  USING (
    game_id IN (
      SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Game players can insert scores"
  ON public.scores FOR INSERT
  WITH CHECK (
    game_id IN (
      SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Game players can update scores"
  ON public.scores FOR UPDATE
  USING (
    game_id IN (
      SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
    )
  );

-- SETTLEMENTS: Only involved users can see
CREATE POLICY "Users can view their settlements"
  ON public.settlements FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Game players can create settlements"
  ON public.settlements FOR INSERT
  WITH CHECK (
    game_id IN (
      SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Settlement parties can update"
  ON public.settlements FOR UPDATE
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- WOLF CHOICES: Game players can read/write
CREATE POLICY "Game players can view wolf choices"
  ON public.wolf_choices FOR SELECT
  USING (
    game_id IN (
      SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Wolf player can insert choice"
  ON public.wolf_choices FOR INSERT
  WITH CHECK (wolf_player_id = auth.uid());

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at on users
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER scores_updated_at
  BEFORE UPDATE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settlements;
