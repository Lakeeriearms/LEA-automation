# Lake Erie Arms Event Punch Card

This folder contains the customer signup/pass flow and employee station scanner pages.

## Pages

- `index.html` - customer signup start page
- `staff.html` - staff scanner home page
- `pass.html` - customer QR pass for screenshotting
- `level-up-live-immersion-zone.html` - 1 free mag in Level Up Live
- `level-up-live-action-zone.html` - 1 free run in Action Zone
- `range.html` - free shooting on LEA range
- `retail.html` - retail purchase
- `caliber-club-cafe.html?station=lea-cafe` - LEA Cafe purchase
- `caliber-club-cafe.html?station=caliber-club` - Caliber Club purchase
- `photobooth.html` - photo booth post/tag
- `member.html` - member or membership purchase

## Google Sheet

Tracker:

https://docs.google.com/spreadsheets/d/153NX95UFh8mMzU0i27PknaB2BaRGFOxhq2zaGaVUmj8/edit

Admin tracking:

- Dashboard counts people signed up, location punches, total punches, raffle entries, and remaining codes.
- The active event tab is `Event - Main`.
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
