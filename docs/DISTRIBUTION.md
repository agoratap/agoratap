# P06 Agora Pay — Distribution plan (23.10.2026)

Live demo: https://agoratap.github.io/agoratap/ (HTTP 200 checked 23.10.2026). It runs on testnet (Base Sepolia). There are no real-money payments yet.
Offer: the payer pays in any crypto, and the merchant receives any asset or fiat. The merchant installs nothing; payment works by QR or pay-link, for online shops, physical stores and market/street sellers.
Payout rules: EU merchants get no USDT or privacy-coin payouts, and their swaps go only through an ESMA-registered partner (CoinGate or Circle EU; the integration is not live yet). Non-EU merchants are served via Exolix, subject to local law and sanctions.
STATUS: nothing has been sent. Every external message waits for Bogdan's «trimite». Spend: €0.

## Channel 1 — Direct outreach to merchants already listed on BTC Map
- Why: these merchants already accept Bitcoin, so they are pre-qualified (FACT: listed with a verification date on btcmap.org).
- Pain we offer to solve (INFERENCE): they accept only BTC/Lightning, and Agora Pay would let them accept any coin with nothing to install.
- Method: one personal email per merchant, at most 20 per week, sent by hand.
- KILL threshold: 0 positive replies (a reply that asks for a demo or a pilot) from 40 sent emails → reword once (Offer Builder). A 2nd fail → PARK the channel.
- PASS: ≥3 positive replies, or ≥1 pilot agreed.

## Channel 2 — Communities and partners (Bitcoin meetups / circular economies)
- Targets (INFERENCE, to be verified before any post): local circular-economy groups (Bitcoin Ekasi-type projects, Einundzwanzig meetups in DE, Lisbon/Madeira Bitcoin communities, Cyprus Bitcoin meetups), plus meetup organisers who onboard merchants.
- Message (post or DM to the organiser): "Hi, I'm building Agora Pay, a no-install QR/pay-link that lets a stall or shop accept any crypto and get paid out in the asset or fiat it wants. Testnet demo: https://agoratap.github.io/agoratap/. I'm looking for 3 merchants in your community for a free pilot, and for honest criticism. Can I show it at your next meetup?"
- KILL threshold: 0 organisers agree to an intro or demo from 10 contacted within 14 days → PARK the channel.
- PASS: ≥1 meetup demo, or ≥2 merchant intros.

(A materially different 3rd option for later: listing in partner directories such as the CoinGate merchant directory, after the CoinGate rail exists.)

## Merchants (14 real, 8 countries) — source: BTC Map public API, fetched 23.10.2026
All are listed as accepting Bitcoin. The contact is the public email in the listing. Source page: https://btcmap.org/merchant/<id>, data from https://api.btcmap.org/v4/places/search/

| # | Country | Merchant | Website | Public contact | BTC Map id | Verified on map |
|---|---|---|---|---|---|---|
| 1 | NL | Pedal Perk Cafe | https://www.pedalperk.com/ | pedalperk@yahoo.com | 608 | 2025-01-14 |
| 2 | NL | Elevate | https://www.elevate.nl | info@elevate.nl | 979 | 2025-09-09 |
| 3 | DE | Nexondo | https://nexondo.de/ | info@nexondo.de | 2216 | 2026-03-14 |
| 4 | DE | Physiotherapie Alexandros Swoch | https://fuessiotherapie.de | info@fuessiotherapie.de | 2347 | 2026-02-11 |
| 5 | PT | CMO Clinic | https://cmoclinic.pt/tratamentos/ | dc@cmoclinic.pt | 2555 | 2026-05-26 |
| 6 | PT | Quase Quase | https://www.quasequase.pt | alvalade@quasequase.pt | 2667 | 2025-11-30 |
| 7 | CZ | Beorigo Fashion & Design | https://beorigo.cz | info@beorigo.cz | 4034 | 2026-06-14 |
| 8 | CZ | saidl.art (restoration) | https://saidl.art | kristyna@saidl.art | 5047 | 2026-03-28 |
| 9 | CY | Limassol Electrician 24/7 | https://www.limassolelectrician.com/ | cypruselectrician@gmail.com | 20847 | 2025-02-21 |
| 10 | SI | Kmetija Pr' Čižman (farm) | https://www.kmetijaprcizman.com/ | zajc.si@gmail.com | 21407 | 2026-10-01 |
| 11 | UK | Bespoke Goldsmith | https://bespokegoldsmith.co.uk/ | info@bespokegoldsmith.com | 692 | 2025-03-05 |
| 12 | UK | Kapucin | https://www.kapucin.co.uk/ | hello@kapucin.co.uk | 4945 | 2026-04-06 |
| 13 | US | Casper Fermentables | https://www.casperfermentables.com/ | casperfermentables@gmail.com | 2616 | 2026-04-01 |
| 14 | US | Sapien Center | https://www.sapiencenter.com/ | SapienCenter@gmail.com | 3486 | 2026-06-20 |

Not verified: whether each merchant still accepts BTC today, and whether each email is monitored (the data is from the listing, not from the merchants' own sites). EU = 1–10, so the CoinGate/Circle EU rail and no USDT apply. UK/US = non-EU rail, subject to local law and sanctions.

## First outreach message — NOT SENT (waits for Bogdan's «trimite»)
Subject: Accept any crypto at {Merchant}, nothing to install?

Hi {Merchant} team,

I saw on BTC Map that you accept Bitcoin. I'm building Agora Pay: your customer scans a QR code or opens a pay-link and pays in whatever crypto they hold, and you receive the asset or currency you choose. There's no app or plugin to install.

It's early. The demo runs on a test network, so no real money moves yet: https://agoratap.github.io/agoratap/

Would you try a free pilot, or tell me in one line what would stop you using something like this?

Thanks,
Bogdan

## Tracked demo links (added 28.10.2026, for Marketing Machine follow-ups)
Add `?ref=<tag>` to the demo link. The tag (lowercase a–z, 0–9, `-`, max 40) is copied into the subject of the "Request a readiness sprint" email as `[ref:<tag>]`. No cookies, no analytics, nothing stored or sent. The C1 emails already sent (40/40) used the plain link, so this applies only to future follow-ups and channels.
Convention: `c1-btcmap-<BTC Map id>` per merchant, `c2-<community>` for communities. Example: https://agoratap.github.io/agoratap/?ref=c1-btcmap-608
