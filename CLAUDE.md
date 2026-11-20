# Ward Management — notes for Claude

## Publishing (standing instruction from the owner)
- The live site (https://vishnuharan2390.github.io/ward-management/) is GitHub Pages,
  built from the branch `claude/preop-case-management-eafzbl`. Work on any other
  branch is NOT live until it is on that branch.
- The owner has said: **publish without asking.** When a change is finished and
  tested, push it to the session's branch and also fast-forward
  `claude/preop-case-management-eafzbl` to it (`git push origin HEAD:claude/preop-case-management-eafzbl`),
  then check the "pages build and deployment" run. Never force-push it; if it
  can't fast-forward, rebase onto it first.

## Releasing
- Every release: `python3 tools/release.py <next number> "<d Mon>"` — bumps the
  title-bar label, every `?v=` and the service-worker cache name in `sw.js`.
- New JS files: add a `<script>` to index.html and the path to `SHELL` in sw.js.
- Phones pick up a release through the ⟳ Reload button / "New version is ready" bar
  (js/update.js), which compares the live index.html version with the running one.

## Testing
- `config.js` has Firebase on (Google sign-in). For headless tests, serve the repo
  (`python3 -m http.server`) and route `config.js` to `firebase: null` (local mode).
- Test phone behaviour with Playwright's `devices['iPhone 13']`.

## Units (6 in the department)
- Each unit's data lives at `units/ortho-unit-N` (N = position in `UNITS`, js/data.js; Unit I = ortho-unit-1,
  the original data). Everyone is on exactly one unit's team; the app finds it at sign-in (js/store.js chooseUnit).
- Owners (`ownerEmails` in config.js + `owners()` in firestore.rules) open every unit (Settings → Unit) and make
  unit admins. A unit admin manages only that unit's team. `people/{email}` = department directory, one unit each.
- `Store.meta.unitId` is forced to the signed-in unit, so every print/PDF names the right unit.
- firestore.rules changes must be published by the owner (Firebase console → Firestore → Rules). Test them
  against the emulator (firebase-tools + @firebase/rules-unit-testing) before telling the owner to publish.

## Views by role (team list role → viewOfRole in js/data.js)
- House Surgeon → `Todo` (all open items, same rows/handlers as rounds' "From earlier rounds") + e-case sheets (#/cases).
- Assistant Professor / Professor → `Folders` + read-only `ConsultCase` (#/c/<id>); every other route resolves to Folders.
- Everyone else (and owners) → the whole app + "HS updates" (#/updates), fed by the unit's `updates` collection
  (logUpdate in js/app.js; kept 7 days). Owners / unit admins can preview a view: Settings → Views (sessionStorage).
- This is a view, not a security boundary: firestore.rules still let any unit member read/write the unit.
