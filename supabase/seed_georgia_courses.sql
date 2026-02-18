-- ============================================================
-- Georgia Golf Courses — Seed Data
-- ============================================================
-- 20 major Georgia golf courses with hole-by-hole par data.
-- One-time seed. If a user plays one of these courses and the
-- pars have changed, the app's saveOrUpdateCourse() overwrites
-- the old data automatically — latest game always wins.
--
-- Run this in Supabase SQL Editor after ace_migration.sql.
-- ============================================================

DO $$
DECLARE
  cid UUID;
BEGIN

  -- ─── 1. East Lake Golf Club ──────────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'East Lake Golf Club', 'Atlanta', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,5),(cid,2,3),(cid,3,4),(cid,4,4),(cid,5,4),(cid,6,5),(cid,7,4),(cid,8,4),(cid,9,3),
    (cid,10,4),(cid,11,3),(cid,12,4),(cid,13,4),(cid,14,5),(cid,15,3),(cid,16,4),(cid,17,4),(cid,18,5);

  -- ─── 2. Bobby Jones Golf Course ─────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Bobby Jones Golf Course', 'Atlanta', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,4),(cid,3,3),(cid,4,4),(cid,5,5),(cid,6,4),(cid,7,4),(cid,8,3),(cid,9,5),
    (cid,10,4),(cid,11,4),(cid,12,3),(cid,13,4),(cid,14,5),(cid,15,4),(cid,16,4),(cid,17,3),(cid,18,5);

  -- ─── 3. TPC Sugarloaf ───────────────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'TPC Sugarloaf', 'Duluth', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,3),(cid,3,4),(cid,4,5),(cid,5,4),(cid,6,5),(cid,7,4),(cid,8,3),(cid,9,4),
    (cid,10,5),(cid,11,3),(cid,12,4),(cid,13,4),(cid,14,4),(cid,15,4),(cid,16,3),(cid,17,4),(cid,18,5);

  -- ─── 4. Chateau Elan Golf Club ──────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Chateau Elan Golf Club', 'Braselton', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,5),(cid,2,3),(cid,3,4),(cid,4,4),(cid,5,4),(cid,6,3),(cid,7,4),(cid,8,5),(cid,9,4),
    (cid,10,5),(cid,11,4),(cid,12,4),(cid,13,3),(cid,14,4),(cid,15,5),(cid,16,4),(cid,17,3),(cid,18,4);

  -- ─── 5. Hawks Ridge Golf Club ───────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Hawks Ridge Golf Club', 'Ball Ground', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,4),(cid,3,3),(cid,4,5),(cid,5,3),(cid,6,4),(cid,7,5),(cid,8,4),(cid,9,4),
    (cid,10,4),(cid,11,4),(cid,12,3),(cid,13,5),(cid,14,4),(cid,15,4),(cid,16,3),(cid,17,4),(cid,18,5);

  -- ─── 6. Bear's Best Atlanta ─────────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Bear''s Best Atlanta', 'Suwanee', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,4),(cid,3,3),(cid,4,4),(cid,5,4),(cid,6,3),(cid,7,5),(cid,8,4),(cid,9,5),
    (cid,10,4),(cid,11,3),(cid,12,5),(cid,13,4),(cid,14,5),(cid,15,4),(cid,16,3),(cid,17,4),(cid,18,4);

  -- ─── 7. Echelon Golf Club ───────────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Echelon Golf Club', 'Alpharetta', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,4),(cid,3,3),(cid,4,5),(cid,5,4),(cid,6,4),(cid,7,5),(cid,8,3),(cid,9,4),
    (cid,10,4),(cid,11,5),(cid,12,4),(cid,13,4),(cid,14,5),(cid,15,3),(cid,16,4),(cid,17,3),(cid,18,4);

  -- ─── 8. The Georgia Club ────────────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'The Georgia Club', 'Statham', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,5),(cid,2,4),(cid,3,3),(cid,4,4),(cid,5,4),(cid,6,5),(cid,7,4),(cid,8,3),(cid,9,4),
    (cid,10,5),(cid,11,3),(cid,12,4),(cid,13,4),(cid,14,4),(cid,15,4),(cid,16,5),(cid,17,3),(cid,18,4);

  -- ─── 9. Cuscowilla Golf Club (Par 70) ──────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Cuscowilla Golf Club', 'Eatonton', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,5),(cid,3,3),(cid,4,4),(cid,5,4),(cid,6,4),(cid,7,4),(cid,8,3),(cid,9,4),
    (cid,10,4),(cid,11,3),(cid,12,4),(cid,13,4),(cid,14,5),(cid,15,4),(cid,16,3),(cid,17,4),(cid,18,4);

  -- ─── 10. Reynolds Lake Oconee (Great Waters) ────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Reynolds Lake Oconee - Great Waters', 'Greensboro', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,5),(cid,3,4),(cid,4,3),(cid,5,4),(cid,6,5),(cid,7,4),(cid,8,3),(cid,9,4),
    (cid,10,4),(cid,11,4),(cid,12,5),(cid,13,4),(cid,14,3),(cid,15,4),(cid,16,4),(cid,17,3),(cid,18,5);

  -- ─── 11. Sea Island Golf Club (Seaside) — Par 70 ───────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Sea Island Golf Club - Seaside', 'St. Simons Island', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,4),(cid,3,3),(cid,4,4),(cid,5,4),(cid,6,3),(cid,7,5),(cid,8,4),(cid,9,4),
    (cid,10,4),(cid,11,4),(cid,12,3),(cid,13,4),(cid,14,4),(cid,15,5),(cid,16,4),(cid,17,3),(cid,18,4);

  -- ─── 12. The Landings Club (Marshwood) ──────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'The Landings Club - Marshwood', 'Savannah', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,5),(cid,3,4),(cid,4,3),(cid,5,5),(cid,6,4),(cid,7,4),(cid,8,3),(cid,9,4),
    (cid,10,4),(cid,11,4),(cid,12,3),(cid,13,5),(cid,14,4),(cid,15,5),(cid,16,3),(cid,17,4),(cid,18,4);

  -- ─── 13. Country Club of the South ──────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Country Club of the South', 'Johns Creek', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,4),(cid,3,5),(cid,4,4),(cid,5,3),(cid,6,5),(cid,7,4),(cid,8,3),(cid,9,4),
    (cid,10,5),(cid,11,4),(cid,12,4),(cid,13,3),(cid,14,4),(cid,15,4),(cid,16,5),(cid,17,3),(cid,18,4);

  -- ─── 14. Atlanta Athletic Club (Highlands) ──────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Atlanta Athletic Club - Highlands', 'Johns Creek', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,5),(cid,3,4),(cid,4,3),(cid,5,5),(cid,6,4),(cid,7,3),(cid,8,4),(cid,9,4),
    (cid,10,4),(cid,11,4),(cid,12,5),(cid,13,4),(cid,14,4),(cid,15,3),(cid,16,4),(cid,17,3),(cid,18,5);

  -- ─── 15. Peachtree Golf Club ────────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Peachtree Golf Club', 'Atlanta', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,5),(cid,3,4),(cid,4,3),(cid,5,5),(cid,6,3),(cid,7,4),(cid,8,4),(cid,9,4),
    (cid,10,5),(cid,11,3),(cid,12,4),(cid,13,4),(cid,14,3),(cid,15,4),(cid,16,5),(cid,17,4),(cid,18,4);

  -- ─── 16. Capital City Club (Crabapple) ──────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Capital City Club - Crabapple', 'Milton', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,4),(cid,3,3),(cid,4,5),(cid,5,4),(cid,6,3),(cid,7,4),(cid,8,4),(cid,9,5),
    (cid,10,4),(cid,11,4),(cid,12,5),(cid,13,3),(cid,14,4),(cid,15,3),(cid,16,5),(cid,17,4),(cid,18,4);

  -- ─── 17. Ansley Golf Club (Settindown Creek) ────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Ansley Golf Club - Settindown Creek', 'Roswell', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,4),(cid,3,3),(cid,4,4),(cid,5,5),(cid,6,4),(cid,7,5),(cid,8,4),(cid,9,3),
    (cid,10,4),(cid,11,4),(cid,12,3),(cid,13,5),(cid,14,5),(cid,15,4),(cid,16,4),(cid,17,4),(cid,18,3);

  -- ─── 18. Druid Hills Golf Club ──────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Druid Hills Golf Club', 'Atlanta', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,4),(cid,3,4),(cid,4,4),(cid,5,4),(cid,6,3),(cid,7,5),(cid,8,3),(cid,9,5),
    (cid,10,4),(cid,11,4),(cid,12,4),(cid,13,3),(cid,14,5),(cid,15,4),(cid,16,4),(cid,17,3),(cid,18,5);

  -- ─── 19. Piedmont Driving Club ──────────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Piedmont Driving Club', 'Atlanta', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,5),(cid,3,4),(cid,4,4),(cid,5,3),(cid,6,5),(cid,7,3),(cid,8,4),(cid,9,4),
    (cid,10,5),(cid,11,4),(cid,12,3),(cid,13,4),(cid,14,4),(cid,15,4),(cid,16,4),(cid,17,3),(cid,18,5);

  -- ─── 20. Augusta National Golf Club ─────────────────────
  INSERT INTO courses (id, name, city, state, num_holes, created_by)
  VALUES (gen_random_uuid(), 'Augusta National Golf Club', 'Augusta', 'GA', 18, NULL)
  RETURNING id INTO cid;
  INSERT INTO course_holes (course_id, hole_number, par) VALUES
    (cid,1,4),(cid,2,5),(cid,3,4),(cid,4,3),(cid,5,4),(cid,6,3),(cid,7,4),(cid,8,5),(cid,9,4),
    (cid,10,4),(cid,11,4),(cid,12,3),(cid,13,5),(cid,14,4),(cid,15,5),(cid,16,3),(cid,17,4),(cid,18,4);

  RAISE NOTICE 'Seeded 20 Georgia golf courses with hole-by-hole par data.';
END $$;
