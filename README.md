# Pre-op Ward — Ortho Unit

A shared digital ward notebook for the pre-operative ward: case work-up
tracking, pending works for the team, imaging uploads, one-tap OT list PDF
and auto-filled discharge summaries. Runs in any browser (phone or desktop),
no install, no build step.

## What it does

| Screen | Use |
| --- | --- |
| **Cases** | Every active patient as a card: ward, diagnosis, plan, a progress bar, out-of-range values in red bold and red chips for what's pending. |
| **New case** | Patient details, mode, treatment given, case sheet written by, radiographs and wound pictures (uploaded once, reused everywhere), diagnosis, plan, level (auto-filled from the level database) and scheme status (Approved / Validation / To be submitted / Denied / No scheme), implants auto-filled from the implant database, and the first set of investigations with one date for the whole set. |
| **Investigations** | The unit's standard parameters and ranges: CBC (Hb, WBC, PLT), RFT (RBS, urea, creatinine, Na, K), LFT (T/D/I bilirubin, SGOT, SGPT, ALP), ESR, qCRP, VM (HBsAg, HCV: positive/negative) and VCTC (HIV: reactive/non-reactive). Values outside the range show in **red bold** with ↑/↓. Add any other investigation with its own normal range and units. **Repeat investigations** adds a dated set; the flowsheet shows every date side by side. Pus C/S takes the organism (in italics) and the antibiotics it is sensitive to. Counts can be typed as said: PLT 2.4 = 2,40,000, WBC 8.4 = 8,400. |
| **Monitoring charts** | On the case page, for patients followed with repeated values: **RFT chart** (urea, creatinine, Na, K, urine output — also shows RFTs entered under Investigations), **Diabetic chart** (FBS, PPBS, RBS, insulin morning / afternoon / night, insulin type), **ESR / CRP chart** for wounds and infection (ESR, qCRP, WBC, wound status), or a **custom chart** with your own columns, units and normal ranges (INR, Hb, vitals…). Entries take a date and optional time; abnormal values are red; the newest values count as the patient's latest results. Suggested automatically from the comorbidities, diagnosis or plan (DM, CKD, wound / compound fracture / infection). Each chart prints on its own. |
| **Pending** | Any empty investigation except ESR, qCRP and pus C/S is pending, as is any empty work-up item (ECG, ECHO & cardio opinion, X-ray, CT, MRI, PAC) or opinion without advice. Type "NA" in a work-up item that isn't needed. |
| **Ward** | The ward notebook: S.No · Name · Diagnosis · To do's · Assessment/Scheme, with **BOT** on posted cases. To do's compile themselves and lead with abnormal values in red. *Detailed* shows every value. Print / PDF for rounds. |
| **OT list** | Two pages. **Pick cases** (tap **Hide** to keep a case out of the picker; hidden cases sit under “Hidden from OT list” with **Add back**, and the case page has the same switch): name, age/sex, diagnosis, plan, date of admission and a **Radiographs** link that opens every X-ray, CT and MRI of the patient in one viewer (→ / swipe to step through). **Details**: date, day, unit, chief (dropdown) and signing Assistant Professor (dropdown); reorder and confirm ward / level / implants / scheme. Two buttons: **Generate OT list PDF** (one list, the unit's format) and **Generate OT list print PDF** (the same list twice on one landscape sheet, top and bottom, shrunk to fit, to print and cut). |
| **Admission day PPT** | The admission-day PowerPoint, built from the cases already in the app — no second upload. Pick the date: that day's admissions come in (**+ Add new case** adds one with that admission date) with their details (mode, diagnosis, treatment, case sheet written by, status) and their radiographs and wound pictures (side by side per type, or separate slides; untick any picture to leave it out). Professor and DAOS come from the unit staff list; **Count from cases** fills the consolidation. Live slide preview; **Download PowerPoint** gives the same 16:9 deck as the unit's admission-deck tool (its slide engine is reused unchanged). |
| **Discharge / transfer** | The unit's discharge format: letterhead and patient box on every page, CAPS underlined sections, templates, auto-written course in hospital, advice phrases with Tamil lines, review-date generator. Dispositions: Discharge, Discharge at request, Transfer to post-op ward, AMA, Absconded. **Treatment given** starts with the all-case drugs and has buttons for the spine / pelvis set (suggested automatically) and each antibiotic. Three outputs: the **discharge summary PDF**, a **radiographs PDF** (pre-op X-ray, post-op X-ray, post-op wound pic — one page each) and a **discharge PowerPoint** (summary slide, pre-op wound pic for compound fractures, pre-op and post-op X-ray). Post-op pictures can be uploaded right on this page. |
| **Settings** | Unit, OPD number, letterhead; the **implant database** (procedure → implants); the **level of surgery database** pre-filled from the Weighted Orthopaedic Procedure List (level, category, procedure, match words — the plan's highest-level match sets the case level); **unit staff** (chief and Assistant Professors per unit, editable); team and backup. |

PDFs use the browser's print dialog — choose **Save as PDF** as the printer.
Unit, OPD number and letterhead image are set under Settings.

## Install on iPhone / Android (home-screen app)

The app installs like a native app from its web address — own icon, full
screen, works offline, updates itself.

1. Host it (once): GitHub repo → **Settings → Pages** → Source **Deploy from
   a branch** → branch `claude/preop-case-management-eafzbl`, folder `/ (root)`
   → **Save**. After a minute it is live at
   `https://vishnuharan2390.github.io/ward-management/`.
2. On the iPhone open that link in **Safari** → **Share** → **Add to Home
   Screen** → **Add**. (Android: Chrome → ⋮ → **Install app**.)
3. Open it from the home-screen icon.

Data typed into a phone stays on that phone until Firebase sharing is set up
(below). Each installed copy has its own storage, separate from Safari.

## Try it (local mode)

Open `index.html` through any static server, e.g.

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

Out of the box it runs in **local mode**: data stays in that one browser.
Fine for a test drive; use Settings → Backup to export/import.

## Share it with your team (≈15 minutes, free)

Sharing needs a small online database. The app uses Google Firebase (the
free Spark plan is plenty for one ward). Until it is connected the app runs in
**local mode**: each phone or laptop keeps its own separate data.

1. <https://console.firebase.google.com> → **Create a project** (any name,
   e.g. `ortho-ward`; Google Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method**: enable
   **Email/Password** (and **Google** if you like). Then **Settings →
   Authorized domains → Add domain** → `vishnuharan2390.github.io`.
3. **Build → Firestore Database → Create database** → location
   **asia-south1 (Mumbai)** → **Start in production mode**.
4. **Firestore → Rules**: paste `firestore.rules` from this repo, replace
   `you@gmail.com` with your own email, **Publish**.
5. **Project settings (⚙) → General → Your apps → Web (`</>`)** → register
   the app (no hosting) → copy the `firebaseConfig` block.
6. Put that block in `config.js` (`firebase: {...}`) and your email in
   `ownerEmails` — or send both to whoever maintains the app.

Then:

* Open the app, **Create account** with that email, confirm the link sent to
  your inbox, sign in.
* **Settings → Sharing**: if this device has cases from local mode, tap
  **Copy them to the shared database**.
* **Settings → Team**: add the emails of your HS and PGs. They open the same
  link, **Create account** with that email, confirm it, and see everything.

Edits sync live, field by field, so two people editing the same case don't
overwrite each other. The app keeps working offline and syncs when the network
returns. Email + password works everywhere, including the iPhone home-screen
app; Google sign-in may not open from the home-screen app on iOS.

## Patient data

This holds identifiable patient information. Keep the team list tight,
remove people when they rotate out, and check your institution's policy on
storing patient data in cloud services before going live. The repository
itself contains only code — no patient data is ever committed.

## Files

```
index.html        app shell
assets/           default letterhead image
config.js         Firebase config + unit id (edit this)
firestore.rules   database security rules (paste into Firebase console)
css/app.css       styles, incl. print layouts
js/util.js        helpers
js/data.js        checklist definition, option lists, starter implant DB
js/store.js       storage: local or Firebase live sync
js/print.js       OT list / ward board / discharge summary layouts
js/deck-engine.js admission-day deck slides (from the admission-deck tool)
js/vendor/        pptxgenjs 4.0.1 (MIT) for building .pptx in the browser
js/app.js         screens
```
