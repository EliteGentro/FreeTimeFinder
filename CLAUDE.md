# CLAUDE.md

Guidance for working in this repository. Keep it short, keep it current.

## What this app is

**Free Time Finder** — a client-only React app that overlaps multiple class
schedules (parsed from Iris/Mitec PDFs) and shows when everyone is free.
Everything runs in the browser; there is no backend and no data leaves the device.

## Commands

```bash
npm install      # install dependencies
npm run dev      # start dev server (http://localhost:5173)
npm run build    # production build to dist/
npm run preview  # preview the production build
npm run lint     # eslint
npm test         # run vitest once
npm run test:watch
```

## Tech stack

- React 19 + Vite 7
- Tailwind CSS v4 (via `@tailwindcss/vite`; config lives in `src/index.css`)
- `pdfjs-dist` for PDF text extraction
- `lucide-react` for icons
- Vitest for unit tests

## Project layout

```
src/
  App.jsx                  Top-level UI + state (owners, loading, modals, demo)
  components/
    Calendar.jsx           Week grid: shared/heat-map modes, owner filters, tooltips
    FileUpload.jsx         Styled file picker
    Footer.jsx
    LoadingSpinner.jsx
    Walkthrough.jsx        In-site step-by-step guide overlay
  hooks/
    useSchedulePeriods.js  Derives periods + slot data from owners
  utils/
    pdfUtils.js            extractTextFromPDF (pdfjs)
    pdfConverter.js        Format detection + Iris/Mitec text parsers
    scheduleHelpers.js     Period building + free-time/slot computation
    dateUtils.js           Date/time parsing + formatting
    icsExport.js           .ics calendar export
    snapshotUtils.js       JSON snapshot export/import
    mockData.js            Demo schedules for the "Try a demo" preview
    __tests__/schedule.test.js
```

## Core data model

```js
ScheduleEntry = { name, days, startTime, endTime, startDate, endDate, type }
//   days:      ["Mon","Tue",...]  (English 3-letter, see dateUtils.dayMap)
//   startTime/endTime: "HH:MM"
//   startDate/endDate: "dd.mm.yyyy"
//   type:      "course" | "week"

Owner = { id, name, entries: ScheduleEntry[], format, fileName }
```

Data flows: PDF → `extractTextFromPDF` → `detectScheduleFormat` →
`extractScheduleEntries*` → `Owner` → `useSchedulePeriods` →
`createPeriods` + `computePeriodSlotData` → `Calendar`.

Free time is computed on a fixed 30-minute grid from 07:00–21:00, Mon–Fri
(constants in `scheduleHelpers.js`).

## Conventions

- Plain JS (`.jsx`/`.js`), no TypeScript.
- Functional components + hooks; keep parsing/computation logic in `utils/`,
  keep `App.jsx` focused on state and layout.
- Styling is Tailwind utility classes inline. Support dark mode by always
  pairing light classes with `dark:` variants.
- Keep the layout responsive: stack/wrap on small screens, use `sm:`/`md:`
  breakpoints, and keep the calendar grid inside an `overflow-x-auto` wrapper.

## When changing things

- **New PDF source format:** add a parser in `pdfConverter.js`, branch it in
  `detectScheduleFormat`, and wire it into `parsePdfFile` in `App.jsx`.
- **Changing the entry/owner shape:** update `mockData.js`, the snapshot schema
  in `snapshotUtils.js` (bump `SCHEMA_VERSION`), and the tests.
- **Demo preview:** edit `src/utils/mockData.js`. Entries must use the real
  `ScheduleEntry` shape (dates in `dd.mm.yyyy`) so they flow through the same
  pipeline as uploaded PDFs.
- Always run `npm test` and `npm run build` before considering a change done.

## Tests

`src/utils/__tests__/schedule.test.js` covers the parsers, period/slot
computation, date utilities, and ICS export using fixtures shaped like the real
PDF text. Add cases there when touching any `utils/` logic.
