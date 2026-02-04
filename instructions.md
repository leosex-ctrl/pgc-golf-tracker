# Role: UI/UX Data Specialist

## Context
We have installed `recharts`. We need two specific chart components that adhere strictly to the "Clubhouse" theme.
Theme: Dark Green (#1B4D3E) background, Gold (#C9A227) lines/bars, White text.

## Task 1: Create src/components/DashboardCharts.tsx
Please export two separate components in this file:

### 1. Component: ScoreTrendChart
* **Purpose:** Show score progression over time (Form Guide).
* **Props:** `{ data: { date: string; score: number }[] }`
* **Visuals:**
    * Use `<ResponsiveContainer width="100%" height={300}>`.
    * Use `<LineChart data={data}>`.
    * **Line:** Gold (`#C9A227`), stroke width 3, monotonic curve.
    * **Dots:** Solid Gold, radius 4.
    * **Grid:** Faint white opacity (`stroke="rgba(255,255,255,0.1)"`).
    * **X-Axis:** `dataKey="date"` (White text).
    * **Y-Axis:** `dataKey="score"` (White text).
    * **Tooltip:** Custom style (Dark Green bg, Gold border).

### 2. Component: CoursePerformanceChart
* **Purpose:** Average score per course (Venue Analysis).
* **Props:** `{ data: { courseName: string; avgScore: number }[] }`
* **Visuals:**
    * Use `<ResponsiveContainer width="100%" height={300}>`.
    * Use `<BarChart data={data}>`.
    * **Bars:** Gold (`#C9A227`), radius `[4, 4, 0, 0]`.
    * **X-Axis:** `dataKey="courseName"` (White text).
    * **Y-Axis:** `dataKey="avgScore"` (White text).
    * **Tooltip:** Standard custom style.

## Task 2: Integrate Trend Chart into Dashboard
**File:** `src/app/dashboard/page.tsx`
1.  Import `ScoreTrendChart` from `src/components/DashboardCharts`.
2.  **Data Prep:** Map `rounds` state to `{ date: string, score: number }`. Reverse if needed so it reads Oldest -> Newest.
3.  **UI:** Insert `<ScoreTrendChart />` in a glass card **above** the "Recent Activity" table. Title: "Current Form (Last 10 Rounds)".

## Task 3: Integrate Venue Chart into Stats
**File:** `src/app/dashboard/stats/page.tsx`
1.  Import `CoursePerformanceChart`.
2.  **Data Logic:** Group rounds by `course.name` and calculate average `total_strokes`. Format: `[{ courseName: '...', avgScore: 74 }, ...]`.
3.  **UI:** Insert `<CoursePerformanceChart />` at the top of the page in a full-width glass card. Title: "Performance by Venue".

## Immediate Action
Execute this plan. Create the component file first, then update the two page files.