# Lake Erie Arms Pass Automation

Single GitHub Pages repository for the Lake Erie Arms day-pass and event-pass
customer flows.

## Site routes

- Day pass: `day-pass/index.html`
- Event list: `event-pass/index.html`
- Active event signup: `event-pass/signup.html`
- Event pass staff scanner: `event-pass/staff.html`

When the custom domain is connected, the customer URLs will be:

- `https://learmspass.net/day-pass/`
- `https://learmspass.net/event-pass/`

## Project structure

- `day-pass/` contains the day-pass form, assets, and its Google Apps Script
  backend source.
- `event-pass/` contains event signup, QR pass, station, and staff scanner pages.
- `google-apps-script/` contains the event-pass backend source.
- `images/` contains the shared event-pass image assets.

Customer information must not be committed to this repository. Submitted data
is handled by the respective Google Apps Script deployment and Google Sheet.

## Local preview

From the repository root:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173/day-pass/` or
`http://localhost:4173/event-pass/`.
