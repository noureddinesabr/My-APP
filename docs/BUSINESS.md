# Xapp — business decisions

The owner's answers, recorded as they are taken. They override older notes in `PLAN.md` where they differ.

## Round 1 (2026-11-08)

| Topic | Decision |
|---|---|
| Audience at launch | **Everyone, all loads**: households, shops and traders, building materials, farms, intercity. |
| Price | **The app suggests, drivers offer.** The app proposes a fair price from real costs (never below the cost floor), the customer can adjust it, drivers accept or send their own offer, and the customer picks. |
| Revenue | **10% commission paid by the driver, invoiced weekly.** Once a driver is accepted in the app and has completed 7 days of work, every Monday they receive an invoice for the app's share of the past week's completed jobs (10% by default, adjustable by the admin in the dashboard), to pay to the app's bank account. Replaces the prepaid wallet in `PLAN.md`. |
| Coverage | **All of Morocco** from launch, city-to-city included. |

## What these decisions require (engines)

- **Weekly invoice engine:** a ledger of each completed job's commission per driver; every Monday at 00:00 an invoice per driver (week, jobs, total, due date, bank details and payment reference); payment confirmed by the admin (bank transfer / CashPlus / Wafacash receipt), later automatic; reminders before and after the due date; overdue → new offers paused until paid, admin can grant a delay. The first 7 days after approval are free (no invoice).
- **Nationwide matching:** search radius that widens in steps; intercity requests shown to drivers on that road or in the destination city; "no driver near you yet" handled honestly (keep the request open, widen, notify when one joins).
- **All loads:** vehicle catalogue up to semi-trailers and refrigerated trucks; heavier loads need the weight and access questions.
