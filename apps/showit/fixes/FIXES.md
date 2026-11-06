# Fix list (saved, not applied yet)

Apply only when the user says "apply".

## Screens
- Screen 1, first page (main page): `screen-1-first-page.png`
- Screen 3, "Check your request" (راجع طلبك, step 2 Details): `screen-3-request.png` (4 parts, top to bottom)
- Screen 4, waiting for offers / offers (after sending, map full screen): `screen-4-waiting-offers.png` (left: just sent; right: offers arrived)
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
