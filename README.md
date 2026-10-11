# Pre-op Ward — Ortho Unit

A shared digital ward notebook for the pre-operative ward: case work-up
tracking, pending works for the team, imaging uploads, one-tap OT list PDF
and auto-filled discharge summaries. Runs in any browser (phone or desktop),
no install, no build step.

## What it does

| Screen | Use |
| --- | --- |
| **Cases** | Every active patient as a card: bed, diagnosis, plan, a progress bar and red/amber chips for what's still pending. Filter Pre-op / Posted / Post-op / Discharged. |
| **Case page** | The full checklist in notebook order — CBC (Hb/WBC/Plt), RFT (U/C/Na/K), LFT (T.Bili/SGOT/SGPT), VM, VCTC, ECG, ECHO & cardio opinion, Opinions (any department), X-ray, CT, MRI, Anaesthesia assessment, ESR, qCRP, Pus C/S. Each item is *Pending → Sent → Done / N/A*; typing all values of a lab panel marks it Done. Upload X-ray/CT/MRI photos straight from the phone camera. **Pending works** lets you assign tasks to HS / PG; whoever ticks it off is recorded. The **Activity** log shows who changed what and when. |
| **Ward** | The ward notebook, digital: S.No · Name · Diagnosis · To do's · Assessment/Scheme, with **BOT** on posted cases. To do's compile themselves from the checklist, opinions and pending works. A *Detailed* toggle shows every investigation. Print / PDF for rounds. |
| **OT list** | Tick cases → reorder → confirm ward / level / anaes / implants / scheme → set date, day, Professor (title line) and Assistant Professor (signature) → **Generate OT list PDF** in the unit's format (`OT LIST FOR ORTHO UNIT I ON 04/09/2026 FRIDAY PROF. …`, 11 columns, landscape). **Download Word** gives the same list as an editable .doc. Optionally marks the cases *Posted*. |
| **Implants** | Procedure → keywords → implants + default level + anaesthesia. When a case's plan contains a keyword (e.g. "CR/ORIF WITH SHORT **PFN** LEFT") implants, level and anaesthesia fill in automatically. Starts with ~26 common procedures in the unit's wording; edit freely. |
| **Discharge / transfer** | The unit's discharge format: letterhead and grey patient box repeated on every page, CAPS underlined sections (diagnosis, procedure, unit, H/O, past history, examination, treatment, course, condition, advice). Disposition: Discharge, Discharge at request, Transfer to post-op ward, LAMA/AA, Absconded. Past-history and examination templates, an **auto-written course in hospital** (from diagnosis, procedure, opinions and disposition), and one-tap advice phrases that add the matching **Tamil** line, including a review-date generator. |

PDFs use the browser's print dialog — choose **Save as PDF** as the printer.
The letterhead image, unit, Professor's name and OPD number are set under Settings.

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
