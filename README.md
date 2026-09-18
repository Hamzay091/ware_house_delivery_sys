# Apex Logistics — AI Smart Warehouse & Delivery Management System

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-4f46e5?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-4f46e5?logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-4f46e5?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![EJS](https://img.shields.io/badge/EJS-server--rendered-4f46e5)](https://ejs.co)
[![Python](https://img.shields.io/badge/Python-Flask%20AI%20service-4f46e5?logo=python&logoColor=white)](https://flask.palletsprojects.com)

[![Unit tests](https://img.shields.io/badge/unit%20tests-10%20passing-059669)](backend/tests)
[![Smoke tests](https://img.shields.io/badge/smoke%20checks-104%20passing-059669)](backend/scripts/smoke.js)
[![Themes](https://img.shields.io/badge/themes-light%20%2B%20dark-0284c7)](backend/public/style.css)
[![License](https://img.shields.io/badge/license-ISC-64748b)](#license)

A full-stack warehouse and delivery platform: role-based dashboards, inventory
with AI burn-rate forecasting, workload-balanced dispatch, route optimisation
and invoicing — built on Node/Express with a Python AI sidecar.

---

## Try it in one command

No database install, no `.env`, nothing to clean up afterwards:

```bash
cd backend && npm install && npm run demo
```

This boots a throwaway in-memory MongoDB, seeds it with realistic data and
serves the app at <http://localhost:3000>.

| Account | Email | Password |
| --- | --- | --- |
| Admin | `admin@apex.test` | `apexdemo123` |
| Manager | `manager@apex.test` | `apexdemo123` |
| Delivery staff | `driver@apex.test` | `apexdemo123` |

Everything lives in memory and disappears when you stop the process.

---

## Features

### Role-based access control
- **Admin** — full oversight: user management, impersonating the manager view,
  per-user delivery histories, system-wide metrics.
- **Manager** — inventory, dispatch, route optimisation and billing.
- **Delivery staff** — their own assigned runs, with in-place status updates.

Every route is guarded by role middleware, and delivery staff can only update
deliveries actually assigned to them.

### AI and smart features
- **Predictive forecasting** — a Python job reads 30 days of completed
  deliveries and writes a daily burn rate and a days-of-stock-left estimate
  onto every item.
- **Route optimisation** — addresses are geocoded through PositionStack and
  ordered with a nearest-neighbour pass, then plotted on a Leaflet map.
- **Balanced assignment** — new deliveries are pre-assigned to whoever has the
  lightest active workload, computed in a single aggregation.

### Inventory
- Full CRUD over items, grouped into stock categories.
- **Total stock** (cumulative) is tracked separately from **available stock**
  (physically on hand).
- Stock reservation is **atomic**: a conditional `$inc` means two managers
  claiming the last units at the same moment cannot both succeed, and stock can
  never go negative.
- A **failed** delivery returns its units to the shelf; a delivered one does not.
- Server-side search, category and stock-level filters, sortable columns,
  pagination and CSV export.

### Billing
- One-click invoices from delivered orders, with a unique index preventing
  duplicates.
- Unpaid / paid / void tracking, outstanding and collected totals, CSV export.
- A print stylesheet that renders the invoice cleanly on paper.

### Notifications
- Crossing the low-stock threshold raises an in-app alert for every admin and
  manager, plus an optional email.
- Unread badge in the top bar, filterable history, mark-one and mark-all.

### Interface
- Light and dark themes, following the OS by default with a manual toggle that
  persists and does not flash on reload.
- Responsive from 320px up: the navigation collapses into a drawer and wide
  tables restack into readable cards.
- Keyboard accessible — skip link, visible focus rings, ARIA state on every
  disclosure, and `prefers-reduced-motion` respected.

---

## Security

Behaviour that was hardened in this codebase, and is worth preserving:

| Area | Approach |
| --- | --- |
| CSRF | Per-session token required on every state-changing request, compared in constant time (`middleware/csrf.js`). |
| Destructive actions | Deletes, logout, invoice generation and notification reads are all `POST`, never `GET` links. |
| Mass assignment | Controllers assign named fields; `req.body` is never handed to a model or `findByIdAndUpdate`. |
| Passwords | bcrypt with cost 12, applied through a save hook so update queries cannot store plaintext. Minimum 8 characters. |
| Sessions | Stored in MongoDB (`connect-mongo`), `httpOnly`, `sameSite=lax`, `secure` in production, regenerated on login to blunt fixation. |
| Brute force | Rate limits on login, registration and the contact form. |
| Headers | Helmet with a strict CSP; the handful of inline scripts run under a per-response nonce, not `unsafe-inline`. |
| Injection | User input is escaped before use in a `RegExp`; sort fields are whitelisted; CSV cells are prefixed against formula injection. |
| Enumeration | Login returns one message for both an unknown email and a wrong password. |
| Secrets | Everything comes from the environment. `.env` is gitignored; `.env.example` documents the keys. |

Roles cannot be self-escalated, the last admin account cannot be deleted or
demoted, and deleting a user unassigns their deliveries rather than destroying
the operational record.

---

## Technology

**Backend** — Node.js, Express 4, MongoDB, Mongoose, Passport (local +
Google OAuth 2.0), bcryptjs, express-validator, helmet, express-rate-limit,
connect-mongo, compression, morgan.

**Frontend** — EJS server-side rendering, hand-written CSS design system with
light/dark tokens, vanilla progressive-enhancement JavaScript, Chart.js,
Leaflet, Font Awesome.

**AI services** — Python, Flask, PyMongo, SciPy, Requests.

**External APIs** — Google OAuth 2.0, PositionStack geocoding, OpenStreetMap tiles.

---

## Running against a real MongoDB

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`. At minimum set `MONGO_URI` and `SECRET_KEY` — the server
refuses to start without a session secret rather than running with an
undefined one. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then:

```bash
npm run seed   # optional demo data
npm run dev    # or: npm start
```

The app runs at <http://localhost:3000>.

**Google sign-in** is optional — leave the two `GOOGLE_*` values blank and the
button is hidden. To enable it, create an OAuth 2.0 Client ID in the
[Google Cloud Console](https://console.cloud.google.com/), add
`http://localhost:3000` as an authorised JavaScript origin and
`http://localhost:3000/auth/google/callback` as a redirect URI.

**Email alerts** are optional too — without `EMAIL_USER` / `EMAIL_PASS` the
in-app notifications still work and nothing tries to send mail.

### 2. Python AI service

```bash
cd python-ai-services
pip install -r requirements.txt
cp .env.example .env   # set MONGO_URI and POSITIONSTACK_API_KEY
python app.py          # serves on http://localhost:5001
```

Run the forecaster whenever you want the burn-rate figures refreshed:

```bash
python forecaster.py
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Runs the server. |
| `npm run dev` | Runs the server with nodemon. |
| `npm run demo` | In-memory MongoDB + seed data + server, zero setup. |
| `npm run seed` | Seeds the configured database (refuses if it has users). |
| `npm run seed:force` | Wipes and reseeds. |
| `npm test` | Runs the unit tests for the query and CSV helpers. |

---

## Project layout

```
backend/
  controllers/     route handlers, one per domain
  middleware/      auth guards, CSRF, flash messages
  models/          Mongoose schemas
  public/          style.css (design system), app.js, favicon
  routes/          Express routers
  scripts/         seed.js, demo.js
  tests/           node:test unit tests
  utils/           query/pagination helpers, CSV, email, notifications
  views/           EJS templates and partials
python-ai-services/
  app.py           Flask API: geocoding + route optimisation
  forecaster.py    writes forecast data onto inventory items
```

---

## Credits

Built on the original
[AI-Smart-Warehouse-and-Delivery-Management-System](https://github.com/shabicreations033/AI-Smart-Warehouse-and-Delivery-Management-System)
by [@shabicreations033](https://github.com/shabicreations033), which remains
configured as the `upstream` remote.

## License

ISC — see the `license` field in [`backend/package.json`](backend/package.json).
