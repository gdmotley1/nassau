-- Waitlist table for pre-launch email capture
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  source text DEFAULT 'website',
  referrer text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can sign up (anon key from the static site)
CREATE POLICY "Anyone can join waitlist"
  ON waitlist FOR INSERT TO anon
  WITH CHECK (true);

-- Only service_role can read the full list (Supabase dashboard / export)
CREATE POLICY "Service role reads waitlist"
  ON waitlist FOR SELECT TO service_role
  USING (true);

-- Public RPC to get the count (for social proof on the site)
CREATE OR REPLACE FUNCTION get_waitlist_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*)::integer FROM waitlist;
$$;
