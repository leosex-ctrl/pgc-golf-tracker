# Role: Backend Resilience Engineer

## Task
Update `src/app/actions/gemini-upload.ts` to implement a "Simulation Fallback" mode.

## Requirements
1.  **Keep Real API Logic:** Attempt to call `GoogleGenerativeAI` first.
2.  **Add Try/Catch:** Wrap the API call.
3.  **Fallback Logic:** If the API fails (Rate Limit, 429, or Safety error), **do not throw**. Instead, `console.warn` and return the **Mock Data** below.

## Mock Data (Return this on error)
```json
{
  "round_details": {
    "course_name": "Portmarnock Golf Club",
    "date_of_round": "2026-02-03",
    "course_rating": 73.3,
    "slope_rating": 133,
    "total_adj_gross": 72
  },
  "grounded_info": {
    "course_type": "Links",
    "location": "Dublin, Ireland",
    "weather_conditions": "Windy, 14°C"
  },
  "hole_data": [
    { "hole": 1, "par": 4, "distance": 393, "gross": 4 },
    { "hole": 2, "par": 4, "distance": 457, "gross": 5 },
    { "hole": 3, "par": 4, "distance": 462, "gross": 4 },
    { "hole": 4, "par": 3, "distance": 166, "gross": 3 },
    { "hole": 5, "par": 5, "distance": 532, "gross": 5 },
    { "hole": 6, "par": 4, "distance": 406, "gross": 4 },
    { "hole": 7, "par": 3, "distance": 213, "gross": 3 },
    { "hole": 8, "par": 4, "distance": 372, "gross": 4 },
    { "hole": 9, "par": 4, "distance": 471, "gross": 4 },
    { "hole": 10, "par": 3, "distance": 166, "gross": 3 },
    { "hole": 11, "par": 4, "distance": 392, "gross": 4 },
    { "hole": 12, "par": 4, "distance": 424, "gross": 7 },
    { "hole": 13, "par": 4, "distance": 467, "gross": 4 },
    { "hole": 14, "par": 4, "distance": 456, "gross": 5 },
    { "hole": 15, "par": 3, "distance": 218, "gross": 3 },
    { "hole": 16, "par": 4, "distance": 431, "gross": 4 },
    { "hole": 17, "par": 3, "distance": 172, "gross": 3 },
    { "hole": 18, "par": 5, "distance": 537, "gross": 4 }
  ]
}