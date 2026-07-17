# Lake Erie Arms Event Punch Card

Standalone project for the event punch-card signup, QR pass, staff scanner pages, Google Apps Script backend, and shared image assets.

## Start Here

- Customer signup: `event-pass/index.html`
- Staff scanner home: `event-pass/staff.html`
- Apps Script backend: `google-apps-script/Code.gs`
- Setup notes: `event-pass/README.md`

The Google Sheet tracker is:

https://docs.google.com/spreadsheets/d/153NX95UFh8mMzU0i27PknaB2BaRGFOxhq2zaGaVUmj8/edit

## Sheet Structure

- `Admin Dashboard` tracks people signed up, codes remaining out of 100,000, total punches, raffle entries, and punch counts by location.
- `Event - Main` is the active event sheet with attendee contact fields and punch checkboxes.
- `Event Template` should be copied for future events so each event can have its own tab.
- `Staff Links` is a printable/reference tab for station URLs.
- Legacy setup/audit tabs are hidden; the backend now uses `Event - Main` as the operational source of truth.

Attendee codes use this pattern:

```txt
LEA-YYMMDD-XXXXXXXXXX
```

The 10-character suffix contains letters and digits and has far more than 100,000 possible combinations.
