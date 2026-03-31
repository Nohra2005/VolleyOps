# VolleyOps Dashboard

Welcome to the **VolleyOps** development repository. This project is a specialized management dashboard designed for volleyball facilities, featuring a high-precision, custom-built scheduling engine.

---

## Prerequisites

Before setting up the environment, ensure you have the following installed:
* **Node.js** (v18.0.0 or higher)
* **npm** or **yarn**
* A code editor (VS Code recommended with ESLint enabled)

---

## Getting Started

Follow these steps to get the project running on your local machine:

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd volleyops
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Launch the development server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`. Navigate to the scheduling route if applicable.

---

## Project Structure

The core logic is located within the `src/features` directory.
* `Scheduling.jsx`: The main scheduling engine handling week/month logic, UI synchronization, and event state.
* `Scheduling.css`: Precise grid styling. **Do not modify grid math without consulting the architectural constraints below.**

---

## ⚠️ Architectural Constraints & Grid Math

The scheduler uses a custom-built grid system to achieve a specific high-end SaaS aesthetic (Figma-aligned). To maintain visual integrity, you **MUST** follow these strict rules:

### 1. Grid Geometry
Each hour block is mathematically locked to exactly **100px** in height. This is defined in both `Scheduling.jsx` (`ROW_HEIGHT = 100`) and `Scheduling.css` (`.grid-cell`, `.time-slot-label`). 
* **Rule:** If you change one, you must change the other. Do not use margins to force alignment.

### 2. Time Label Alignment
Time labels (8 AM, 9 AM, etc.) are designed to sit **just below** the horizontal grid lines.
* **Rule:** This is achieved using `align-items: flex-start` combined with a specific `padding-top` (e.g., `8px`). **Do not center the text on the lines.**

### 3. Court Isolation
The schedule is filtered by the `selectedCourt` state. 
* **Rule:** Each court (Court 1, Court 2, Main Hall) maintains its own independent schedule. Ensure any new event creation or rendering logic respects this isolation.

---

## ⚠️ Coding Standards & ESLint

We follow strict ESLint rules to ensure performance and avoid infinite loops or unpredictable rendering.

### 1. State Synchronization (No Cascading Renders)
The Sidebar Mini-Calendar (month view) and Main Calendar (week view) must stay in perfect sync.
* **Rule:** **DO NOT use `useEffect`** to watch `selectedDate` and update `currentMiniMonth`. This causes cascading renders and violates our linting rules. 
* **Solution:** Update both pieces of state atomically inside the navigation handler functions (e.g., `handleNextWeek`, `handlePrevWeek`, `handleMiniDateClick`).

### 2. Pure Functions (No Impure Data in Render)
* **Rule:** Avoid calling impure functions like `Date.now()` during the render phase or directly inside handlers if it violates local strict purity linting. 
* **Solution:** For ID generation when creating a new booking, use a pure calculation based on the existing state. Example:
  ```javascript
  // Correct ID generation
  const newId = events.length > 0 ? Math.max(...events.map(ev => ev.id)) + 1 : 1;
  ```

---

## Available Scripts

* `npm run dev`: Runs the app in development mode.
* `npm run build`: Builds the app for production.
* `npm run lint`: Checks the code for style and purity violations. Please run this before opening a PR.