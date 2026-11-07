# Fix list

Status: #1–#4 applied (preview v17, APK #8). New items go below and are applied only when the user says "apply".

## Screens
- Screen 1, first page (main page): `screen-1-first-page.png`
- Screen 3, "Check your request" (راجع طلبك, step 2 Details): `screen-3-request.png` (4 parts, top to bottom)
- Screen 4, waiting for offers / offers (after sending, map full screen): `screen-4-waiting-offers.png` (left: just sent; right: offers arrived)
- Screen 5, delivered page (تم التسليم, after the trip ends): `screen-5-delivered.jpg` (user's phone screenshot, APK #9)
- Screen 6, trip in progress / tracking (after an offer is accepted): `screen-6-tracking.jpg` (user's phone screenshot, APK #9)
- Screen 7, notes for the driver (ملاحظات للسائق, on Check your request): `screen-7-notes.jpg`; design references `ref-7-whatsapp-empty.jpg`, `ref-7-whatsapp-typing.jpg`
- Screen 8, private chat customer ↔ driver (Messages → conversation): `screen-8-chat.jpg`
- Screen 9, customer profile (حسابي): `screen-9-profile.jpg`
- Screen 10, weight editor on What we saw (the تم button): `screen-10-weight-ok.jpg`
- Screen 11, When? (متى؟) on Check your request, taken at 22:20 with Today greyed out: `screen-11-when.jpg`
- Screen 12, top bar tabs (English, dark mode): `screen-12-topbar.jpg`
- Screen 13, the list of things to move when there is no photo (What we saw, empty): `screen-13-what-no-photo.jpg`
- Screen 14, "Your load" on Check your request (word «كنبة»): `screen-14-load-words.jpg`
- Screen 15, Offers → History (السابقة): `screen-15-history.jpg`
- Screen 16, Settings (English, light): `screen-16-settings.jpg`
- Screen 17, the 3-step bar (أرِه · التفاصيل · أرسِل) on the first page: `screen-17-steps.jpg`
- Screen 18, notes for the driver with the new message bar (English, preview v19): `screen-18-notes-bar.jpg`
- Screen 19, delivered page on the phone's browser preview (Chrome bars take height): `screen-19-delivered.jpg`
- Screen 20, What are you moving (no photo, kinds chosen), Arabic: `screen-20-kinds.jpg`
- Screen 21, the kinds tiles to replace with the user's list: `screen-21-kinds-list.jpg`
- Screen 22, chat in the Arabic app on the phone (APK #10): `screen-22-chat.jpg`
- Screen 23, booked trip card (customer, Arabic): `screen-23-trip-card.jpg`
- Screen 24, driver profile sheet (Arabic): `screen-24-profile.jpg`
- Screen 22b, notes for the driver, empty box in the Arabic app: `screen-22b-notes-box.jpg`
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
## Round 2 (saved after APK #9) — applied (preview v19)

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

### #8 — Screen 8 (private chat between customer and driver)
- **Arabic side:** a message written in Arabic shows on the LEFT today ("البضاعة جاهزة" bubble). In Arabic it must be on the RIGHT; in English and French on the left.
  - Arabic text inside bubbles and inside the box is right-aligned.
  - **Bubble sides (confirmed by the user), always seen from the person holding the phone:**
    - **Arabic:** my own messages on the RIGHT, the other person's on the LEFT. The same rule on the customer's phone and on the driver's phone.
    - **English / French:** the sides swap ("things change"): my own messages on the LEFT, the other person's on the RIGHT.
- **The writing bar: same design as #7 (WhatsApp-like)**
  - A rounded box that grows with the text.
  - On the left, inside the bar, a button to add a file or a photo (paperclip / camera).
  - On the right, the round button: microphone when empty (record a voice message), Send arrow once text is typed. Always on the right in all three languages; today the send button sits on the left in Arabic.
  - Voice messages and photos appear in the chat as bubbles (play + waveform; picture thumbnails).
- Keep the quick replies row (البضاعة جاهزة, أنا عند الباب…) above the bar.

### #9 — Profiles (حسابي) and what each side sees of the other
- **Wrong line under "My profile":** "يرى السائقون اسمك عندما يقبلون طلبك" (drivers see your name when they accept your request). Correct it: the other side sees your photo and name with every request and offer.
- **Driver → customer:** when a driver makes an offer, the customer sees the driver's photo and name on the offer and can tap to open the driver's profile.
- **Customer → driver:** the driver sees the customer's photo and name on the load / request and can open the customer's profile.
- **Driver ratings (drivers only, not customers):**
  - The driver's profile shows stars (the average) and the number of ratings (e.g. ★ 4.8 · 23 ratings).
  - Also shown small on each offer card.
  - Built from the ratings customers give after delivery.
- **Privacy, a hard rule:** neither side ever sees the other's phone number or any way to contact them outside the app (no phone, no social media, nothing). Contact only through the in-app chat.
  - Phone fields in a profile stay private.
  - To check when applying: the "someone else rides along" name + phone currently goes to the driver. Show only the name, or confirm with the user.
- **Name placeholder:** remove the example «سلمى» (e.g. Salma); leave the name box blank. Do the same for the driver's «مثلاً: يوسف أ.» example, for consistency.
- Screenshot for #9: `screen-9-profile.jpg`. Also seen on it:
  - When the page is scrolled, the title and the line under it slide under the top bar and show cut-off text there. They should scroll cleanly out of view (or be hidden behind a solid bar).
  - The phone box also shows an example number «06 12 34 56 78». Keep it as a format hint or blank it like the name; ask when applying (the user only named «سلمى»).
- **Decided by the user (after #9):**
  - Remove ALL example texts from the profile boxes. Keep the boxes and their labels, but leave them empty: name, phone «06 12 34 56 78», city «مثلاً: الدار البيضاء», and the driver's name and plate examples.
  - Exception to the privacy rule: when the customer picks "someone else rides with the goods", that person's name AND phone number ARE shown to the driver (it's fine, keep as now).

### #10 — The «تم» button → «أوافق», in the whole app
- Every confirm / OK button that says «تم» (i18n key `ok`, used on the weight editor and the When wheels, and anywhere else a lone «تم» button appears) becomes the more formal **«أوافق»**.
- Not touched: sentences where «تم» is part of a phrase rather than a button, e.g. «تم إرسال طلبك» (request sent), «تم التسليم» (delivered), «تم الحفظ» (saved). They are not the OK button. Mention this to the user when applying.
- English stays "OK", French stays "OK".

### #11 — Screen 11 (When? / متى؟)
**a. No accidental changes while scrolling**
- Scrolling the page sometimes touches the When choices or the wheels and changes them.
- Make the choices react only to a deliberate tap (not when a finger is scrolling the page).
- Make the wheels move only when you clearly drag on them, never from a page scroll passing over them.
- With the #3c behaviour (OK folds the wheels into one line), nothing changes once confirmed.

**b. Why it "freezes" today (cause found in the code)**
`lib/schedule.ts` limits bookings to 07:00–21:00 (`FIRST_SLOT_HOUR = 7`, `LAST_SLOT_HOUR = 21`), at least 60 min ahead, and only 14 days ahead (`BOOKABLE_DAYS = 14`). At 22:20 no time was left today, so «اليوم» (Today) is greyed out, and the evening and night hours never show.

**c. New rules (user)**
- **24 hours:** any hour of the day or night, 00:00–23:59 (keep the minute steps), for today and other days.
- **Up to one month ahead** (from now to the same date next month, about 30 days), every day selectable.
- «اليوم» (Today) stays available until the end of the day, since hours run to midnight. Keep a short minimum notice so a "later today" time isn't in the past; the current 60 min can be shortened, decide when applying.

### #12 — Screen 12 (top bar: order of the three tabs)
- Only the places change; the same buttons, look, icons and badges.
- **New order, in reading order: Offers · Messages · Profile.**
  - **English / French:** Offers on the LEFT, Messages in the MIDDLE, Profile on the RIGHT.
  - **Arabic:** العروض (Offers) on the RIGHT, الرسائل (Messages) in the MIDDLE, حسابي (Profile) on the LEFT.
- In code this is just the order of `TABS` in `tabs.tsx` (offers, messages, profile); the row already mirrors in Arabic.
- The Profile label stays «حسابي».

### #13 — Screen 13 (what to move, filled by hand / no photo)
- **Title:** instead of the line «أضف ما تريد نقله.» inside the box, put a real title just before the box: **«ماذا تريد أن تنقل؟»** (EN "What are you moving?", FR « Que transportez-vous ? »). Avoid repeating the same question twice on the page: today it is also the big page title above, so adjust one of them when applying.
- **Inside the box: 6 main options to tap** (one or several, highlighted when chosen), each with an icon. Proposed:
  1. أثاث (furniture)
  2. أجهزة منزلية (home appliances)
  3. كراتين وأغراض (boxes and belongings)
  4. مواد البناء (building materials: cement, bricks, tiles)
  5. مواد غذائية / مبردة (food, refrigerated goods)
  6. بضائع تجارية (merchandise / shop stock)
- **Plus «مواد أخرى» (other things):**
  - It can be tapped alone, or together with some of the 6.
  - Tapping it opens a box to write what else, with suggestions as you type, the same way as today's suggestions (best match nearest the box, limited scrolling list above it, box above the keyboard).
- **Suggestions, as smart as possible, in English, French and Arabic:**
  - The built-in list, made much bigger, with Moroccan/Darija words and spellings and plurals.
  - Online smart suggestions when connected (the AI: in the preview its own Claude; on the phone when an AI key is set). Honest note: without a key the phone uses the big built-in list only.
- **After choosing**, the page continues as now: items with counts, weight (estimate), vehicle, care tags, floor.
  - Decide when applying how each of the 6 options turns into items (e.g. choosing «أثاث» offers quick picks: sofa, bed, wardrobe, table… with counts) so the weight and vehicle can still be estimated.

### #14 — Moroccan words in Arabic (important)
- **The problem:** «كنبة» (sofa) is not used in Morocco, in standard Arabic or in Darija. It comes from `choices.ts` («كنبة 3 مقاعد», «كنبة زاوية») and `i18n.ts` `it_sofa`.
- **The rule:** every Arabic item name and suggestion uses the Arabic used in Morocco (standard words Moroccans use), and adds Darija where it makes it simpler. Examples to check when applying:
  - sofa → «أريكة» / «صالون» / «سدّاري» (Moroccan salon bench)
  - wardrobe → «خزانة» / «ماريو»
  - fridge → «ثلاجة» / «فريجيدير»
  - washing machine → «آلة الغسيل» / «لافوز»
  - boxes → «كراتين»
  - mattress → «مطرح» / «ماطلة»
  - gas cooker → «فورنو» / «كوزينيير»
- **Apply everywhere items come from:**
  - the built-in lists (`choices.ts` COMMON_ITEMS / MORE_ITEMS, `i18n` item keys);
  - the suggestions in Add item and the new #13 «مواد أخرى» box: searchable by either word, standard or Darija, with the Arabic and Latin Darija spellings people type;
  - the AI photo reading: tell the AI to name items in Moroccan Arabic (with Darija when common), never «كنبة» and similar Middle-Eastern words.
- **Also seen on the screenshot:**
  - The tag «قابل» is cut off (should read «قابل للكسر», fragile).
  - The floor shows twice («الطابق 1» and «في الطابق العلوي»); keep one.

### #15 — Screen 15 (Offers → History: clear end states)
- «انتهت» (finished) → **«تم التسليم»** (delivered).
- Cancelled → **«أُلغيت»** (cancelled). Say who cancelled when known: «ألغاها الزبون» (cancelled by the customer) / «ألغاها السائق» (cancelled by the driver), once driver cancelling from #6 exists.
- Every past item shows its end state clearly, with its own colour and icon:
  - **تم التسليم** (delivered): green, check.
  - **أُلغيت** (cancelled): grey or red, ✕.
  - **لم تكتمل** (not completed): amber, clock. The request got no accepted offer and expired.
  - **Driver's history only:**
    - **رفضها الزبون** (declined by the customer)
    - **اختير سائق آخر** (another driver was chosen)
- **Also seen on the screenshot:**
  - A place shows as «17000، الدروة» / "17000 → طانطان": a postal code was taken as the name when a spot was picked on the map. When naming a spot, never use a bare number; use the street, area or city instead.
  - «كنبة» appears again (see #14).

### #16 — Settings page: Appearance and Language layout
- **Appearance (المظهر) on one line**, not two rows:
  - Layout: «فاتح» (light) on one side, the on/off switch in the middle (the same switch as Sounds), «داكن» (dark) on the other side.
  - The switch picks one of the two; the chosen word is highlighted.
- **Light is the default for everyone,** customers and drivers, until changed. Today drivers start dark; that changes.
- **Language chips in a fixed order, the same in every language:**
  - العربية on the RIGHT, Français in the MIDDLE, English on the LEFT.
  - Make the row's order not flip with the app's direction.
- Screenshot for #16: `screen-16-settings.jpg`.
  - In English the chips currently read العربية (left) · Français · English (right): exactly the reverse of what is wanted.
  - In Arabic they read the other way round.
  - After the fix both show English (left) · Français · العربية (right).

### #17 — Screen 17 (step bar and going back)
**a. Going back one page at a time, never jumping to the camera**
- Step 1 has two pages: the camera/photos page and, after the reading, «ما رأيناه» (What we saw).
- From step 2 (Details), going back must land on «ما رأيناه» (What we saw), where things can be checked and changed, not on the camera page. This applies to:
  - the in-app back button;
  - the phone's back button;
  - tapping step 1 in the bar: it opens the LAST page of that step (What we saw if it exists), not its first page.
- **General rule for the whole app:** back always returns to the previous page, never further.
- Check every path when applying:
  - photo → reading → What we saw → Details;
  - no photo → What we saw → Details;
  - Edit from "Your load" and back;
  - the X logo's continue / start over.

**b. New step names (Arabic)**
- 1: «أرِه» → **«الصورة»**
- 2: keep **«التفاصيل»** (the user also offered «تفاصيل العرض»; in this app «العرض» means a driver's offer, so «التفاصيل» or «تفاصيل الطلب» is clearer; ask when applying)
- 3: «أرسِل» → **«أرسل الطلب»**
- English: Photo · Details · Send request. French: Photo · Détails · Envoyer la demande.
- Check the three still fit on one line on a 360-wide phone.

---
## Round 3 (saved after preview v19) — applied (preview v20, APK #10)

### #18 — Screen 18 (the message bar: notes for the driver and chat)
- **Notes for the driver:**
  - Remove the camera / photo option: no photos are sent here.
  - Keep only: text, an attached file (paperclip), or a voice recording.
  - Note: the paperclip today opens the photo gallery. Make it a file picker (documents / any file), which needs the Expo document picker added; decide when applying.
- **Smaller bar:** the writing box is too big. Make it slimmer, like WhatsApp's bar in the reference screenshots (one line, about 48 high, growing only as the text grows).
- **No animated dots,** anywhere (notes and chat). A normal chat box with a plain hint text only.
- **Writing direction follows what is typed, not the app's language** (notes box, chat, and every other writing box):
  - While typing, the box detects the script of the text (the keyboard language): Arabic text aligns to the right, French/English to the left, whatever language the app is in.
  - Sent messages / notes are placed by the language they are written in: a message written in Arabic goes to the RIGHT side, one written in French/English goes to the LEFT side, even if the app is in another language.
  - Example: app in English or French, the customer writes in Arabic → the message shows on the right. App in Arabic, the customer writes in French → it shows on the left.
  - **Decided by the user:** MY messages follow the language I write in (Arabic → right, French/English → left). The OTHER person's messages always go on the opposite side of mine.
    - When I write in Arabic (mine on the right), theirs are on the left.
    - When I write in French/English (mine on the left), theirs are on the right.
    - Base "my side" on my most recent message's script, or the app language when I haven't written yet; and keep every bubble's text aligned to its own script.

**#18b: notes sent vs. the quick-note suggestions (added by the user)**
- In "Notes for the driver", the notes the customer wrote or recorded (several texts and/or voice notes are possible) must look clearly different from the tap-on/off suggestion chips above them, so nobody mixes them up.
- Make it simple and beautiful. For example:
  - group them under a small label like «ملاحظاتك للسائق» (your notes for the driver) with a count;
  - show them as message bubbles (chat style, with time and a small ✕ to remove) in a lightly tinted area, with a thin divider between the chips and the notes.
- Voice notes as voice bubbles (play + waveform + length).

### #19 — Screen 19 (delivered page doesn't fit, and is stuck)
- On the phone, the delivered card runs off the bottom: the «Move something else» button and Share are cut, and the page can't be scrolled ("stuck"), because the big-map mode turns scrolling off.
- **Wanted:** everything fits on the screen, with the map's pickup and destination still visible at the top.
- **To do when applying:**
  - A more compact delivered card that adapts to the available height: smaller check, title and summary on fewer lines, driver and price in one slim row, smaller stars, and the "what went well" chips in one scrollable row or after a tap. The buttons are always visible at the bottom.
  - Never stuck: if the card is still taller than the space (small phones, browser bars), the panel scrolls.
  - The map frames the pickup and destination in the space left above the card.
- **Also seen:** the vehicle disc sits on top of the destination flag at the end. At delivery, hide the vehicle (or tuck it beside the flag) so the flag stays readable.
- Check every big-map page (waiting for offers, live trip, delivered) at a short screen height like a phone browser (about 600 high), in all three languages.

### #20 — Screen 20 (no photo: no estimated weight)
- When the customer skips the photo and picks the kinds / things by hand, do NOT show an estimated weight. We can't know it (furniture or cement…). This covers:
  - the summary line at the top («حمولتك»: "≈ 100 كغ (تقديري) · …");
  - the weight card's "Estimated … – …" line;
  - "Your load" on the request card and what the driver sees.
- **When an estimate is allowed:** only when it comes from the AI reading photos (at the start, or photos added later and analysed).
- **Everything else stays as normal:** choosing the vehicle (with each vehicle's capacity), care tags, floor, etc.
- **Proposed for the weight card in this case:** "Weight: optional, add it if you know it" with the existing Edit (− / + / typing). If the customer enters a number, it's shown as their own figure (already labelled «تقديرك»). The vehicle suggestion simply stays on the default until they pick or enter something.

### #21 — The kinds list (What are you moving?, no photo): the user's own list, in this exact order
Replaces the six kinds of #13. Arabic exactly as given; English and French added:
1. الأثاث المنزلي والأغراض الشخصية: Household furniture & personal belongings / Meubles et effets personnels
2. المواد المكتبية والأثاث المكتبي: Office supplies & office furniture / Fournitures et mobilier de bureau
3. المواد الغذائية والمشروبات: Food & drinks / Alimentation et boissons
4. المعدات والآلات الصناعية: Industrial equipment & machines / Équipements et machines industrielles
5. مواد البناء والتشييد: Building & construction materials / Matériaux de construction
6. السلع التجارية والمنتجات الاستهلاكية: Commercial goods & consumer products / Marchandises et produits de consommation
7. معدات السيارات ووسائل النقل: Car parts & transport equipment / Pièces auto et équipements de transport
8. المنتجات الفلاحية والزراعية: Farm & agricultural products / Produits agricoles
9. المستلزمات الطبية والمنتجات الصيدلانية: Medical supplies & pharmaceuticals / Fournitures médicales et produits pharmaceutiques
10. المواد الكيميائية ومواد الوقود والطاقة: Chemicals, fuel & energy materials / Produits chimiques, carburants et énergie
11. المواد المبردة: Refrigerated goods / Produits réfrigérés
12. مواد أخرى: Other things / Autres choses (last)
- **«مواد أخرى»:** tapping it just opens a text box to write what it is, in Arabic, French or English, a few words are enough. It is saved (registered with the request) and the customer moves on. No suggestion list is needed here (this replaces the suggestions box from #13 for this button).
- 12 tiles: keep them tidy and easy to scan (2 columns with icons, labels up to 2 lines; check the long ones fit in all three languages and at a short screen height). Each kind gets a fitting icon.
- **Decided by the user:**
  - Remove the quick picks. The customer only picks types (one or several).
  - The text box appears only if «مواد أخرى» is tapped (alone or with other types); then they write the other things in Arabic, French or English.
  - If «مواد أخرى» isn't tapped, there is no box: they just move on.
  - "Next" works as soon as at least one type is chosen (or «مواد أخرى» has text). The item list, counts and Add item are not needed in this no-photo path.
  - Weight stays optional per #20. The vehicle choice etc. stay as normal.
- The AI's "goods" kinds (photo reading) should map to the same list.

---
## Round 4 (saved after APK #10, not applied yet)

### #22 — Screen 22 (chat and notes: sides and the typing cursor). RECURRING, find the real cause
**a. Bubble sides: final rule (replaces #8 and #18)**
- Messages I send: ALWAYS on the RIGHT. Messages I receive: ALWAYS on the LEFT.
- This holds in every language of the app (Arabic, French, English), whatever language the keyboard types in, on the customer's phone and on the driver's phone, in every chat in the app.
- On the screenshot, "Are you okay?" (sent by me, in English) went to the left: wrong.
- Inside a bubble, the words still read in their own direction (Arabic text right-aligned, Latin text left-aligned).
- Notes for the driver (my own notes): also on the right.

**b. The typing cursor and the hint must start on the right in the Arabic app**
- In the Arabic app the hint «رسالة» and the blinking cursor sit on the LEFT of the box (chat, and the same in "Notes for the driver"). Wrong: they must be on the RIGHT, ready to type right to left.
- In English/French they start on the left.
- Once typing, the text follows the language typed (#18 kept): typing Latin in the Arabic app moves to the left; Arabic in the French/English app moves to the right.
- **Likely root cause:** `textTo()` in `composer.tsx` swaps left/right on Android in right-to-left mode (assuming Android swaps them). On the phone the box's alignment was NOT swapped, so the Arabic box ended up left-aligned.
  - Verify on the real APK behaviour, not just the browser preview.
  - Use one reliable way for every TextInput and Text (e.g. writingDirection / textAlign 'auto' and start/end based on the layout, or no swap for TextInput).
  - Check every writing box in the app with an empty box in Arabic: notes, chat, other things, place search, profile fields, cancel reason, rider name.

### #23 — Screen 23 (the booked trip card: driver's name, and calling inside the app)
**a. The name opens the profile too**
- Today only the driver's photo opens his profile. Tapping his **name** (e.g. "Youssef") must open the same profile.
- Do the same everywhere a person's photo + name are shown together (offers, trip card, chat header, driver's side showing the customer).

**b. An in-app call button, next to the chat button**
- Add a **call** button just before the chat button (phone icon, same round style).
- The customer can call the driver, and the driver can call the customer, **inside the app over the internet** (no phone number shown, privacy kept).
- A calling screen: the other person's photo and name, "Calling…", then the timer; mute, speaker, hang up.
- **Honest limit to keep in mind:** a real call between two phones needs a server (to connect the two phones). The test app has no server yet. In the test version the button and the calling screen can be built and shown, but the call cannot actually reach the other phone; it must say so clearly (no fake "connected" call with the example drivers). The real call works once the server exists.

### #24 — Screen 24 (the profile sheet)
- Remove the bottom line with the lock «أرقام الهاتف تبقى خاصة. تواصلوا عبر التطبيق.» completely (icon and text), on every profile sheet (driver's and customer's), in all languages.
- Nothing replaces it.

### #22 (again, second screenshot) — the notes box, same bug as #22b
- Seen again on `screen-22b-notes-box.jpg`: in the Arabic app the "notes for the driver" box shows the hint «اكتب شيئاً للسائق» (and the cursor) starting on the LEFT, next to the paperclip.
- Required: in the Arabic app, the hint and the cursor start on the **RIGHT** side of the box, ready to type Arabic. In English or French they start on the left.
- Same root cause and same fix as #22b. Treat it as one fix, and check it on the phone (APK) in the empty state, while typing Arabic, and while typing Latin.
