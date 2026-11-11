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
