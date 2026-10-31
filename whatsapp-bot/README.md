# Ward WhatsApp bot (Claude on WhatsApp)

Message a WhatsApp number → Claude answers. Text, **photos** (lab reports, X-rays, case
sheets) and **PDFs**. It remembers the last 20 messages of each chat for 12 hours; send
`/reset` to start fresh. Only numbers in `ALLOWED_NUMBERS` get replies; anyone else gets
silence.

It runs on **Cloudflare Workers** (free tier is plenty), so there is no server to keep on.

```
WhatsApp ──► Meta Cloud API ──► this Worker ──► Claude API
   ▲                                  │
   └──────────── reply ◄──────────────┘
```

## What you need (one-time, ~45 min)

1. **A spare phone number** that is *not* on WhatsApp already (a new SIM is easiest).
   Meta takes it over for the bot — it can't be your personal WhatsApp.
2. **Meta developer account + WhatsApp app**
   - developers.facebook.com → *My Apps* → *Create app* → type **Business** → add the
     **WhatsApp** product.
   - *WhatsApp → API Setup*: add your spare number and verify it by SMS. Note the
     **Phone number ID**.
   - *Business settings → System users*: create a system user, give it the app, and
     generate a **permanent token** with `whatsapp_business_messaging` permission.
   - *App settings → Basic*: copy the **App secret**.
3. **Anthropic API key**: console.anthropic.com → *API keys*. Add some credit (pay-as-you-go).
4. **Cloudflare account** (free): dash.cloudflare.com.

## Deploy

On a laptop with Node.js installed:

```bash
cd whatsapp-bot
npm install
npx wrangler login                      # opens the browser once
npx wrangler kv namespace create HISTORY   # paste the printed id into wrangler.toml
```

Edit `wrangler.toml` → `ALLOWED_NUMBERS = "91XXXXXXXXXX,91YYYYYYYYYY"` (your team's
numbers with country code, no `+`, no spaces).

Then set the secrets (each one prompts for the value):

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put WHATSAPP_TOKEN
npx wrangler secret put WHATSAPP_PHONE_ID
npx wrangler secret put APP_SECRET
npx wrangler secret put VERIFY_TOKEN     # make up any phrase, e.g. grh-ortho-2026
npm run deploy
```

It prints a URL like `https://ward-whatsapp-bot.<you>.workers.dev`.

## Connect WhatsApp to it

Meta app → *WhatsApp → Configuration → Webhook → Edit*:
- Callback URL: `https://ward-whatsapp-bot.<you>.workers.dev/webhook`
- Verify token: the same phrase you gave `VERIFY_TOKEN`
- **Verify and save**, then *Webhook fields* → subscribe to **messages**.

Save the bot's number in your phone and say hi.

## Costs (rough)

- **Cloudflare:** free (100k requests/day on the free plan).
- **WhatsApp:** replies to messages *you* send the bot are "service" conversations, which
  Meta currently doesn't charge for. Check Meta's pricing page — it changes.
- **Claude:** pay per use. On the default model (Claude Opus 5.5) a normal question is
  roughly ₹2–5; a photo adds a little. To halve it, set `CLAUDE_MODEL = "claude-sonnet-5-5"`
  in `wrangler.toml` and redeploy. Set a monthly spend limit in the Anthropic console.

## Patient data — read this

Messages and photos go through **Meta** (WhatsApp) and **Anthropic** (Claude API). Anthropic
does not train on API data, but it is still patient data leaving the hospital. Prefer
de-identified photos (crop out name/IP number), keep `ALLOWED_NUMBERS` to the team, and
check your institution's rules before using it for identifiable cases.

## Commands in the chat

| Send | Does |
|---|---|
| any text | Ask Claude |
| a photo / PDF (with optional caption) | Claude reads it |
| `/reset` (or `reset`, `new`, `clear`) | Forget the conversation |

## Develop

`npm test` runs the tests with fake WhatsApp and Claude servers (no keys needed).
