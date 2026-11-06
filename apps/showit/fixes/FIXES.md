# Fix list (saved, not applied yet)

Apply only when the user says "apply".

## Screens
- Screen 1, first page (main page): `screen-1-first-page.png`

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
