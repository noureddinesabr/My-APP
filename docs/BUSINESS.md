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

## What these decisions require (engines)

- **Weekly invoice engine:** a ledger of each completed job's commission per driver; every Monday at 00:00 an invoice per driver (week, jobs, total, due date, bank details and payment reference); payment confirmed by the admin (bank transfer / CashPlus / Wafacash receipt), later automatic; reminders before and after the due date; overdue: reminders for 2 weeks, then new offers paused until paid (round 2), admin can grant a delay. The first 7 days after approval are free (no invoice).
- **Nationwide matching:** search radius that widens in steps; intercity requests shown to drivers on that road or in the destination city; "no driver near you yet" handled honestly (keep the request open, widen, notify when one joins).
- **All loads:** vehicle catalogue up to semi-trailers and refrigerated trucks; heavier loads need the weight and access questions.
