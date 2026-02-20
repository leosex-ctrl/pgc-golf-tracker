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
  strokeIndex?: number;
  strokes: number | null;
}

export interface RoundData {
  course_id: string;
  course_name: string;
  date: string;
  weather: string;
  wind_conditions: string;
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

    // 2. Verify the course exists
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, location')
      .eq('id', data.course_id)
      .single();

    if (courseError || !course) {
      return { success: false, error: 'Selected course not found. Please select a valid course.' };
    }

    const courseId = course.id;
    const courseLocation = course.location;

    // 3. Fetch weather data automatically
    let weatherCategory = data.weather || 'Other';
    let tempC: number | null = null;
    let windSpeedKph: number | null = null;

    if (courseLocation && data.date) {
      try {
        const weatherData = await fetchHistoricalWeather(data.date, courseLocation);

        if (weatherData) {
          if (!data.weather || data.weather === '' || data.weather === 'Other') {
            weatherCategory = weatherData.weather;
          }
          tempC = weatherData.temp_c;
          windSpeedKph = weatherData.wind_speed_kph;

          console.log(`Weather auto-populated: ${weatherCategory}, ${tempC}°C, ${windSpeedKph} kph`);
        }
      } catch (weatherError) {
        console.warn('Weather lookup failed, using manual input:', weatherError);
      }
    }

    // 4. Apply triple bogey rule and calculate totals
    const holesPlayed = data.round_length || 18;
    const activeHoles = data.holes.slice(0, holesPlayed);

    // Triple bogey rule: blank/null strokes = par + 3
    const finalHoles = activeHoles.map((h) => ({
      ...h,
      strokes: h.strokes !== null && h.strokes > 0 ? h.strokes : h.par + 3,
    }));

    const totalStrokes = finalHoles.reduce((sum, h) => sum + h.strokes, 0);
    const totalPar = finalHoles.reduce((sum, h) => sum + h.par, 0);

    // 5. Insert Round
    const { data: newRound, error: roundError } = await supabase
      .from('rounds')
      .insert({
        user_id: user.id,
        course_id: courseId,
        date_of_round: data.date,
        weather: weatherCategory,
        wind_conditions: data.wind_conditions || null,
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

    // 6. Bulk Insert Scores
    const scoreRows = finalHoles.map((hole) => ({
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
