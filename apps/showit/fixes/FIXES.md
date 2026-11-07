# Fix list

Status: #1–#4 applied (preview v17, APK #8). New items go below and are applied only when the user says "apply".

## Screens
- Screen 1, first page (main page): `screen-1-first-page.png`
- Screen 3, "Check your request" (راجع طلبك, step 2 Details): `screen-3-request.png` (4 parts, top to bottom)
- Screen 4, waiting for offers / offers (after sending, map full screen): `screen-4-waiting-offers.png` (left: just sent; right: offers arrived)
- Screen 5, delivered page (تم التسليم, after the trip ends): `screen-5-delivered.jpg` (user's phone screenshot, APK #9)
- Screen 6, trip in progress / tracking (after an offer is accepted): `screen-6-tracking.jpg` (user's phone screenshot, APK #9)
- Screen 7, notes for the driver (ملاحظات للسائق, on Check your request): `screen-7-notes.jpg`; design references `ref-7-whatsapp-empty.jpg`, `ref-7-whatsapp-typing.jpg`
- Screen 2, "What we saw" (ما رأيناه, after the photo analysis): `screen-2-what-we-saw.png`

## Fixes

### #1 — Screen 1 (first page, top bar): replace Customer/Driver with 3 tabs; mode switch moves to Settings
Applies to both customer mode and driver mode.
- At the top, where the Customer | Driver switch is: keep the same button style, but make them three tabs: **Messages**, **Offers**, **Profile**.
- **Offers**:
  - Customer: the offers/requests the customer made, in two parts:
    - **Current**: ongoing.
    - **History**: old ones, whether finished, not continued or cancelled.
  - Driver: the same, for the driver's side.
- **Messages**: a list of chat boxes, one per conversation with a driver (or, in driver mode, with a customer). Tapping one opens that chat and shows the messages exchanged.
- **Profile**:
  - Customer: information about the customer.
  - Driver: information about the driver, with a profile photo, vehicle details and papers/documents.
- Remove the Customer/Driver mode switch from the main page. Put it inside **Settings**, where the person can change between driver mode and customer mode.
- Add the necessary settings entries, including **Terms of service** and **Privacy policy**: entries only, contents left empty for now.

### #2 — Screen 2 ("What we saw" / ما رأيناه)
- **Photos:** show ALL the photos taken, not just one, side by side and all the same size. If there are many, shrink them so they fill that area in a row.
- **Weight is an estimate:** every time weight is mentioned on this page (for example the header line "≈ 200 كغ"), clearly say it is an estimate (تقدير / estimated), because we don't know it for sure.
- **Edit weight:** put an **Edit** button next to the weight so people can change it if they want.
- **Retake button** (today the small grey "أعد" under the photo): make it obvious with a different, visible colour, and/or a circular back-arrow icon (↺, "try again" style).
- **Keep as is:** "Add item" (أضف شيئًا) is liked. The weight section title (الوزن) and the vehicle choice stay as they are; the user decided not to rename the title.

### #3 — Screen 3 ("Check your request" / راجع طلبك)

**a. From / To (pickup and destination): make it stand out**
- Today the من / إلى rows look like plain text in a field. This is the most important part: highlight it strongly so it's obvious it must be filled.
- Tapping **From** opens a separate full page that is just a map. At the bottom is the box where they can:
  - type and get suggestions;
  - pick a spot on the map;
  - use their current location (GPS).
- **To** works the same way.
- When done, they return to the "Check your request" page and the map page is gone.

**b. Keyboard: ESSENTIAL, repeated problem on the Android phone (Redmi)**
- In every typing box in the app, when the keyboard opens the box must move up and sit fully just above the keyboard, like the message box in the Claude app.
- Today on the phone the box either hides behind the keyboard (they can type but can't see the text) or only part of it shows.
- Must be verified on Android, every box.

**c. When (متى?)**
- Keep the Now / Today / Another day choices, the wheels and the sound effects (liked).
- After choosing a day/time, there must be an **OK** button that confirms it, so it sticks without needing to tap something else on the page and losing the wheel.
- **Now** is the default and needs no OK. If they open Now's details, then OK.

**d. Helpers and riding along (المساعدة ومرافقة الحمولة)**
- The − 1 + counter:
  - English and French: keep as is.
  - Arabic only: swap the − and + places.
- Change the people icon (orange circle with the two-people icon) to something else in the same design style, e.g. two people carrying/helping with furniture. Claude picks.

**e. Notes for the driver (ملاحظات للسائق)**
- Keep the automatic tap-on/off options, with these changes:
  - "Narrow street: a big truck can't get in": keep.
  - "The vehicle must park a bit far": keep.
  - "Ask the guard at the entrance": change to just "There is a guard" (يوجد حارس).
  - "A bed or wardrobe needs taking apart": change to "Something needs taking apart" (don't name the thing).
  - "Everything is packed and ready": keep.
  - "Call me when you arrive": remove.
  - "I pay cash at delivery": remove.
- Message box: remove the example/suggestion text inside it (what the user heard as "floor three"; today it reads "شيء آخر للسائق" / "Anything else for the driver"). Leave the box empty, showing only animated moving dots as a hint that they can write.
  - Dots placement: left in English and French, right in Arabic (confirmed by the user).
  - Addition (after #3): the box shows a hint so people know it's a box for writing or recording something for the driver:
    - Arabic: **اكتب شيئاً للسائق**
    - English: **Write something for the driver**
    - French: **Écrivez quelque chose pour le chauffeur**
    The hint replaces the old example text. The animated dots stay with it, on the same side as the hint text.
- Voice-record (microphone) button: keep it always on the right side, as now (liked).

### #4 — Screen 4 (after sending: waiting for offers, then offers)

**a. Map: pickup and destination, clearly and animated**
- As soon as the request is sent, the map must clearly show the trip, From → To (pickup and destination).
- The camera animates: it zooms in and moves so both pins and the route are clearly in view and easy to read.
- It stays focused on them the whole time while waiting and while offers arrive and are read. It must not drift away or be hidden by the cards.

**b. Offers: open, read, then Accept or Decline**
- Offers keep arriving. Tapping an offer opens its details: the driver, vehicle, the price offered and the other info, so the customer can decide.
- Each offer has two buttons, **Accept** and **Decline**. Today there is only Accept.
- **Accept**: asks "Are you sure?". Yes accepts it.
- **Decline**: asks "Are you sure?". Then it asks whether they want to make another offer (a counter-price to that driver), with two choices:
  - **Make another offer**: lets them propose their own price.
  - **Decline**: declines that offer altogether.

**c. "Raise +50" becomes "Edit your offer" (added after #4)**
- In the "Request sent · N offers" card at the bottom (and in the just-sent card), remove the **ارفع +50 / Raise +50** button.
- Replace it with **Edit your offer** (عدّل عرضك). It opens a place to change the price: raise it or lower it (− / + and typing, like the price on "Check your request"), to attract more offers. Saving updates the request that is waiting.

---
## Round 2 (saved after APK #9, not applied yet)

### #5 — Screen 5 (delivered page / تم التسليم)
The user doesn't like it. Redesign it:
- More animated and more attractive, but simple.
- Everything fits in the area under the map, down to the bottom of the screen: nothing hidden, no scrolling needed, not squeezed, clear.
- Claude may add whatever else is needed.

Seen on the screenshot, to fix along the way:
- "نُقلت في min 1": the minutes read wrong in Arabic (mixed direction, "min" in English).
- The orange card and what's under it are cut off at the bottom; the Share and "Move something else" buttons are hidden below.
- The map behind still shows "أنت" (you) instead of the finished trip.
- The rating stars take a lot of space.

Ideas to consider when applying (Claude's own):
- Celebration animation (check drawing in, confetti or burst).
- Trip summary: route, driver, price paid in cash, time taken.
- Rate the driver with stars, quick tags and a thank-you.
- One main button "Move something else" plus Share and "Back to home".

### #6 — Screen 6 (after acceptance: the trip engine, reminders, live map, cancelling)
The user wants a thorough, reliable mechanism ("an engine") from the moment both sides agree until delivery, for every timing: now, later today (e.g. in 10 h), tomorrow, in 3+ days. Proposed design (to apply):

**A. Trip states**
accepted/booked → (waiting for the day) → driver confirmed → driver on the way to pickup → at pickup (loading) → on the way to destination → arrived → delivered (code). Cancelled can happen from several states, with a reason.

**B. Messages at acceptance (both sides, in the app + chat log)**
- Customer: "Booked with {driver} · {vehicle} · {day time} · {price} cash", with the delivery code and the chat.
- Driver: "Job confirmed: {route} · {day time} · {price}", with the pickup address, notes, photos and voice note.

**C. Reminder timeline (T = pickup time)**
- **Now:** the driver gets "Go now: head to the pickup" with a big "I'm on my way" button. The customer gets "{driver} is getting ready".
- **Later today (more than about 2 h):** confirmation at acceptance; T−2 h reminder to both; at the departure time (T − travel time − 10 min) the driver gets "Time to leave: tap I'm on my way"; T−30 min the customer gets "Get ready, the driver leaves soon".
- **Tomorrow:** confirmation; the evening before (about 20:00) reminder to both; the morning of the day a reminder; then as for later today.
- **In 3+ days:** confirmation; T−24 h the driver must confirm "Still on for tomorrow?". If there is no answer by T−12 h, the customer is warned, with options to wait, message or re-post to other drivers. Then the same as tomorrow.
- **Late guard:**
  - If the driver hasn't tapped "on my way" at departure time, they get a nudge.
  - At T+10 min with no movement, the customer is told and offered: wait, message/call, cancel for free, or re-post.

**D. Live map (interactive, animated, not the current flat card)**
- **Driver to pickup:** a vehicle icon moves along the road route toward the pickup, with ETA and distance.
- **At the pickup:** the vehicle stays parked at the pin with a "loading · 12 min" timer until it leaves.
- **On the way:** the vehicle moves toward the destination with progress, ETA and city or intercity, until arrival. Then the delivery code.
- **GPS detection:**
  - Arriving within about 150 m of the pickup asks the driver "Arrived?" and confirms by itself after a short stay.
  - Leaving the pickup at driving speed switches to "On the way".
  - Near the destination it switches to "Arrived".
- **Live updates go to:** the customer's map, the driver's map, and the company admin dashboard (live trips, map, late or cancelled alerts).

**E. Cancelling (yes, both can, always with a reason)**
- **Customer:** free until the driver is on the way (or more than about 2 h before T). After that, still possible, with a reason; a fee could apply later once real payments exist (only a note in the test version).
- **Driver:** can cancel with a reason. It counts on their reliability. The request is re-posted to other drivers straight away (with priority) and the customer is told.
- **Reasons:** short lists for each side, plus "Other".

**F. Honest limits (to say when applying)**
- The test version runs on one phone with no server: the example driver's movement is simulated; the phone's own GPS is used for the driver side on the same phone.
- Real two-phone live tracking, push notifications when the app is closed, and the admin dashboard (apps/admin, not started) need the backend.
- In the APK, reminders can be real phone notifications scheduled on the same phone (local notifications).

Seen on the screenshot: the notice banner covers the top of the map; the tracking card is a flat bar with dots; the delivery code card is cut off at the bottom.

### #7 — Screen 7 (notes for the driver / ملاحظات للسائق)

**a. The line under the title** (today: "المس ما يساعد السائق على الوصول إليك…"), replaced with the user's text, spelling only tidied:
- AR: «اضغط على كل المعلومات التي تريد أن يعرفها السائق بخصوص الحمولة والرحلة، أو اكتب الملاحظات التي تريد مشاركتها مع السائق، أو اترك له تسجيلاً صوتياً خاصاً.»
  (The user wrote «إضغط / أكتب / أترك … تريد أن تشارك»; same words, with standard spelling.)
- EN: "Tap everything you want the driver to know about the load and the trip, write the notes you want to share with the driver, or leave them a private voice message."
- FR: « Touchez tout ce que le chauffeur doit savoir sur le chargement et le trajet, écrivez les notes à partager avec lui, ou laissez-lui un message vocal privé. »

**b. The writing box: redesign like the WhatsApp message bar in the reference screenshots**, keeping the app's own colours and fonts:
- A rounded pill-shaped box that grows with the text (one line when empty, more lines as you write).
- Inside the box: the hint (اكتب شيئاً للسائق with the moving dots, as now), plus small icons such as a paperclip or camera to add a photo for the driver (for example the entrance or the building).
- To its right, outside the box, a round button in the app's orange:
  - empty box → microphone (record a voice note, keeping cancel / pause / keep from before);
  - once text is typed → it turns into a Send arrow.
- Sending adds the note as a bubble above the box, like a chat: text notes as message bubbles, voice notes as voice bubbles with play and waveform, photos as thumbnails. Each can be removed. All of them go to the driver with the request.
- The mic and send button stay on the right side in every language (as the user asked before).

**c. Side rules (added after #7, confirmed by the user)**
- The Send / Record button is ALWAYS on the right, in Arabic, French and English (as in the WhatsApp screenshots). Same for the paperclip/camera icons' side relative to it: the layout of the bar does not flip.
- Only the hint with the moving dots inside the box follows the language: on the left in English and French, on the right in Arabic.
