# Lake Erie Arms Event Punch Card

This folder contains the customer signup/pass flow and employee station scanner pages.

## Public URLs

- `/event-pass/` - event chooser
- `/event-pass/signup/` - Range to Patio Party customer signup
- `/event-pass/range-to-patio-party/` - Range to Patio Party signup
- `/event-pass/staff/` - staff scanner home page
- `/event-pass/pass/?id=GUEST_CODE` - customer QR pass for screenshotting
- `/event-pass/level-up-live-immersion-zone/` - 1 free mag in Level Up Live
- `/event-pass/level-up-live-action-zone/` - 1 free run in Action Zone
- `/event-pass/range/` - free shooting on LEA range
- `/event-pass/retail/` - retail purchase
- `/event-pass/caliber-club-cafe/?station=lea-cafe` - LEA Cafe purchase
- `/event-pass/caliber-club-cafe/?station=caliber-club` - Caliber Club purchase
- `/event-pass/photobooth/` - photo booth post/tag
- `/event-pass/member/` - member or membership purchase

Legacy `.html` paths redirect to the clean folder URLs.

## Google Sheet

Tracker:

https://docs.google.com/spreadsheets/d/1XAj47kCYJ7MMK4WcsLmGhCyLbRzbMDgfMYw7RKPO_yw/edit

Admin tracking:

- Dashboard counts people signed up, location punches, total punches, raffle entries, and remaining codes.
- The active event tab is `Range to Patio Party - Aug 8-9`.
- Future event tabs should start from `Event Template`.
- The dashboard countdown assumes a 100,000-code event capacity.
- The backend reads and writes the active event tab directly; older `Guests`, `Punches`, `Stations`, `Raffle Summary`, and `Setup Notes` tabs are hidden legacy tabs.

## Deployment

1. Open the Google Sheet above.
2. Open Extensions > Apps Script.
3. Paste the contents of `../google-apps-script/Code.gs`.
4. Deploy as a Web App.
5. Set access so event signup/scanner pages can submit.
6. Paste the Web App URL into `config.js` as `apiUrl`.

When `apiUrl` is blank, the pages run in local mock mode with `localStorage`.
