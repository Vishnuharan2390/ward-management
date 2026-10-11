# Pre-op Ward — Ortho Unit

A shared digital ward notebook for the pre-operative ward: case work-up
tracking, pending works for the team, imaging uploads, one-tap OT list PDF
and auto-filled discharge summaries. Runs in any browser (phone or desktop),
no install, no build step.

## What it does

| Screen | Use |
| --- | --- |
| **Cases** | Every active patient as a card: ward, diagnosis, plan, a progress bar, out-of-range values in red bold and red chips for what's pending. |
| **New case** | Patient details, diagnosis, plan, level (auto-filled from the level database) and scheme status (Approved / Validation / To be submitted / Denied / No scheme), implants auto-filled from the implant database, and the first set of investigations with one date for the whole set. |
| **Investigations** | The unit's standard parameters and ranges: CBC (Hb, WBC, PLT), RFT (RBS, urea, creatinine, Na, K), LFT (T/D/I bilirubin, SGOT, SGPT, ALP), ESR, qCRP, VM (HBsAg, HCV: positive/negative) and VCTC (HIV: reactive/non-reactive). Values outside the range show in **red bold** with ↑/↓. Add any other investigation with its own normal range and units. **Repeat investigations** adds a dated set; the flowsheet shows every date side by side. Pus C/S takes the organism (in italics) and the antibiotics it is sensitive to. Counts can be typed as said: PLT 2.4 = 2,40,000, WBC 8.4 = 8,400. |
| **Pending** | Any empty investigation except ESR, qCRP and pus C/S is pending, as is any empty work-up item (ECG, ECHO & cardio opinion, X-ray, CT, MRI, PAC) or opinion without advice. Type "NA" in a work-up item that isn't needed. |
| **Ward** | The ward notebook: S.No · Name · Diagnosis · To do's · Assessment/Scheme, with **BOT** on posted cases. To do's compile themselves and lead with abnormal values in red. *Detailed* shows every value. Print / PDF for rounds. |
| **OT list** | Two pages. **Pick cases**: name, age/sex, diagnosis, plan, date of admission and a **Radiographs** link that opens every X-ray, CT and MRI of the patient in one viewer (→ / swipe to step through). **Details**: date, day, unit, chief (dropdown) and signing Assistant Professor (dropdown); reorder and confirm ward / level / implants / scheme. Two buttons: **Generate OT list PDF** (one list, the unit's format) and **Generate OT list print PDF** (the same list twice on one landscape sheet, top and bottom, shrunk to fit, to print and cut). |
| **Discharge / transfer** | The unit's discharge format: letterhead and patient box on every page, CAPS underlined sections, templates, auto-written course in hospital, advice phrases with Tamil lines, review-date generator. Dispositions: Discharge, Discharge at request, Transfer to post-op ward, AMA, Absconded. |
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

## Share it with your team (≈10 minutes, free)

Sharing needs a small database. The app uses Google Firebase (free Spark
plan is plenty for one ward).

1. Go to <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
3. **Build → Firestore Database → Create database** (production mode, region
   `asia-south1` / Mumbai).
4. **Firestore → Rules**: paste `firestore.rules` from this repo, replace
   `you@gmail.com` with your Gmail, **Publish**.
5. **Project settings → General → Your apps → Web (`</>`)** → register the
   app → copy the `firebaseConfig` object into `config.js` (`firebase: {...}`)
   and add your Gmail to `ownerEmails`.
6. Host the folder. Easiest: GitHub repo → **Settings → Pages → Deploy from
   branch** (root). Then in Firebase **Authentication → Settings → Authorized
   domains** add `<your-username>.github.io`.
7. Open the site, sign in with Google, go to **Settings → Team** and add the
   Gmail IDs of your house surgeon and senior PGs. They sign in with the same
   link and see everything live.

Everyone's edits sync instantly. Updates are saved field by field, so two
people editing different parts of the same case don't overwrite each other.
The app keeps working offline and syncs when the network returns.

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
js/app.js         screens
```
