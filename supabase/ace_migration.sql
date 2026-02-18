-- ============================================================
-- ACE AI CADDIE - Schema Migration
-- ============================================================
-- Run this in Supabase SQL Editor.
-- Adds tables and columns to support the Ace AI analytics engine.
-- ============================================================

-- ─── 1. Press Context Columns on game_bets ──────────────────
-- Captures WHEN and WHY a press was made for press advisor analytics

ALTER TABLE public.game_bets
ADD COLUMN IF NOT EXISTS press_initiated_hole INTEGER DEFAULT NULL;

ALTER TABLE public.game_bets
ADD COLUMN IF NOT EXISTS margin_at_press INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.game_bets.press_initiated_hole IS 'The hole number when this press bet was initiated (null for base bets)';
COMMENT ON COLUMN public.game_bets.margin_at_press IS 'How many holes down the presser was when they pressed (null for base bets)';


-- ─── 2. Courses Table ───────────────────────────────────────
-- Normalized course lookup for consistent analytics across games

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  num_holes INTEGER DEFAULT 18,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint on name + city + state to prevent dupes
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_unique_name
ON public.courses (LOWER(name), LOWER(COALESCE(city, '')), LOWER(COALESCE(state, '')));

-- RLS for courses: anyone can read, authenticated users can insert
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read courses"
ON public.courses FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create courses"
ON public.courses FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);


-- ─── 3. Course Holes Table ──────────────────────────────────
-- Per-hole data for each course (par, handicap index, yardage)

CREATE TABLE IF NOT EXISTS public.course_holes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par INTEGER NOT NULL CHECK (par BETWEEN 3 AND 6),
  handicap_index INTEGER CHECK (handicap_index BETWEEN 1 AND 18),
  yardage INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id, hole_number)
);

-- RLS for course_holes
ALTER TABLE public.course_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read course holes"
ON public.course_holes FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create course holes"
ON public.course_holes FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);


-- ─── 4. Course ID on Games ──────────────────────────────────
-- Link games to normalized courses (optional — course_name stays for backwards compat)

ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) DEFAULT NULL;

COMMENT ON COLUMN public.games.course_id IS 'Optional FK to courses table for normalized course analytics';


-- ─── 5. Handicap History Table ──────────────────────────────
-- Tracks handicap changes over time for trend analysis

CREATE TABLE IF NOT EXISTS public.handicap_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  handicap DECIMAL(4,1) NOT NULL,
  source TEXT DEFAULT 'manual', -- 'manual', 'game_update', 'import'
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handicap_history_user
ON public.handicap_history (user_id, recorded_at DESC);

-- RLS: users can only see their own handicap history
ALTER TABLE public.handicap_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own handicap history"
ON public.handicap_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own handicap history"
ON public.handicap_history FOR INSERT
WITH CHECK (auth.uid() = user_id);


-- ─── 6. Ace Interactions Table ──────────────────────────────
-- Logs Ace conversations for learning and improvement

CREATE TABLE IF NOT EXISTS public.ace_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL, -- 'press_advice', 'matchup_report', 'post_round', 'course_intel', 'bet_sizing', 'trend_analysis', 'group_dynamics'
  context_json JSONB DEFAULT '{}', -- input context sent to AI
  response_json JSONB DEFAULT '{}', -- AI response stored
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ace_interactions_user
ON public.ace_interactions (user_id, created_at DESC);

-- RLS: users can only see their own interactions
ALTER TABLE public.ace_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own ace interactions"
ON public.ace_interactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ace interactions"
ON public.ace_interactions FOR INSERT
WITH CHECK (auth.uid() = user_id);


-- ─── 7. Press Suggestions Log ───────────────────────────────
-- Tracks press suggestions shown and whether accepted/declined

CREATE TABLE IF NOT EXISTS public.press_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  bet_id UUID REFERENCES public.game_bets(id) ON DELETE SET NULL,
  suggesting_player_id UUID NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  region TEXT NOT NULL, -- 'front', 'back', 'overall'
  margin_at_suggestion INTEGER NOT NULL, -- how many holes down
  accepted BOOLEAN DEFAULT NULL, -- null = pending, true = accepted, false = declined
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_press_suggestions_game
ON public.press_suggestions (game_id);

-- RLS: game participants can read/insert
ALTER TABLE public.press_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game participants can read press suggestions"
ON public.press_suggestions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp
    WHERE gp.game_id = press_suggestions.game_id
    AND gp.user_id = auth.uid()
  )
);

CREATE POLICY "Game participants can insert press suggestions"
ON public.press_suggestions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.game_players gp
    WHERE gp.game_id = press_suggestions.game_id
    AND gp.user_id = auth.uid()
  )
);

CREATE POLICY "Game participants can update press suggestions"
ON public.press_suggestions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp
    WHERE gp.game_id = press_suggestions.game_id
    AND gp.user_id = auth.uid()
  )
);


-- ─── 8. Backfill: Seed initial handicap_history for existing users ─
-- Records each user's current handicap as the starting point

INSERT INTO public.handicap_history (user_id, handicap, source, recorded_at)
SELECT id, handicap, 'backfill', COALESCE(updated_at, created_at)
FROM public.users
WHERE handicap IS NOT NULL
ON CONFLICT DO NOTHING;


-- ─── 9. Trigger: Auto-log handicap changes ─────────────────
-- Whenever a user updates their handicap, record it in history

CREATE OR REPLACE FUNCTION public.log_handicap_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.handicap IS DISTINCT FROM OLD.handicap AND NEW.handicap IS NOT NULL THEN
    INSERT INTO public.handicap_history (user_id, handicap, source)
    VALUES (NEW.id, NEW.handicap, 'manual');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_handicap_change ON public.users;

CREATE TRIGGER on_user_handicap_change
AFTER UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.log_handicap_change();


-- ─── 10. Enable real-time on new tables ─────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.ace_interactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.press_suggestions;


-- ============================================================
-- DONE! New tables: courses, course_holes, handicap_history,
--                   ace_interactions, press_suggestions
-- New columns: game_bets.press_initiated_hole, game_bets.margin_at_press,
--              games.course_id
-- ============================================================
