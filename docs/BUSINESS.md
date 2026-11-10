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

## Round 8: the driver's day (2026-11-08)

| Topic | Decision |
|---|---|
| Online / offline | **A switch on the driver's home.** Online = receives requests; offline = none (accepted bookings stay). **The app never switches him offline by itself**, however long he stays still or silent: only he does, when he isn't taking new work. |
| Where he works | **He sets it when he joins and can edit it anytime**: only inside his city, chosen intercity routes (from where to where), or everywhere. **The app also uses his GPS** to offer him current and future jobs around where he actually is. |
| Quality | **Warning, then pause**: below 4.0★ after 10 trips, or 3 late cancellations in a month → warning; still the same after 2 weeks → paused until the admin reviews. Good drivers get priority in the matching. |
| Driver cancels a booked trip | **Re-sent to the other drivers at once** (favourites first if any); the customer is told and keeps his place; the driver's reliability drops. |

## Round 9: problems and safety (2026-11-08)

| Topic | Decision |
|---|---|
| Fake accounts and fraud | **One driver account per phone number and per CIN**; **flags in the dashboard** (many cancellations, one device used by several accounts, GPS that never moves while "on the way"); **customers confirm their phone by SMS code**, and a customer with many no-shows is paused. |
| Forbidden goods | **The driver decides** (he can refuse a load). **The terms of service must state clearly that the app holds no responsibility for the goods carried.** The banned-goods list is to be decided later. |
| **Still open (ask the owner at the end)** | Who is responsible when goods are damaged or lost; how disputes are handled. |

## Round 10: helpers and special loads (2026-11-08)

| Topic | Decision |
|---|---|
| Helpers | **The driver brings them, priced in his offer**: the customer asks for N helpers; the driver brings his own team and includes them in his price; the app's fair price includes a suggested helper cost (≈ 80–100 DH each). |
| Whole-house moves | **Same flow, more photos**: the customer photographs each room; the AI lists everything, estimates the volume and suggests the vehicle, helpers and time; drivers and companies offer as usual. |
| Return trips | **Yes, suggest return loads**: a driver going Casa → Agadir is shown requests from Agadir back towards Casa, so he doesn't drive back empty (cheaper for customers going that way). |
| **Still open (ask the owner at the end)** | What business customers (shops, companies) get: company accounts, ICE invoices, monthly payment. |

## Round 11: alerts, dashboard, AI (2026-11-08)

| Topic | Decision |
|---|---|
| Alerts when the app is closed | **All three channels**: phone push notifications (main, free); **SMS for the important ones** (booking confirmed, driver set off, invoice due; ≈ 0.2–0.5 DH each, works without internet); **WhatsApp Business messages** (paid per message, needs Meta approval). |
| Admin team | **The owner + staff with roles**: owner (everything), document checker, support agent, finance (invoices). Every action is logged with who did it. |
| Dashboard home | **All four**: live map of drivers and trips (online drivers, trips in progress, requests with no offer); today's numbers (requests, booked, delivered, cancelled, money earned, new drivers); to-do list (drivers to approve, disputes, unpaid invoices, reports); alerts (request with no offer for 10 min, late driver, flagged account). |
| AI photo reading | **Xapp pays, with a limit per request**: free for customers, up to 6 photos per request and a few retries (≈ 0.1–0.5 DH per reading); without the AI the customer picks kinds by hand. |

## Round 12: legal and launch (2026-11-08)

| Topic | Decision |
|---|---|
| Terms and privacy policy | **Claude drafts them** (Arabic, French, English: Xapp's marketplace role, no responsibility for goods carried, commission and invoices, cancellations, data use under Moroccan law 09-08 / CNDP), **a Moroccan lawyer checks them** before launch. |
| Launch | **Closed test first** (the real app and server with ~20 drivers and friends for 2–4 weeks), then publish and advertise. |
| Phones | **Android first, iPhone soon after** (same code). |
| **Still open (ask the owner at the end)** | The company that runs Xapp (SARL / SARL AU / auto-entrepreneur). |

## Discussion: shared loads and empty returns (owner's words, 2026-11-09, in progress)

- It all comes down to the driver. Example: a motorcycle from Agadir to Casablanca for 300 DH. The customer doesn't want a private vehicle, doesn't mind sharing or leaving today or tomorrow; he wants a fair price, security and trust. A driver who lives in Agadir won't take it; a driver with a pickup already going back to Casablanca will gladly take it (maybe +50–100 DH), because he is going back empty.
- **Don't make it complex: the customer posts his load and the price he thinks fits; drivers decide from their own situation** (accept, or offer their price). The app does not group loads or fix a shared price.
- When filling the request the customer chooses: **accept shared cargo or not**, whether he (or someone else) rides along, how many helpers. If he accepts sharing, the driver can take other loads on the way (e.g. a 200 DH parcel from a town on the road).
- **No price floor, for any trip.** The customer can set any price he wants, private or shared. The app builds a cost engine (distance, fuel, insurance, taxes and all the driver's costs, a reasonable profit for the driver, plus the app's commission) and shows its result only as a **hint**; the customer can go below it. Reliable "usually accepted" hints come later, once there is real data.
- **Two kinds of trip only: normal (private) or shared** (the customer accepts sharing).
- **Always advertise cheap trips**: Xapp can offer cheap prices because of shared trips and because it finds drivers coming back empty.
- **Empty returns and declared trips:** drivers announce their trip (going and coming back), before leaving or during it, e.g. "Casablanca → Lyon, back tomorrow". The app then shows them loads along the way (shared) on the way there, and on the way back, either loads along the road or a private trip at a lower price because they are coming back anyway. The app also uses their GPS. Example given: a truck that moved a house Casablanca → Lyon takes loads city to city on the way back, or a furniture load Lyon → Casablanca at a cheap price.
- **Hints are welcome**: e.g. "drivers usually accept from about X DH from this place", once there is data.
- **No limit on the number of loads a driver carries** (not 2 or 3). He is limited only by the customers' conditions and his vehicle: e.g. **seats** — if customers ride along and the driver has only two free seats, he can take only two loads whose owners ride along; if the driver travels with one or two of his own helpers, there may be no seat left for any customer. Five people along Lyon → Casablanca, one riding along and four not, can all go on one trip, as long as all accepted sharing.
- **Conditions must be shown to the driver** (who rides along, helpers asked, seats needed) so he can accept or not, and they can discuss in the chat. A request he can't meet (e.g. the customer wants helpers and the driver has none) should not be accepted as is. The app must organise these conditions between the customer and the possible drivers.
- **Open question the owner raised (to answer when he finishes):** if a customer does not ride along with his load, should the driver even be told it is a shared load (he just picks it up and takes other loads on the way), or should he always be told that this load accepts sharing and that he may load other cargo on the way?
- **Drivers only see loads that fit them** (their criteria: route, vehicle, free space and seats, helpers, dates) **and fit the customer's conditions**, never "everything".
- **Idea to discuss: a voice assistant for drivers on the road.** Like GPS saying "turn left", the app speaks new loads on his way, for tomorrow or for the way back, and the driver answers by voice ("I accept", "I offer 350") in Darija, Arabic, French or English, hands free. Optional, switched on in Settings. Question raised: can it be done (e.g. with Claude's API or another tool)?
- **Planned trips announced in the app**: e.g. "tomorrow Casablanca → Dakhla, back the day after" (also by voice). The app then knows his plans with more certainty and offers loads that fit, alongside following his GPS.
- **A customer riding along with a shared load is told, not asked**: he already accepted sharing, so when the driver takes another load he only gets an announcement ("the driver will stop in Settat to take another load").
- **The person riding along may not be the one who booked** (the father books, the son rides). If the son has the app, the trip is shared with his account automatically and he gets the trip notifications, the map, the GPS, the distance. If not, only the father gets them. **The delivery code is with the father.** Open dilemma: how does the son get the notices and the code (SMS? WhatsApp?). When the customer says someone else rides along, the app asks that person's **name and phone number — kept by the app, not shown to the driver** — so it can send him things, and invites him to install the app to follow along; after the driver is booked, the customer is prompted to share the trip with him. Keep it **simple and practical**.
- **Seats: drivers are not asked how many seats they have.** The request shows how many seats the customer needs; the driver accepts or not based on his reality that day (he may free seats). Details can be settled in the chat afterwards; the chat can suggest questions to the customer (seats, helpers).
- **Helpers: open dilemma to solve with an engine.** Helpers are the driver's, paid from the agreed price. What if the driver shows up with no helpers (to keep the money), forcing the customer to help? Or brings one when two were asked?
- **Owner's answer (2026-11-10): ask the driver at sign-up.** When a driver signs up for the first time, the app asks him a few questions about himself and his vehicle (options and boxes to fill), including helpers: does he offer helpers, how many, how much he charges for each, or "it depends". Then the app shows him the **main rules**, among them: when a customer asks for helpers, include their price in your offer (or keep it in mind when you accept the customer's price), because you must bring them; coming without them is a breach of the agreed conditions and the customer may cancel the trip. (Claude to propose the full question list and rules.)
- **How the rules are shown (owner, 2026-11-10):** the few **most important rules come one by one as large cards**, each read and approved on its own (e.g. "If you accept a job with helpers, you must bring them; otherwise the customer may cancel, and he would be right"). **The other rules are on one page**, written large, which the driver reads carefully and accepts once.
- **Changed (owner, 2026-11-10): at sign-up, everything on pages; the key rules come later as reminders while working.** At sign-up (after documents, photo, name), the driver reads and accepts, one page each: the main rules, the terms of service, the privacy policy. The key rules are **not** shown as cards at sign-up: they come **from time to time during his daily work as notices he taps "I agree" on** (e.g. "If you don't bring the helpers, the customer can cancel the trip").
- **Reminder at accept time: yes.** When the driver accepts a job with helpers, a reminder appears before he confirms ("This job has 2 helpers. Are you bringing them?").
- **Arrival check: yes.** On arrival the customer is still asked whether the helpers came.
- **Changed again (owner, 2026-11-10): no recurring rule reminders; rules must never annoy.** The driver agreed once at sign-up, so the rules are not shown to him again, except as the check at the moment it matters (accepting a job with helpers: "Are you bringing the helpers?").
- **Illustrated guide at sign-up:** because people don't read terms, after signing up the driver scrolls once through a simple guide of **2D pictures** explaining what to do, then taps "I agree" and continues. He still accepts the terms of service and privacy policy pages.
- **Guide section in Settings** (next to Help / common questions): the same guide split into tabs, to watch anytime: seeing loads and offers, accepting or declining, what to do after accepting (helpers, riders, code), announcing his trips, etc.
- **Customer guide too, but only in Settings** (not shown after sign-up; the customer side is simpler).
- **Both guides are built LAST**, after the whole app and all the rules are finished, so the pictures, rules and buttons shown are the final ones. Not now.
- **Waiting for a cheap load: no waiting time is announced** ("1–2 days" would drive customers away). The customer gets only general, encouraging hints (e.g. "raising your price can bring offers sooner") and two buttons: **raise the price** or **keep it as it is**. **No time limit**: the request stays open until a driver takes it.
- (Note for later: the Lyon example means **international routes** (Morocco ⇄ Europe) are in the owner's mind; to discuss: customs, documents, which countries.)

## What these decisions require (engines)

- **Weekly invoice engine:** a ledger of each completed job's commission per driver; every Monday at 00:00 an invoice per driver (week, jobs, total, due date, bank details and payment reference); payment confirmed by the admin (bank transfer / CashPlus / Wafacash receipt), later automatic; reminders before and after the due date; overdue: reminders for 2 weeks, then new offers paused until paid (round 2), admin can grant a delay. The first 7 days after approval are free (no invoice).
- **Nationwide matching:** search radius that widens in steps; intercity requests shown to drivers on that road or in the destination city; "no driver near you yet" handled honestly (keep the request open, widen, notify when one joins).
- **All loads:** vehicle catalogue up to semi-trailers and refrigerated trucks; heavier loads need the weight and access questions.
- **Favourites and direct requests:** favourites list per customer; a request can carry `preferredDriver` + `exclusiveUntil`; the matching engine sends it only to that driver until the time runs out or he declines, then starts the normal waves; price cards in the chat that turn into an accepted offer; the invoice engine applies the loyalty rate when the job came from a favourite.
- **Availability engine:** each driver's timeline (current trip, accepted bookings, their durations and travel between them); offers that no longer fit are withdrawn automatically and the customer is told.
- **Shared loads:** combining loads that fit in one vehicle and go the same way; a cheaper shared price per load; the driver's route with several pickups and drops, each with its own delivery code.

## Discussion: damaged or lost goods (owner's words, 2026-11-10, in progress)

- **Photos at loading are optional, never mandatory** (some people are shy, some trust the driver once they meet him). Once the driver's GPS confirms he has arrived and they load, either side may take photos if they want.
- **A photo engine:** every photo of a trip (the request photos, loading photos, delivery or problem photos) is saved and sorted in one place per trip, kept for both the driver and the customer to see, also in the history of past offers and trips, even when everything went normally.
- **Check before the code: agreed.** The app tells the receiver «تأكد من البضاعة قبل أن تعطي الكود» (check the goods before giving the code).
- **Scenario to discuss 1:** the driver really delivered, but after an argument the customer refuses to give him the code. What happens?
- **Scenario to discuss 2:** the driver arrives but can't find the receiver: no answer to messages or in-app calls (maybe offline, bad internet). What does he do with the goods?
- **Who pays for damage or loss: the driver and the customer agree between themselves.** Xapp doesn't decide money. It only provides the evidence, which both sides already have in their trip (request photos, loading photos, chat, everything). Xapp can **warn or pause either side** (driver, or a customer who abuses the service). **Insurance: maybe later, in the future.**
- **No declared value for goods.** Keep the app simple: no option to give the value of goods.
- **Theft (goods never arrive and the driver doesn't answer): agreed.** The driver is paused at once, his information and documents are shared for a police complaint, and he is banned if it's proven. **But it must be handled rightly:** there must be a mechanism to know it's proven (e.g. Xapp contacts or calls the driver about the complaint).
- **Owner's questions to discuss:** how does the app handle problems fast? In a damage conflict at delivery, Xapp is only a marketplace and gives the evidence, but what happens when one side refuses to give the code and the driver says the damage is not his responsibility?
- **Owner's stance (2026-11-10): Xapp is a simple marketplace, like inDrive.** Customers and drivers must know Xapp only connects them; whatever happens between them is for them to handle. Morocco works in a traditional way (e.g. home furniture Agadir → Casablanca in a pickup or Transit): delays, phones not working and connection problems are normal. So the app stays simple, a mediator that **forces nothing**.
