# Fix list (saved, not applied yet)

Apply only when the user says "apply".

## Screens
- Screen 1, first page (main page): `screen-1-first-page.png`
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
