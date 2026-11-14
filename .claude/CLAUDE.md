# vibe-tracker: rules for any AI working in this repo

## 1. ONE SOURCE OF TRUTH (owner's standing rule)
- A habit exists in exactly one place: the `habits` Firestore collection.
- Every other page (System tree, Analysis, Timeline, anything new) is a VIEW that derives from `habits`. Never create a second collection or local copy that stores habit names, check-ins, links or roles.
- One way to add or delete a habit: the Habits page. Other pages may edit fields on the habit doc, never own data about it.
- New attributes go on the habit doc as a field or a tag in `labels`. Example: the System role is the tag `foundation` or `consequence` in `habits.labels` (no tag = ordinary habit).
- One definition per constant or formula. Defaults live in `ROOTS` (src/lib/cascade.js); the fade formula lives in src/lib/resistance.js. Import, do not copy.
- Day keys are local dates from `localDayKey()` in resistance.js. Never `toISOString()` for a day.
- One live listener on `habits`: `HabitsProvider` (mounted in App.jsx). Pages read it with `useHabits()` from src/lib/habitsContext.js. Never add another `onSnapshot` on `habits`.
- One writer for cravings: `logCraving` in src/lib/cravings.js.
- Think in OOP terms: Sleep, Exercise and Diet are Habits with a role, not a separate type.

## 2. Firestore
- Rules are generic: every doc needs `userId == auth.uid`. Always query with `where('userId','==',uid)`.
- Reading a doc id that does not exist is denied. Use queries, not `getDoc` on maybe-missing docs.

## 3. Working agreement
- Do not `git commit` or `firebase deploy` unless the owner asks.
- Keep `HANDOVER.md` current when a feature lands: it is how work is handed to another assistant.
- Run `npm test` and `npm run build` before saying something works.
