# Role: Frontend Developer (React/Tailwind/Next.js)

## Goal
Implement the full "AI-Powered Round Entry" UI.
This involves three components: a Scorecard Uploader, a Smart Entry Form (that accepts AI data), and the main Page to manage the flow.

## Task 1: Create `src/components/ScorecardUploader.tsx`
**Context:** A glassmorphism dropzone that sends the image to our server action.
**Requirements:**
1.  **UI:**
    * Container: `border-2 border-dashed border-[#C9A227] bg-[#1B4D3E]/20 backdrop-blur-sm rounded-lg p-12`.
    * Content: Gold upload icon, text "Click or Drag to Upload Scorecard".
    * Loading State: Show a pulsing spinner with text "Analyzing with Gemini AI...".
2.  **Logic:**
    * Accept props: `onDataExtracted(data: any)` and `isLoading(boolean)`.
    * On file select, call `uploadScorecard(formData)`.
    * If successful, call `onDataExtracted` with the result.
    * If error, show a red error message.

## Task 2: Create `src/components/RoundEntryForm.tsx`
**Context:** The manual entry grid that gets pre-filled by the AI data.
**Requirements:**
1.  **Props:** `initialData` (The JSON object from Gemini, optional).
2.  **State:**
    * `formData`: Object containing `course_name`, `date`, `weather`, and an array of 18 `holes`.
    * Initialize state with `initialData` if present, otherwise default to empty values.
3.  **UI Layout (Clubhouse Theme):**
    * **Header:** 3-column layout for Date, Course Name, Weather. Inputs with transparent bg and Gold bottom border.
    * **The Grid:** Render 18 rows (or a grid).
        * Columns: Hole #, Par, Distance, Score.
        * **Smart Coloring:** If `score < par`, text is Blue. If `score > par`, text is Red. Else White.
    * **Footer:** Show "Total Score" and "Total Par" (calculated live).
    * **Action:** A "Save Round" button (Gold bg, dark text) that `console.log(formData)` for now.

## Task 3: Update `src/app/dashboard/add-round/page.tsx`
**Context:** The controller page.
**Requirements:**
1.  **State:** `view` ('upload' | 'form'), `extractedData` (null | object).
2.  **Flow:**
    * Default: Show `<ScorecardUploader />`.
    * On Success: Store data in `extractedData`, switch `view` to 'form'.
    * Form View: Show `<RoundEntryForm initialData={extractedData} />`.
    * Add a small "Back to Upload" button in the form view.
3.  **Layout:** Wrap in standard dashboard container. Title: "Add New Round".

## Immediate Action
Write the code for all three files (`ScorecardUploader.tsx`, `RoundEntryForm.tsx`, `page.tsx`) ensuring they import each other correctly.