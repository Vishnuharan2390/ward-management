# Ward WhatsApp bot

Forward your admission-day case posts to the bot's WhatsApp number and they appear in the ward app's
**Admission day PPT** and **Pre-op Ward** by themselves. No export, no retyping.

```
Case 10                                  →  case number (the PPT follows it)
Sivagamy 47/F                            →  name, age, sex
NMLC/ACCIDENTAL FALL                     →  mode
CLOSED FRACTURE BOTH BONE FOREARM LEFT   →  diagnosis
+ photo in the same post                 →  X-ray slide
```

The bot replies to each one: *✓ Case 10 SIVAGAMY 47/F added to the 02/11/2026 admission day (1 X-ray).*

| Send the bot | It does |
|---|---|
| a case post (text, or a photo with the post as its caption) | saves the case |
| a photo just after a post | adds it to that case (caption *wound* / *CT* / *MRI* to file it there; otherwise X-ray) |
| `DOA 2/11` | the admission day for the posts that follow (lasts 14 h); `DOA AUTO` to undo |
| `HELP` | shows this |

**Admission day:** anything forwarded before 10 AM counts for the previous day, so forwarding at
1 AM still lands on the right night. Forwarding the same patient twice doesn't make a duplicate.

Only the numbers in `ALLOWED_NUMBERS` get answers. (Optional: if you also give it an Anthropic API
key, any other message goes to Claude for clinical questions.)

---

## Set-up, one time (about 45 minutes, a laptop is easiest)

You need: the **spare SIM** for the bot's number, your **Meta business account**, a free
**Cloudflare** account, and a **new Gmail** for the bot.

### A. The bot's login for the ward app (5 min)
1. Make a new Gmail for the bot, e.g. `orthounit1.casebot@gmail.com`.
2. Open the ward app **in a private / incognito window**, tap **New here? Create account**, use
   that Gmail and a password, then click the link in the verification email.
3. On **your** phone (you are the owner): **Settings → Team** → add that Gmail, name *WhatsApp bot*.

### B. Meta — WhatsApp Business Platform (15 min)
1. **developers.facebook.com → My Apps →** your app (type *Business*) → add the **WhatsApp** product.
2. **WhatsApp → API Setup → Add phone number**: the spare SIM (it must not be on WhatsApp). Verify
   by SMS. Copy the **Phone number ID**.
3. **A permanent token:** business.facebook.com → **Settings → Users → System users → Add**
   (Admin) → **Assign assets**: your app and your WhatsApp account (full control) →
   **Generate token** with `whatsapp_business_messaging` and `whatsapp_business_management`.
   Copy it. (The 24-hour temporary token on the API Setup page is fine for a first test.)
4. **App settings → Basic → App secret → Show**. Copy it.

### C. Cloudflare — runs the bot (15 min, nothing to install)
1. Sign up free at **dash.cloudflare.com**.
2. **Storage & Databases → KV → Create** a namespace named `ward-bot`.
3. **Workers & Pages → Create → Create Worker**, name it `ward-whatsapp-bot`, **Deploy**.
4. **Edit code** → delete everything → paste the whole of **`worker-paste.js`** (on GitHub open
   the file → **Raw** → select all → copy) → **Deploy**.
5. The worker's **Settings → Bindings → Add → KV namespace**: variable name `HISTORY`, namespace `ward-bot`.
6. **Settings → Variables and Secrets → Add**:

   | Name | Type | Value |
   |---|---|---|
   | `ALLOWED_NUMBERS` | Text | your team's numbers with 91, comma-separated, e.g. `919876543210,919812345678` |
   | `GRAPH_VERSION` | Text | `v21.0` |
   | `FIREBASE_PROJECT_ID` | Text | `ortho-ward-c2e69` |
   | `FIREBASE_API_KEY` | Text | `AIzaSyBI8bub3UpXN-fxBzlbWryzBdZigtt88Us` |
   | `FIREBASE_UNIT_ID` | Text | `ortho-unit-1` |
   | `BOT_EMAIL` | Text | the bot's Gmail from A |
   | `BOT_NAME` | Text | `WHATSAPP BOT` |
   | `BOT_PASSWORD` | **Secret** | the bot's ward-app password from A |
   | `WHATSAPP_TOKEN` | **Secret** | token from B3 |
   | `WHATSAPP_PHONE_ID` | **Secret** | Phone number ID from B2 |
   | `APP_SECRET` | **Secret** | App secret from B4 |
   | `VERIFY_TOKEN` | **Secret** | any phrase you make up, e.g. `grh-ortho-2026` |

7. Copy the worker's address, e.g. `https://ward-whatsapp-bot.<you>.workers.dev`.

### D. Connect WhatsApp to the bot (5 min)
Meta app → **WhatsApp → Configuration → Webhook → Edit**:
- Callback URL: `https://ward-whatsapp-bot.<you>.workers.dev/webhook`
- Verify token: the same phrase as `VERIFY_TOKEN`
- **Verify and save**, then under **Webhook fields** subscribe to **messages**.

### E. Try it
Save the bot's number in your phone, send **HELP**, then forward one case post. It should appear in
the Admission day PPT for that night within seconds.

If something fails, the bot's reply says why (e.g. *Firebase sign-in failed*: check A and
`BOT_PASSWORD`; *Missing or insufficient permissions*: the bot's Gmail isn't on Settings → Team or
isn't verified).

---

## Sending the OT list to fixed contacts

The ward app's OT list page gets a **Send to OT contacts (N)** button. One tap → the bot sends the
OT list PDF from its WhatsApp number to every contact in the app's **Settings → WhatsApp the OT list to**.
Only signed-in team members can make it send (the bot checks with their own ward-app sign-in), and
the contact list can only be changed in Settings.

Needs B and C above done (the webhook in D and the bot's login in A are only for case intake).

### F. The OT list template (10 min, then wait for Meta's approval — usually minutes, sometimes hours)
A business number can only message someone first with a template Meta has approved.
1. **business.facebook.com → WhatsApp Manager → Message templates → Create template.**
2. Category **Utility**. Name **`ot_list`**. Language **English**.
3. **Header: Document.**
4. **Body:** `Please find the {{1}} attached.` For the sample value type `OT LIST UNIT I 20-11-2026`.
5. Submit. When it shows **Active**, carry on.

WhatsApp charges a small fee per template message (Utility rate for India — see Meta's pricing
page), so the WhatsApp Business account needs a payment method (**WhatsApp Manager → Payment settings**).

### G. Tell the bot about it (5 min)
1. Cloudflare worker → **Edit code** → paste the new **`worker-paste.js`** → **Deploy**.
2. **Settings → Variables and Secrets → Add:**
   | Name | Type | Value |
   |---|---|---|
   | `OT_TEMPLATE` | Text | `ot_list` |
   | `OT_TEMPLATE_LANG` | Text | `en` (the language code the template shows, e.g. `en` or `en_US`) |

   Make sure `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `FIREBASE_PROJECT_ID` and `FIREBASE_UNIT_ID`
   from C are there too.

### H. In the ward app
**Settings → Unit & letterhead:**
- **WhatsApp the OT list to:** the numbers, separated by commas (10-digit numbers get 91 added).
- **WhatsApp bot address:** the worker's address, e.g. `https://ward-whatsapp-bot.<you>.workers.dev`.

The button appears on the OT list page. If a number fails, the app says which and why (e.g. not on
WhatsApp, or the template isn't approved yet).

---

## Patient data
Posts go WhatsApp (Meta) → this Cloudflare worker → your own Firebase. The OT list goes the other
way: ward app → this worker → WhatsApp (Meta) → the contacts. Nothing else, and no AI
service, unless you add the optional Anthropic key for the chat part.

## For developers
- `src/index.js` webhook + case intake (+ optional Claude chat) · `src/caseparse.js` the post reader
  (keep in step with the app's `js/wa-import.js`) · `src/firestore.js` writes cases/images like the app · `src/otsend.js` the OT list sender (`/send-ot`).
- `npm test` runs the tests with fake WhatsApp / Firebase / Claude servers.
- `worker-paste.js` is the bundled worker for the dashboard: rebuild it after any change with
  `npx wrangler deploy --dry-run --outdir dist --minify && cp dist/index.js worker-paste.js`.
- With the CLI instead of the dashboard: fill `wrangler.toml`, `npx wrangler secret put …` for each
  secret, `npm run deploy`.
