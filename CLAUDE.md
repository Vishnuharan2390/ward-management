# Ward Management — notes for Claude

## Publishing (standing instruction from the owner)
- The live site is https://callus-madurai.pages.dev/ (Cloudflare Pages, deploys this branch automatically on
  every push) and also https://vishnuharan2390.github.io/ward-management/ (GitHub Pages),
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

## Unit specialties (SPECIALTIES in js/data.js)
- I arthroplasty, II arthroscopy, III tumour, IV spine, V paediatrics (VI is called "Foot & ankle" — UNIT_NAMES, a label only). Each case gets `specs` (specsOf) written
  by its own unit's app (tagSpecs in js/app.js). firestore.rules let a specialty unit read (not write) cases whose
  `specs` contain its specialty, and their images, from every unit (Store.specCases / getImage(id, unit)).
- Tab #/spec ("Arthroplasty cases" etc.): cases in the wards now + weekly (Mon–Sun) report PowerPoint (DeckEngine, noCover).
- Unit VI also has the **Scheme report** tab (#/scheme): every OT list generated (sendScheme in js/app.js) writes
  schemeReports/<unit>_<OT date> (scheme + reason per case); Unit VI reads a Mon–Sun week, PDF via jsPDF autotable.

## Guest demo (temporary — owner will ask to remove it)
- Gate → "Look around as a guest" sets `localStorage wm.guest=1`: forced local mode, own storage prefix `wm.guest.` and
  IndexedDB `ward-images-guest`, seeded with sample patients by js/demo.js. Never touches Firebase.
- Removal steps are at the top of js/demo.js.

## Logo
- The emblem is the Andry tree (assets/andry-tree.svg; title bar + hospital panel via CSS mask). assets/icons/callus-tree.svg = that tree
  in white on navy; the PNG app icons are rendered from it (Playwright screenshot, 192/512/maskable/apple 180).

## Wards
- Ward fields are a dropdown of WARDS (js/data.js) via wardOpts in js/app.js; an old free-typed ward stays selectable.

## Rounds alerts
- Rounds card: "Deranged" panel (derangedList in js/data.js, derangedHTML in js/app.js) + "Repeat X" chips; ⚠ in the patient jump list.
- Positive HBsAg / HCV / HIV → diagnosis gets "(HBsAg+/HCV+/PLHA)" (diagnosisWithViral, kept in sync inside tagSpecs).

## WhatsApp chat → admission day PPT
- Deck page "📎 Add exported WhatsApp chat" (#deck-wa) → Import.readChat (js/app.js) → WaImport.readExport (js/wa-import.js).
  Posts give name/age/sex, IP, ward, mode, diagnosis, phone, address (saved to the case, NOT shown on the PPT page or slides), plan, treatment (Rx: / RX_LINE), written by = sender;
  "Professor:"/"DAOS:" lines that day fill the title slide; consolidation is counted if still empty.

## Clear (×) in text boxes
- js/clear.js marks every text input / textarea (>= 90px wide, not readonly; opt out with data-no-clear) with .has-clr;
  the × is a CSS background in the right padding, shown when .filled; a tap there empties the box and fires input + change.
  Then a "Cleared · Undo" toast (#undo-toast, 6 s) puts the text back — found again by keyOf if the page was redrawn.

## Dictation
- js/voice.js (browser speech recognition, en-IN). Switched on only in the discharge summary: Voice.attach(#dc-form, { inputs: true })
  in Discharge().mount. 🎤 bottom-right of big boxes; inside one-line / short boxes left of the clear × (.mic-in).

## History of injury / illness
- e-case sheet head: textarea data-bind="history" (c.history). The discharge summary H/O injury / illness box starts from it
  unless the discharge draft already has its own text.

## OT notes builder (js/opnote.js, js/opnote-more.js; case page → Operative details)
- Implant list: "From the OT list" (opnOtImplants(c.implants) via OPN_OT_WORDS) → usual for the fracture → others → Custom implant.
  opnDefaults preselects the OT list's implant. "+ Custom implant" button too.
- No screw rows until asked. opnScrewSections(imp) gives each kind its menus: nail = proximal then distal locking; plate/MIPO =
  proximal / distal to the fracture + lag screws; PFN = 8mm lag + 6.4mm anti-rotation (PFNA helical blade) then distal bolts;
  DHS = 12.5mm lag + shaft. Every screw / wire / pin type carries its diameter (OPN_SCREWS).
  Other kinds: free rows. Spine template procedures: rows with type, level(s), side, number, size.
- Wording: opnScrewSay → "2 X 4.9MM LOCKING BOLTS OF SIZE 34MM EACH WERE USED FOR PROXIMAL LOCKING…" (singular when 1).
- The note has NO diagnosis / procedure / implants header (those are the boxes above); "Write OT notes" also fills Implants used.
- Surgeons and assistant surgeons: one box each + "+ Surgeon" / "+ Assistant surgeon" (staffHTML), saved comma-joined in surgeon / assistants.

## Back button + pull to refresh
- js/nav-gestures.js: ‹ #back-btn in the title bar (history.back through in-app pages, sessionStorage wm.navStack; hidden on the
  start page with nothing behind it). Pull down from the top of a page (> 80px) reloads it; not in rounds mode, modals or text boxes.

## Opening on the last ward
- Opening the app (no hash / #/home) sets Home.fromStart; Home then jumps to localStorage wm.lastWard.<unitKey> (#/ward or #/postward,
  saved whenever either is shown). Owners are not jumped (they pick a unit first). First open, or nothing saved: "Which ward?".

## Consent forms: pelvis + Tamil keyboard
- Pelvis / acetabulum cases (consentPelvic in js/consent.js) on the lower-limb form: "கால் எலும்பு" → "இடுப்பு எலும்பு".
- OT list → Consent forms → "Check before printing": "⌨ தமிழ் keyboard" (js/ta-keys.js, TaKeys.attach) types into the name / implant /
  fracture boxes at the cursor; the phone keyboard is held down (inputmode none) while it is open.
- Procedure-specific risk paragraph (CONSENT_EXTRA / consentExtras in js/consent.js), before the closing paragraph, not for implant exit:
  pelvis/acetabulum = abdominopelvic organs, vessels, sciatic nerve; arthroplasty (plan) = limb shortening/lengthening, dislocation,
  loosening, periprosthetic fracture; cervical/dorsolumbar = dural tear CSF leak + cord / root injury (replaces the template one-liner).
  The page shrinks text down to 7pt to stay on one A4 sheet.
- Also CONSENT_MORE (first 2 by CONSENT_MORE_ORDER): tumour recurrence/HPE, open # debridement/flap/amputation, child growth plate,
  hip DVT/PE/pneumonia/bedsore (+AVN for NOF fixation), nail fat embolism/malrotation, ex-fix pin tract, clavicle brachial plexus/
  pneumothorax, upper limb nerves (wrist drop), peroneal nerve (foot drop), compartment syndrome, peri-articular stiffness/arthritis,
  arthroscopy graft failure. Breathlessness is மூச்சுத்திணறல் (never நெஞ்சுத்திணறல்).
- Scheme report PowerPoint (SchemeTab.pptx, pptxgen LAYOUT_WIDE): title → one slide per unit (7 figure tiles + case table, 9 cases, then
  "(contd.)" slides of 13) → last slide CONSOLIDATION — ALL UNITS (same columns as the Word/PDF table, NO SCHEME as a count).

## Report PowerPoints: one design (js/report-deck.js, ReportDeck)
- Navy cover with the tree icon (title, week, professor, unit) → content slides on master "RPT" (navy header band with kicker/title/
  unit chip, footer with department + slide number) → "THANK YOU SIR". Used by every unit's specialty report (specReport in js/app.js,
  title from SPECIALTIES[].report, e.g. Unit II "SPORTS INJURY CLINIC REPORT") and the scheme report.
- Specialty report = the week's cases admitted OR operated (specWeek); per case: History & examination (c.history, mode, comorbid, DOA) ·
  Imaging (custom params named MRI/CT/USG/X-ray… with their latest report) · Diagnosis & plan (+ treatment if not operated), and a
  strip with procedure / implants / DOS if operated; then MRI, CT, pre-op, post-op pictures two per slide.

## Day badges
- dayTag(c) in js/app.js beside every patient name (notebook, detailed, rounds, case list, case sheet): pre-op "D10" = daysSince(DOA),
  post-op "POD 3" = daysSince(surgeryDate || otDate). Blue pill for D, yellow for POD.

## Census (#/census, Census in js/app.js; nav tab "Census")
- Weekly (Mon–Sun) / monthly / yearly, ‹ › to move. Own unit; owners also "All units" (Store.unitsCases reads every unit, column per unit).
- Admissions (DOA), operations (operatedOn), discharges by disposition (discharge.dod), transfers out (c[dept].out), under care at the end,
  average pre-op stay and length of stay; breakdowns by mode of injury, subspecialty, scheme. PDF (jsPDF), PowerPoint (ReportDeck), CSV list.
- Analytics below the census (js/census-more.js, CensusMore.sections → page, PDF, PowerPoint): delay to surgery (+ factors with/
  without), OT efficiency (otDate vs surgery date), surgeon/PG logbook (+ CSV per case), implant usage, antibiogram (pus C/S), outcomes,
  scheme performance, epidemiology, bed use, comorbidity & labs, documentation audit.

## Records (option A) — #/records, "Documents" card on the case sheet
- keepRecord(type, {key, title, cases, args, live}) in js/app.js at every generator: discharge, dcimages, dcppt, otlist (recOt: print /
  WhatsApp / bot / email), consents, otxray, admdeck, postopdeck, ward, pending; reports with live:true (scheme, census, logbook, spec).
- Store.addRecord → units/<unit>/records/<type>_<date>_<key> (same doc made again that day replaces it); args = JSON of the frozen
  inputs (case objects as they were, settings); >850 KB → tooBig, not kept. Store.records(from,to,units) / caseRecords(caseId).
- REBUILD[type](args) replays the same generator (rebuilding=true stops a second record). Pictures come from the frozen image ids.
  Existing rules (units/{unit}/{coll}) already cover records — no rules change.
- Photos: compressImage default 1280 px, JPEG 75% (was 1600 / 80%).
