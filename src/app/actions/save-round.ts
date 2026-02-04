'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { fetchHistoricalWeather } from '@/lib/weather';

// Types
export interface HoleData {
  hole: number;
  par: number;
  distance: number;
  strokes: number | null;
}

export interface RoundData {
  course_name: string;
  date: string;
  weather: string;
  course_rating: number | null;
  slope_rating: number | null;
  holes: HoleData[];
  round_length?: 9 | 18;
}

export interface SaveRoundResult {
  success: boolean;
  error?: string;
  roundId?: string;
}

// Create server-side Supabase client
async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore - called from Server Component
          }
        },
      },
    }
  );
}

export async function saveRound(data: RoundData): Promise<SaveRoundResult> {
  try {
    const supabase = await createClient();

    // 1. Get current user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Not authenticated. Please log in.' };
    }

    // 2. Upsert Course - Check if exists, insert if not
    let courseId: string;
    let courseLocation: string | null = null;

    const { data: existingCourse } = await supabase
      .from('courses')
      .select('id, location')
      .eq('name', data.course_name)
      .single();

    if (existingCourse) {
      courseId = existingCourse.id;
      courseLocation = existingCourse.location;
    } else {
      // Insert new course
      const { data: newCourse, error: courseError } = await supabase
        .from('courses')
        .insert({
          name: data.course_name,
          rating: data.course_rating,
          slope: data.slope_rating,
        })
        .select('id, location')
        .single();

      if (courseError || !newCourse) {
        return { success: false, error: `Failed to create course: ${courseError?.message}` };
      }

      courseId = newCourse.id;
      courseLocation = newCourse.location;
    }

    // 3. Fetch weather data automatically
    let weatherCategory = data.weather || 'Other';
    let tempC: number | null = null;
    let windSpeedKph: number | null = null;

    // Only fetch weather if we have a location and date
    if (courseLocation && data.date) {
      try {
        const weatherData = await fetchHistoricalWeather(data.date, courseLocation);

        if (weatherData) {
          // Use API weather if no manual weather was provided, or override with API data
          if (!data.weather || data.weather === '' || data.weather === 'Other') {
            weatherCategory = weatherData.weather;
          }
          tempC = weatherData.temp_c;
          windSpeedKph = weatherData.wind_speed_kph;

          console.log(`Weather auto-populated: ${weatherCategory}, ${tempC}°C, ${windSpeedKph} kph`);
        }
      } catch (weatherError) {
        // Weather fetch failed - continue with manual/default weather
        console.warn('Weather lookup failed, using manual input:', weatherError);
      }
    }

    // 4. Calculate total score (only count holes based on round_length)
    const holesPlayed = data.round_length || 18;
    const activeHoles = data.holes.slice(0, holesPlayed);
    const totalStrokes = activeHoles.reduce((sum, h) => sum + (h.strokes || 0), 0);
    const totalPar = activeHoles.reduce((sum, h) => sum + h.par, 0);

    // 5. Insert Round with weather data and holes_played
    const { data: newRound, error: roundError } = await supabase
      .from('rounds')
      .insert({
        user_id: user.id,
        course_id: courseId,
        date_played: data.date,
        weather: weatherCategory,
        temp_c: tempC,
        wind_speed_kph: windSpeedKph,
        total_strokes: totalStrokes,
        total_par: totalPar,
        score_to_par: totalStrokes - totalPar,
        holes_played: holesPlayed,
      })
      .select('id')
      .single();

    if (roundError || !newRound) {
      return { success: false, error: `Failed to create round: ${roundError?.message}` };
    }

    // 6. Bulk Insert Scores (only for active holes)
    const scoreRows = activeHoles.map((hole) => ({
      round_id: newRound.id,
      hole_number: hole.hole,
      par: hole.par,
      distance: hole.distance,
      strokes: hole.strokes,
    }));

    const { error: scoresError } = await supabase
      .from('round_scores')
      .insert(scoreRows);

    if (scoresError) {
      return { success: false, error: `Failed to save hole scores: ${scoresError.message}` };
    }

    // 7. Revalidate dashboard
    revalidatePath('/dashboard');

    return { success: true, roundId: newRound.id };

  } catch (error: any) {
    console.error('Save round error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
