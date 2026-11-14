# Handover: Habit Cascade Tree ("System" page)

Written so another assistant (or a human) can pick this up cold.
READ `.claude/CLAUDE.md` FIRST: the owner's rule is ONE SOURCE OF TRUTH.

## Goal
A page that shows the user's habits as a cascading tree: foundations at the bottom,
habits linked to what helps them, consequences (e.g. "Better memory") on top.

## Project facts
- React 19 + Vite 7 + Firebase (Auth, Firestore), react-router-dom 7. Inline styles + CSS variables in `src/index.css`.
- Repo: github.com/Athens556/life-tracker. Live: https://life-tracker-bc437.web.app/
- `npm run emulators` + `npm run dev` (localhost uses emulators), `npm test`, `npm run lint`, `npm run build`, `firebase deploy` (manual).
- Firestore rules are generic (`userId == auth.uid` on every doc; query by `userId`; reading a missing doc id is denied).

## Design (current, v2)
- The System page (`/system`) is a pure VIEW over the `habits` collection. It has no collection of its own and no add/delete form. Habits are added and deleted only on the Habits page.
- Fields on a `habits` doc used by the tree:
  - `text` (name), `completedDates: ['YYYY-MM-DD']` (check-ins, shared with the Habits page)
  - `labels`: tag `foundation` = root, tag `consequence` = consequence, neither = habit (`roleOf` / `labelsForRole` in cascade.js)
  - `helpedBy: [habitDocId]` = "which habits help this"
  - `perWeek: 1..7` cadence (default 7)
  - `systemKey: 'sleep'|'exercise'|'diet'` only on the seeded defaults (used for left-to-right order)
- Defaults: `ensureDefaultHabits(uid)` in `src/lib/defaultHabits.js` runs on login (called in `App.jsx`). It creates Sleep (numeric, 8 hours), Exercise (numeric, 20 minutes) and Diet (negative) as normal habits (folder "Foundations", tag `foundation`, ids `${uid}_default_<key>`) once per user. Types come from `ROOTS` in cascade.js. Flag doc `userFlags/{uid}` holds `defaultHabitsSeeded` (a deleted default stays deleted) and `defaultHabitsVersion` (bump `DEFAULTS_VERSION` to push a type change to existing users; history is kept).
- The System page writes only to habit docs: toggle a day in `completedDates`, toggle `helpedBy`, set `perWeek`, switch the role tag.
- Formula (`src/lib/cascade.js`, pure, tested):
  - Repeats banked `c`: +1 per logged day; each un-logged day releases 0.5 (same recurrence as resistance.js; a test proves equality for daily habits).
  - Cadence N/week gives `(7-N)/N` free gap days per log.
  - `strength = 1 - exp(-c/tau)`, `tau = horizon/ln(50)` (complement of the resistance.js fade).
  - Cascade (assumption, not from papers): `support` = mean strength of helpers; `horizon = fadeDays * (1 - 0.5*support)`. Constant `CASCADE_BOOST`.
  - Consequence level = mean strength of its linked habits.
  - `routine` >= 0.75, `locked in` >= 0.95, `slipping` = 2+ days overdue; downstream of slipping = `at risk`.
  - `fadeDays` = Resistance page setting (default 40).
- View: `src/components/CascadeTree.jsx` (HTML nodes over SVG edges), `src/components/System.jsx` (page).

## Cravings / Resistance side (separate from the System page)
- Every NEGATIVE habit (`goalType: 'negative'`) has a craving counter. `src/components/NegativeHabits.jsx` is a table of the negative habits with today's count and a "Craving resisted" button; it replaced the central craving button on the dashboard (`Dashboard` in `App.jsx`).
- `src/lib/cravings.js` `logCraving(uid, habit?)` is the ONLY place a craving is written. It writes the same two docs as before (`cravings` + `resistanceEntries` cat N, label/act `craving`) plus `habitId` (id only, no copied name).
- `CravingButton.jsx` now calls `logCraving(uid)`; it is still used on the Resistance page for a craving not tied to a habit.
- `Resistance.jsx`, `resistance.js` and `resistance.test.js` were NOT changed. Do not change the `craving` label/act: Resistance.jsx collapses rows by `act === 'craving'` and scoring caps it once per day.
- Numeric defaults cannot be ticked from the System page; the number is logged on the Habits page.

## Pipeline
1. [x] Engine + tests (`cascade.js`, `cascade.test.js`)
2. [x] Tree view + System page, route and nav link
3. [x] v2 refactor: derive everything from `habits`, role as tag, default habits seeded on login
4. [x] Habits page switched to `localDayKey()` so both pages agree on "today"
5. [x] `npm test` 37/37, `npm run build` OK, changed files lint clean
5b. [x] Defaults retyped (Sleep/Exercise numeric, Diet negative) + per-negative-habit craving table replacing the central button
6. [x] Owner tested on the emulator (2026-11-14): "looks good"
7. [x] Committed on `master` (see `git log`)
7b. [x] Pushed by the owner (2026-11-14).
7c. [ ] Auto-deploy: `.github/workflows/firebase-hosting-merge.yml` now deploys Hosting on every push to `master` (runs `npm test` and `npm run build` first). It needs the `VITE_FIREBASE_*` values as GitHub repository secrets; a guard step fails the run if any is missing, so a site without config is never deployed. Owner still has to add the secrets, then commit and push the workflow. Firestore rules are NOT deployed by the action (`firebase deploy --only firestore:rules` when they change).
8. [ ] Optional: "Role" dropdown in the Habits create form (today the role is set by typing the tag or from the System page)
9. [ ] Optional: hide the checkbox/calendar for `consequence` habits on the Habits page
10. [ ] Optional: Analysis.jsx / Timeline.jsx still use their own date logic; move to `localDayKey()`

## Known limits
- Not yet run against real Firestore or the emulator; only with stubbed sample data in a browser.
- A link that skips a row can pass behind a node in between; tapping a node highlights its links.
- `npm run lint` reports 4 older errors in `Timeline.jsx` and `lib/gemini.js` (unused vars).
- v1 used a `systemNodes` collection. It is no longer read or written; any docs there are orphaned and can be deleted in the Firebase console.

## History
- 2026-11-14 (v1): tree built with its own `systemNodes` collection and hardcoded roots.
- 2026-11-14 (v2): owner rejected two sources of truth. Refactored so the tree derives from `habits`; roles are tags; Sleep/Exercise/Diet are seeded default habits; `.claude/CLAUDE.md` added with the rule. Nothing committed or deployed.
- 2026-11-14 (local auth): Auth emulator Google sign-in now uses a full-page redirect because its popup relay reported "No matching frame". The Auth emulator URL uses `localhost:9099` to match the Vite app host; mixing `localhost` and `127.0.0.1` makes redirect sign-in return without a user. Production sign-in still uses the popup. The owner should retry local sign-in and confirm the default habits appear.
- 2026-11-14 (cravings): defaults retyped via `ROOTS` + `DEFAULTS_VERSION = 2` (existing defaults are upgraded on next login). Added `lib/cravings.js` and `NegativeHabits.jsx`; dashboard shows the negative-habit table instead of the central craving button. Exercise target of 20 minutes is a placeholder chosen by the assistant; owner to confirm. Verified on the files as they are on disk (including the other assistant's auth changes): tests 37/37, build OK. Not yet clicked through against the emulator.
- 2026-11-14 (listener fix): owner hit `FIRESTORE (12.8.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9) {"ve":-1}` when going System -> Habits on the emulator. This is a known intermittent firebase-js-sdk issue (github.com/firebase/firebase-js-sdk/issues/9267), root cause not confirmed. Three components each attached their own listener to the same `habits` query and tore it down on every tab change (twice under StrictMode). Now there is ONE listener: `components/HabitsProvider.jsx` + `lib/habitsContext.js` (`useHabits()`); Habits, System and NegativeHabits read from it. If the assertion still appears after a hard refresh, next things to try: restart the emulators, then remove `<StrictMode>` in `main.jsx` for local dev, then pin firebase to a version before the regression reported in issue 9414.
- 2026-11-14 (REAL cause of the ca9 crash): the console showed `permission-denied ... evaluation error at L14:38 for 'get' ... Null value error` right before the assertion. `Resistance.jsx` listened to `doc(db,'resistanceSettings',uid)`; on a fresh emulator that doc does not exist, the rules evaluate `resource.data` on null and reject the listener, and tearing that rejected listener down on tab change trips the SDK assertion. After that the Firestore client is dead until reload, so every later page (Habits, System) reports the same error. Fixed by reading the setting with a `where('userId','==',uid)` query (same as System.jsx). The single-listener change above is kept but was NOT the cause. Rule for the future: never `onSnapshot(doc(...))`/`getDoc` a doc that may not exist under the generic rule. `firestore.rules` untouched.
- 2026-11-14 (per-habit resistance, owner request): each negative habit now has four buttons (Craving resisted / Pushed past the no / Cut the cascade / Came back same day) in `NegativeHabits.jsx`, shown on the dashboard and embedded in the Resistance page's cravings card. Taps write through `lib/cravings.js` `logHabitResistance(uid, cat, habit)`; labels come from `lib/habitActs.js` (e.g. `Diet craving`), so each habit scores as its OWN act in the index instead of the anonymous `craving`. `resistance.js` (the engine) is unchanged. `Resistance.jsx` changes: today's list collapses button taps into one row per act; habit acts are hidden from the free-text chips; the generic craving button stays as \"a craving that belongs to no habit\". Old anonymous `craving` entries are untouched. Not committed.
- 2026-11-14 (CI secrets): owner stored the `VITE_FIREBASE_*` values as ENVIRONMENT secrets in a GitHub environment named `env1`, so the deploy job now declares `environment: env1`. Without that line the secrets are empty and the guard step fails.

## Folder types (owner request 2026-11-14) - BUILT, awaiting owner test + commit
Folders were cosmetic (`habits.category` string). Now a folder has a TYPE:
- `mandatory` (default): every habit in it counts on its own.
- `complementary`: OR. The folder is done on a day if ANY one habit in it is done (e.g. folder "Study" = Maths OR Physics).
Owner's decisions: on the System tree a complementary folder is ONE node (members hidden); on the Timeline the Sleep habit becomes a normal draggable block (no separate sleep setup); block length comes from habit data and is editable; build in two stages.

Design (one source of truth):
- Folder attributes live in ONE place: collection `habitFolders`, doc id `${uid}__${encodeURIComponent(name)}`, `{ userId, name, type, helpedBy?, perWeek? }`. No doc = mandatory. Writer: `saveFolder` in `src/lib/folderStore.js`. Live read: `useFolders()` (Map name -> doc) from the same `HabitsProvider`.
- `src/lib/folders.js` (pure, tested): `habitUnits(habits, folders)` returns the UNITS every page must count: one per habit, or one per complementary folder (`id: 'folder:<name>'`, `completedDates` = union of members). `unitDoneOn`, `folderTypeOf`, `unitIdByHabit`.
- Rule: Analysis, System and Timeline iterate `habitUnits(...)`, never raw habits, when counting or drawing.

Stage 1 DONE (tests 44/44, build OK, pages rendered with stubbed data; not committed): [x] folders lib + tests, [x] provider/context, [x] Habits create form "Folder type" + badge on folder header (click to switch), [x] Analysis counts units (and now uses the shared listener + local dates), [x] System draws units (folder node: links and cadence saved on the folder doc; ticking happens on the Habits page).

Stage 2 (Timeline overhaul) - DONE (tests 51/51, build OK, page rendered with stubbed data incl. an old-format profile; not run on the emulator; not committed). Built as specified below, in `src/components/Timeline.jsx` (rewritten) + `src/lib/timeline.js` (pure, tested). Extras: a "Place" button with a time input next to drag-and-drop (drag does not work on touch screens); a "Scheduled" list where start time and length are edited; negative habits and consequences are not offered for placing; an old-format profile is converted on screen and rewritten only when the owner presses Save. Spec:
- `Timeline.jsx`: drop its own `habits` listener; use `useHabits()` + `useFolders()` + `habitUnits`.
- Sidebar lists UNITS: a complementary folder is one draggable item, not its member habits.
- Remove sleep start/end from the setup form and from the fixed blocks. The Sleep habit is dragged like any unit; a block that passes midnight is split in two (reuse the existing split logic).
- Block length: new pure helper `unitMinutes(unit)`: parse `timeRequired` properly ("5 min", "15 min", "30 min", "1 hour" = 60, "2+ hours" = 120; today "1 hour" is read as 1 minute), else a numeric habit's `target` when `unit` is hours/minutes (Sleep = 8 h = 480), else 30 (not 15). Folder = longest member. Length is editable on the block.
- `timelineProfiles.scheduledHabits` entries become `{ unitId, startTime, duration }`; derive the name from the unit (do not store `habitName`). Read old entries (`habitId`) as `unitId`.
- Migration: if the old profile has `sleepStart`/`sleepEnd` and Sleep is not scheduled, pre-place a Sleep block there.
- Free time = 1440 - work - commute - routine - misc - scheduled blocks.
- 2026-11-14 (folder type lock, owner request): in the create form the folder-type select is only editable for a NEW folder name; for an existing folder it shows the stored type, disabled, and adding a habit never changes it. The badge on the folder header is still the one deliberate way to switch an existing folder.
