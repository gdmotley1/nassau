/**
 * Course Service
 *
 * Manages the courses table — auto-saves courses from games,
 * provides course lookup/search for auto-filling pars,
 * and links games to normalized course records.
 *
 * Zero external API calls — all data comes from user-created games.
 */

import { supabase } from './supabase';
import type { CourseRow, CourseHoleRow } from '../types';

export interface CourseWithHoles {
  course: CourseRow;
  holes: CourseHoleRow[];
}

/**
 * Search courses by name prefix (case-insensitive).
 * Returns courses matching the search term, sorted by most recently created.
 * Used for autocomplete in CreateGameScreen.
 */
export async function searchCourses(
  query: string,
  limit: number = 5,
): Promise<{ data: CourseRow[]; error?: string }> {
  if (!query || query.trim().length < 2) return { data: [] };

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .ilike('name', `%${query.trim()}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as CourseRow[] };
}

/**
 * Get a course with all its hole data.
 * Used to auto-fill pars when a user selects a saved course.
 */
export async function getCourseWithHoles(
  courseId: string,
): Promise<{ data?: CourseWithHoles; error?: string }> {
  const [courseRes, holesRes] = await Promise.all([
    supabase.from('courses').select('*').eq('id', courseId).single(),
    supabase
      .from('course_holes')
      .select('*')
      .eq('course_id', courseId)
      .order('hole_number', { ascending: true }),
  ]);

  if (courseRes.error || !courseRes.data) {
    return { error: courseRes.error?.message ?? 'Course not found' };
  }

  return {
    data: {
      course: courseRes.data as unknown as CourseRow,
      holes: (holesRes.data ?? []) as unknown as CourseHoleRow[],
    },
  };
}

/**
 * Find an existing course by exact name (case-insensitive).
 * Used to check if a course already exists before saving a duplicate.
 */
export async function findCourseByName(
  name: string,
): Promise<{ data?: CourseRow; error?: string }> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .ilike('name', name.trim())
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found — that's OK
    return { error: error.message };
  }

  return { data: data ? (data as unknown as CourseRow) : undefined };
}

/**
 * Save a course and its hole pars from a game.
 * Called automatically after game creation when a course name is provided.
 *
 * - If a course with the same name already exists, updates hole pars
 *   (latest game data wins — assumes most recent pars are correct)
 * - If no match, creates a new course record
 *
 * Returns the course_id so it can be linked to the game.
 */
export async function saveOrUpdateCourse(
  courseName: string,
  holePars: number[],
  createdBy: string,
): Promise<{ courseId?: string; error?: string }> {
  if (!courseName || courseName.trim().length === 0) {
    return { error: 'No course name' };
  }

  const trimmedName = courseName.trim();
  const numHoles = holePars.length;

  try {
    // Check if course already exists
    const existing = await findCourseByName(trimmedName);

    let courseId: string;

    if (existing.data) {
      // Course exists — update hole pars with latest data
      courseId = existing.data.id;

      // Delete old holes and re-insert with current pars
      await supabase
        .from('course_holes')
        .delete()
        .eq('course_id', courseId);

      const holeInserts = holePars.map((par, i) => ({
        course_id: courseId,
        hole_number: i + 1,
        par,
        handicap_index: null,
        yardage: null,
      }));

      await supabase.from('course_holes').insert(holeInserts as any);
    } else {
      // New course — insert course + holes
      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert({
          name: trimmedName,
          city: null,
          state: null,
          num_holes: numHoles,
          created_by: createdBy,
        } as any)
        .select()
        .single();

      if (courseError || !newCourse) {
        return { error: courseError?.message ?? 'Failed to save course' };
      }

      courseId = (newCourse as any).id;

      const holeInserts = holePars.map((par, i) => ({
        course_id: courseId,
        hole_number: i + 1,
        par,
        handicap_index: null,
        yardage: null,
      }));

      await supabase.from('course_holes').insert(holeInserts as any);
    }

    return { courseId };
  } catch (e: any) {
    return { error: e.message ?? 'Failed to save course' };
  }
}

/**
 * Link a game to a normalized course record.
 * Sets game.course_id after saving the course.
 */
export async function linkGameToCourse(
  gameId: string,
  courseId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('games')
    .update({ course_id: courseId } as any)
    .eq('id', gameId);

  return error ? { error: error.message } : {};
}

/**
 * Get all courses the user has played at (via their games).
 * Useful for "recent courses" suggestions.
 */
export async function getRecentCourses(
  userId: string,
  limit: number = 10,
): Promise<{ data: CourseRow[]; error?: string }> {
  // Get user's game IDs
  const { data: playerRows } = await supabase
    .from('game_players')
    .select('game_id')
    .eq('user_id', userId);

  if (!playerRows || playerRows.length === 0) return { data: [] };

  const gameIds = playerRows.map((r: any) => r.game_id);

  // Get unique course names from those games
  const { data: games } = await supabase
    .from('games')
    .select('course_name')
    .in('id', gameIds)
    .not('course_name', 'is', null)
    .neq('course_name', 'Unknown Course')
    .order('created_at', { ascending: false });

  if (!games || games.length === 0) return { data: [] };

  // Get unique course names
  const seenNames = new Set<string>();
  const uniqueNames: string[] = [];
  for (const game of games) {
    const name = ((game as any).course_name as string).toLowerCase().trim();
    if (!seenNames.has(name)) {
      seenNames.add(name);
      uniqueNames.push((game as any).course_name as string);
    }
    if (uniqueNames.length >= limit) break;
  }

  // Look up these courses in the courses table
  if (uniqueNames.length === 0) return { data: [] };

  const { data: courses, error } = await supabase
    .from('courses')
    .select('*')
    .in('name', uniqueNames);

  if (error) return { data: [], error: error.message };
  return { data: (courses ?? []) as unknown as CourseRow[] };
}
