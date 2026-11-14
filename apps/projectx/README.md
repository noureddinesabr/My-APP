# X — AI transport assistant (prototype)

A customer talks to **X** — by voice, text or photo, in Darija, Arabic, French or English — and X
builds the transport request through a natural conversation, then shows driver offers on a map,
books one and follows the trip.

This is a separate app from the other Xapp work in this repository.

## Run it

Needs Node.js 22 or newer.

```bash
cd apps/projectx
npm install
npm run dev
```

Open **http://localhost:5173**. That one command starts both:

| Part | Address | What it does |
|---|---|---|
| Web app (Vite) | http://localhost:5173 | The app. Calls to `/api` are forwarded to the server. |
| X server | http://localhost:8787 | AI conversation, map routes, marketplace offers. |

Without an AI key everything works in **Demo mode**, which is labelled in the app.

Other commands:

- `npm test`: unit tests (the demo understanding, the booking engine, and the Claude tool loop with a mocked API).
- `npm run build` then `npm start`: production build, served by the X server on http://localhost:8787.
- `npm run build:single`: one self-contained HTML file in `dist-single/`, used for the shareable preview.

## Turn on real AI (Claude)

1. Copy `.env.example` to `.env`.
2. Put your key from https://console.anthropic.com in `ANTHROPIC_API_KEY=` (it stays on the server and never reaches the browser).
3. Restart `npm run dev`. The badge changes from **Demo mode** to **Claude**, and `GET /api/health` shows `"ai":"claude-server"`.

Settings in `.env`:

| Variable | Default | Meaning |
|---|---|---|
| `AI_PROVIDER` | `anthropic` | `anthropic` = real AI, `demo` = force demo mode |
| `ANTHROPIC_API_KEY` | (empty) | Secret key. Leave it empty for demo mode. |
| `AI_MODEL` | `claude-opus-5-5` | Model for conversation and photo analysis |
| `AI_EFFORT` | `low` | `low` answers fastest; `medium` and `high` think more |
| `PORT` | `8787` | Server port |
| `VITE_MAP_TILES` / `VITE_MAP_ATTRIBUTION` | OpenStreetMap | Map tile URL for production (for example MapTiler or Stadia with your key) |

How the real AI works: `server/ai/anthropic.ts` calls Claude through the official Anthropic SDK with three tools:

- `update_booking` merges what Claude learned into the structured booking.
- `suggest_replies` provides the tap-able answer chips.
- `request_review` shows the review card.

On each turn Claude sees the current booking and what is still missing. Server-side refusal fallbacks are enabled (`fallbacks: "default"`). To add another provider, implement `ServerAI` in `server/ai/provider.ts` and select it with `AI_PROVIDER`; the app does not need to be rebuilt.

## What is real and what is simulated

| Feature | Status |
|---|---|
| Conversation (understanding, follow-up questions, corrections, contradictions, 4 languages, mixed language) | **Real AI** with a key, or on the claude.ai preview page. Otherwise **Demo mode**: built-in rules, labelled as such, never presented as AI. |
| Photo analysis | **Real AI** (Claude vision) with a key. In Demo mode, only the two sample photos are "recognised" (their contents are known in advance); for your own photo, the demo says plainly that it can't see it and asks you to describe it. |
| Structured booking (`booking.json` in the Request sheet) | Real. It updates on every message and is saved in the browser. |
| Speech-to-text and text-to-speech | Real: the browser's Web Speech API (Chrome, Edge, Safari), or the claude.ai page's voice. If a browser can't do it, the app says so and the mic button is shown as unavailable. Arabic voice output depends on the voices installed on the device. |
| Map, routes | Real: Leaflet with OpenStreetMap data. Road routes come from OSRM through the X server. If routing or tiles can't load, the app shows an "approximate route" curve or an offline map, labelled. |
| Driver offers, driver profiles | **Sample data**, labelled "Sample offers · demo marketplace". The server's `/api/offers` returns samples until real drivers are connected. |
| Driver statuses, vehicle position on the map | **Simulated**, labelled "Demo: simulated status updates" and "Simulated position". No live GPS is connected, and the assistant says so when asked. |
| Driver chat | In-app messages are real. The driver's replies are **automatic samples**, labelled. |
| Support request, payments, admin | Data model only (`src/models/marketplace.ts`). No back office yet. |

## Short testing guide

1. **Welcome**: tap *Try a sample photo* (or take or upload your own; you can add several, remove them, or continue without a photo).
2. **Assistant**: X describes the photo and asks whether that's everything. Answer by typing, by tapping the chips, or with the mic.
   - Try a correction: *"actually 2 sofas"*, or *"Non, pas Mohammedia, plutôt Rabat"*.
   - Try a contradiction: give 5 kg for a fridge, or say the 4th floor with no elevator and 1 helper.
   - Try other languages: *«بغيت نصيفط شي حوايج ديال الدار من الدار البيضاء لسطات»*, *"Je veux transporter un frigo de Casablanca à Mohammedia demain à 10h"*, or mixed: *"بغيت transport ديال هاد meuble من Casablanca ل Rabat"*.
   - The **ring at the top right** (for example 4/6) shows progress. Tap it to see the request and the raw `booking.json`.
3. **Review**: when complete, a summary card appears. Tap ✎ on any line to change it through the chat, then tap **Find transport**.
4. **Offers**: watch the search, then compare the offers (best price, fastest, top rated). Open one with **View**, reject one, or **Show more offers**, then **Accept** and **Confirm booking**.
5. **Trip**:
   - **Message driver** opens the driver chat.
   - **Ask X** opens the trip assistant. Try *"Where is my driver?"* or *"tell the driver the gate code is 4521"*.
   - **Next status** steps through the simulation; it also advances by itself.
   - At *Delivered*, rate the trip and start a **New transport**.
6. **Refresh** at any point: the conversation, booking and trip are kept. **Start over** is in the ••• menu.

## Code map

```
src/
  models/        booking.ts (the structured request), catalog.ts (cargo, vehicles, prices),
                 places.ts (Moroccan cities and areas), marketplace.ts (drivers, offers, payments… admin-ready)
  ai/            types.ts (provider contract), prompt.ts (Claude instructions + booking schema),
                 service.ts (picks the provider), providers/remote.ts (server + claude.ai page),
                 providers/demo/ (rule-based Demo mode: nlu.ts, brain.ts, phrases.ts + tests)
  voice/         speech-to-text and text-to-speech, the voice conversation controller
  images/        photo resizing, sample photos
  map/           Leaflet map, routing
  marketplace/   offer search (server or local samples)
  booking/       app state + persistence (localStorage), sample driver
  components/    Orb, Welcome, Assistant, Composer, Review, Market, Trip, ui
server/
  index.ts       HTTP API (/api/health, /api/assistant, /api/route, /api/offers)
  ai/            ServerAI interface + Anthropic implementation (tool use)
  marketplace/   offer search (sample until real drivers exist)
```
