/**
 * Weather API Utility - Visual Crossing API Integration
 *
 * Fetches historical weather data for a specific date and location.
 * Uses Visual Crossing Timeline Weather API.
 */

// ============================================
// TYPES
// ============================================

export interface WeatherData {
  weather: string;        // Mapped to app categories: Rainy, Sunny, Windy, Calm, Overcast, Other
  temp_c: number | null;  // Temperature in Celsius
  wind_speed_kph: number | null; // Wind speed in km/h
  conditions: string;     // Original API conditions string
}

interface VisualCrossingDay {
  datetime: string;
  temp: number;           // Temperature in Fahrenheit (API default)
  tempmax: number;
  tempmin: number;
  humidity: number;
  windspeed: number;      // Wind speed in mph (API default)
  windgust: number | null;
  conditions: string;
  description: string;
  icon: string;
  hours?: VisualCrossingHour[];
}

interface VisualCrossingHour {
  datetime: string;       // "HH:mm:ss" format
  temp: number;
  windspeed: number;
  conditions: string;
}

interface VisualCrossingResponse {
  days: VisualCrossingDay[];
  address: string;
  resolvedAddress: string;
}

// ============================================
// CONSTANTS
// ============================================

const VISUAL_CROSSING_BASE_URL = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline';

// Weather condition mapping from Visual Crossing to app categories
const WEATHER_MAPPING: Record<string, string> = {
  // Rainy conditions
  'rain': 'Rainy',
  'showers': 'Rainy',
  'drizzle': 'Rainy',
  'thunderstorm': 'Rainy',
  'rain, overcast': 'Rainy',
  'rain, partially cloudy': 'Rainy',

  // Sunny conditions
  'clear': 'Sunny',
  'sunny': 'Sunny',

  // Overcast/Cloudy conditions
  'overcast': 'Cloudy',
  'cloudy': 'Cloudy',
  'partially cloudy': 'Cloudy',
  'fog': 'Cloudy',

  // Snow (map to Cold)
  'snow': 'Cold',
  'snow, overcast': 'Cold',
  'snow, partially cloudy': 'Cold',
  'freezing': 'Cold',
  'ice': 'Cold',
};

// Wind speed thresholds (in kph)
const WINDY_THRESHOLD_KPH = 25; // Above this is considered "Windy"
const CALM_THRESHOLD_KPH = 10;  // Below this is considered "Calm"

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert Fahrenheit to Celsius
 */
function fahrenheitToCelsius(f: number): number {
  return Math.round(((f - 32) * 5 / 9) * 10) / 10;
}

/**
 * Convert mph to kph
 */
function mphToKph(mph: number): number {
  return Math.round(mph * 1.60934 * 10) / 10;
}

/**
 * Map Visual Crossing conditions to app weather categories
 */
function mapConditionsToCategory(conditions: string, windSpeedKph: number): string {
  const conditionsLower = conditions.toLowerCase();

  // Check for wind first (override other conditions if very windy)
  if (windSpeedKph >= WINDY_THRESHOLD_KPH) {
    return 'Windy';
  }

  // Check mapped conditions
  for (const [key, value] of Object.entries(WEATHER_MAPPING)) {
    if (conditionsLower.includes(key)) {
      return value;
    }
  }

  // If calm winds and no specific condition matched
  if (windSpeedKph <= CALM_THRESHOLD_KPH) {
    // Check for sunny indicators
    if (conditionsLower.includes('clear') || conditionsLower.includes('sun')) {
      return 'Sunny';
    }
    return 'Calm';
  }

  // Default fallback
  return 'Other';
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Fetch historical weather data for a specific date and location
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param location - Location string (city, country or coordinates)
 * @returns WeatherData object or null if fetch fails
 */
export async function fetchHistoricalWeather(
  date: string,
  location: string
): Promise<WeatherData | null> {
  const apiKey = process.env.VISUAL_CROSSING_API_KEY;

  if (!apiKey) {
    console.warn('Weather API: VISUAL_CROSSING_API_KEY not configured');
    return null;
  }

  if (!location || location.trim() === '') {
    console.warn('Weather API: No location provided');
    return null;
  }

  try {
    // Encode location for URL
    const encodedLocation = encodeURIComponent(location.trim());

    // Build API URL for specific date
    // Using include=hours to get hourly data for 12:00 PM
    const url = `${VISUAL_CROSSING_BASE_URL}/${encodedLocation}/${date}/${date}?unitGroup=us&include=hours&key=${apiKey}&contentType=json`;

    console.log(`Weather API: Fetching weather for ${location} on ${date}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Cache for 1 hour since historical data doesn't change
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Weather API Error: ${response.status} - ${errorText}`);
      return null;
    }

    const data: VisualCrossingResponse = await response.json();

    if (!data.days || data.days.length === 0) {
      console.warn('Weather API: No data returned for date');
      return null;
    }

    const dayData = data.days[0];

    // Try to get 12:00 PM (noon) data for more accurate round-time weather
    let temp = dayData.temp;
    let windSpeed = dayData.windspeed;
    let conditions = dayData.conditions;

    if (dayData.hours && dayData.hours.length > 0) {
      // Find the hour closest to 12:00 PM
      const noonHour = dayData.hours.find(h => h.datetime.startsWith('12:'));
      if (noonHour) {
        temp = noonHour.temp;
        windSpeed = noonHour.windspeed;
        conditions = noonHour.conditions;
      }
    }

    // Convert units
    const tempCelsius = fahrenheitToCelsius(temp);
    const windSpeedKph = mphToKph(windSpeed);

    // Map conditions to app category
    const weatherCategory = mapConditionsToCategory(conditions, windSpeedKph);

    const weatherData: WeatherData = {
      weather: weatherCategory,
      temp_c: tempCelsius,
      wind_speed_kph: windSpeedKph,
      conditions: conditions,
    };

    console.log(`Weather API: Retrieved - ${weatherCategory}, ${tempCelsius}°C, ${windSpeedKph} kph`);

    return weatherData;

  } catch (error) {
    console.error('Weather API Error:', error);
    return null;
  }
}

/**
 * Get a weather description string for display
 */
export function formatWeatherDescription(weather: WeatherData): string {
  const parts: string[] = [weather.weather];

  if (weather.temp_c !== null) {
    parts.push(`${weather.temp_c}°C`);
  }

  if (weather.wind_speed_kph !== null && weather.wind_speed_kph > 0) {
    parts.push(`${weather.wind_speed_kph} km/h wind`);
  }

  return parts.join(', ');
}
