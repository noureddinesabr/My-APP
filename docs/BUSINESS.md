# Xapp — business decisions

The owner's answers, recorded as they are taken. They override older notes in `PLAN.md` where they differ.

## Round 1 (2026-11-08)

| Topic | Decision |
|---|---|
| Audience at launch | **Everyone, all loads**: households, shops and traders, building materials, farms, intercity. |
| Price | **The app suggests, drivers offer.** The app proposes a fair price from real costs (never below the cost floor), the customer can adjust it, drivers accept or send their own offer, and the customer picks. |
| Revenue | **10% commission paid by the driver, invoiced weekly.** Once a driver is accepted in the app and has completed 7 days of work, every Monday they receive an invoice for the app's share of the past week's completed jobs (10% by default, adjustable by the admin in the dashboard), to pay to the app's bank account. Replaces the prepaid wallet in `PLAN.md`. |
| Coverage | **All of Morocco** from launch, city-to-city included. |

## Round 2 (2026-11-08)

| Topic | Decision |
|---|---|
| Driver check | **Documents checked by the admin before the first offer**: phone + SMS code, photo, CIN, driving licence, carte grise, insurance, vehicle photos. Approved in the dashboard; verified badge. |
| Unpaid invoice | **Warnings only, paused after 2 weeks.** Reminders through the two weeks after the due date; still unpaid → new offers paused until paid (jobs in progress continue); the admin can grant more time. |
| Cancellations / no-shows | **Free before the driver sets off; after that the reliability score drops** (customer or driver). Repeated no-shows pause the account. No money changes hands. |
| Payment | **Cash to the driver at delivery**, the price agreed in the app, when the customer gives the code. Online payment later. |

## Round 3 (2026-11-08)

| Topic | Decision |
|---|---|
| Matching | **Nearest suitable drivers, in widening waves.** First drivers within ~3 km whose vehicle fits, online and well rated; if no offer in 2–3 minutes, wider (≈10 km, then the whole city, then nearby cities; intercity requests also go to drivers in the destination city). |
| Fleets | **Transport companies can join from launch**: a company account adds its vehicles and drivers, receives requests, assigns jobs, and gets one weekly invoice. |
| Customer sign-up | **Only when sending the request**: photos, load, route and price first with no account; at «Send to drivers», phone + SMS code, then the request goes right away. |
| Support | **WhatsApp Business + in-app Help**: one WhatsApp number and the Help sheet with quick answers; urgent issues get a call back. |

## Round 4 (2026-11-08)

| Topic | Decision |
|---|---|
| Commission | **A rate per vehicle type**, each set by the admin in the dashboard. Starting values (proposal): triporteur, vans, pickups 10%; light trucks and 3.5 t 9%; 7 t and bigger, refrigerated, flatbed and semi-trailers 8%. The weekly invoice applies each job's own rate. |
| Growth | **The free first week for drivers** (no invoice for the first 7 days after approval). |
| Name | **A French / international name** (shortlist to choose from; check trademark at OMPIC, domain and store availability before deciding). |
| Next build | **The real server first**: accounts with SMS, the database, real two-phone requests / offers / chat / tracking, push notifications, document upload; then the admin dashboard. The test app becomes the real app. |

## Round 5: favourite drivers (2026-11-08)

The risk this answers: a customer and a driver who already know each other agree in the chat and then do the job outside the app (no commission, no protection). The rule is to make the booking happen at the moment they agree, inside the conversation.

| Topic | Decision |
|---|---|
| Favourites | After a trip the customer can add the driver as a favourite (♥, on the delivered page or the driver's profile); the driver is told. |
| Sending to a favourite | **Favourite first, then everyone**: at «Send» the customer can choose «Send to Youssef first»; only he sees it for a set time; if he doesn't accept or answers "busy", it goes to all suitable drivers automatically. |
| Time window | **10 minutes for a "now" trip, 2 hours for a trip booked for later** (or until 24 h before its time); the customer sees the countdown. |
| Chat | **Only inside a request.** From a favourite's profile, «Ask for a price» starts a request for him. In that request's chat the driver can send a price card («اقترح ثمن»); the customer's «أوافق» on it books the trip (code, tracking, reminders, invoice), so agreeing in the chat *is* the formal offer. |
| Commission | **Lower rate to reward loyalty** on jobs from a driver's favourite customers (proposal: 2 points less than the vehicle type's rate, e.g. 10% → 8%, set by the admin), so dealing outside the app is less tempting. |

## Round 6: offers and privacy (2026-11-08)

| Topic | Decision |
|---|---|
| Offer life | **No fixed timer.** An offer stays until the driver withdraws it, or the app withdraws it by itself as soon as he is no longer free in time for that customer (another job he accepted would make him late for this one: the app checks his bookings against the travel and loading time this request needs). |
| Privacy | **Area only before booking** (neighbourhood and city, distance, photos, load, price); the exact pickup and destination and the customer's name only after the customer accepts. |
| Ratings | **Both rate each other.** Drivers see a customer's rating before offering; customers with poor ratings can be paused too. |
| Jobs at once | **Yes, several at once**, because the app will offer **shared loads**: a customer can choose to share the vehicle with other loads for a cheaper price, so a driver can carry several accepted loads on one trip (rules in round 7). |

## Round 7: shared loads (2026-11-08)

| Topic | Decision |
|---|---|
| Where | **Inside cities and between cities, from launch.** |
| What can be shared | **Boxes, goods and small furniture**: things that pack and stack safely. Not shared: fragile valuables, food that needs cold, animals, dangerous goods, very heavy machines. The app asks before allowing «share». |
| **Still open (ask the owner at the end)** | How much cheaper a shared load is and what the customer accepts in return (delivery window); who puts shared loads together (the app, the driver posting his planned trip, or both). |

## What these decisions require (engines)

- **Weekly invoice engine:** a ledger of each completed job's commission per driver; every Monday at 00:00 an invoice per driver (week, jobs, total, due date, bank details and payment reference); payment confirmed by the admin (bank transfer / CashPlus / Wafacash receipt), later automatic; reminders before and after the due date; overdue: reminders for 2 weeks, then new offers paused until paid (round 2), admin can grant a delay. The first 7 days after approval are free (no invoice).
- **Nationwide matching:** search radius that widens in steps; intercity requests shown to drivers on that road or in the destination city; "no driver near you yet" handled honestly (keep the request open, widen, notify when one joins).
- **All loads:** vehicle catalogue up to semi-trailers and refrigerated trucks; heavier loads need the weight and access questions.
- **Favourites and direct requests:** favourites list per customer; a request can carry `preferredDriver` + `exclusiveUntil`; the matching engine sends it only to that driver until the time runs out or he declines, then starts the normal waves; price cards in the chat that turn into an accepted offer; the invoice engine applies the loyalty rate when the job came from a favourite.
- **Availability engine:** each driver's timeline (current trip, accepted bookings, their durations and travel between them); offers that no longer fit are withdrawn automatically and the customer is told.
- **Shared loads:** combining loads that fit in one vehicle and go the same way; a cheaper shared price per load; the driver's route with several pickups and drops, each with its own delivery code.
