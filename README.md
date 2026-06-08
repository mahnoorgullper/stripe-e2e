# Stripe Payment Processing E2E Tests

Automated end-to-end tests for a full Stripe Sandbox payment workflow using **Playwright + JavaScript**, with **Allure reports** published to GitHub Pages on every push to `main`.

## Workflow Under Test

```
Create PaymentIntent → Confirm (test card) → Retrieve status
       → Verify webhook signature → Refund → GUI validation (Stripe Dashboard)
```

---

## Project Structure

```
stripe-e2e/
├── tests/
│   ├── api/
│   │   ├── create-payment-intent.spec.js   # Create & validate PaymentIntent
│   │   ├── confirm-payment-intent.spec.js  # Confirm with test cards
│   │   ├── retrieve-payment-status.spec.js # Retrieve & verify status
│   │   └── refund-payment.spec.js          # Full & partial refunds
│   └── gui/
│       └── dashboard-gui.spec.js           # Stripe Dashboard GUI checks
├── utils/
│   ├── stripe-api.js      # Stripe SDK wrapper & test payment method constants
│   └── shared-state.js    # Passes paymentIntentId/chargeId between test files
├── scripts/
│   ├── auth.setup.js      # One-time GUI session saver (bypasses CAPTCHA)
│   ├── encrypt-secrets.js # Encrypts .env → secrets/secrets.enc (AES-256-GCM)
│   └── decrypt-secrets.js # Decrypts secrets/secrets.enc → .env
├── .github/
│   └── workflows/
│       └── e2e-tests.yml  # CI/CD pipeline + GitHub Pages deployment
├── playwright.config.js
├── package.json
└── .env.example           # Template — copy to .env and fill in your values
```

---

## Local Setup (Step by Step)

### 1. Clone & install dependencies

```bash
git clone https://github.com/mahnoorgullper/stripe-e2e.git
cd stripe-e2e
npm install
npx playwright install chromium
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:

| Variable | Where to find it |
|---|---|
| `STRIPE_SECRET_KEY` | [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/test/apikeys) — starts with `sk_test_` |
| `STRIPE_PUBLISHABLE_KEY` | Same page — starts with `pk_test_` |
| `STRIPE_WEBHOOK_SECRET` | Run `stripe listen --print-secret` with the Stripe CLI, or create a webhook in Dashboard → Developers → Webhooks — starts with `whsec_` |
| `STRIPE_DASHBOARD_EMAIL` | Your Stripe account email |
| `STRIPE_DASHBOARD_PASSWORD` | Your Stripe account password |
| `PAYMENT_AMOUNT` | Leave as `2000` (= $20.00 in cents) |
| `PAYMENT_CURRENCY` | Leave as `usd` |

> **All credentials stay local.** `.env` is gitignored and never committed to the repo.

### 3. Save your Stripe Dashboard session ⚠️ MANDATORY for GUI tests

> **If you skip this step, all 5 GUI tests will be skipped automatically with the message:**
> `Auth session not found — run npm run auth:setup first`

Stripe blocks automated logins with CAPTCHA, so you must log in once manually. Run:

```bash
npm run auth:setup
```

A browser window will open. Log in to your Stripe account normally (complete any CAPTCHA or 2FA). The script detects when you're logged in and saves your session to `.auth/stripe-dashboard.json` automatically. GUI tests reuse this session so no login is needed during test runs.

- You only need to do this **once per machine**
- If your session expires later, just run `npm run auth:setup` again
- `.auth/` is gitignored — the session file stays on your machine only

### 4. Run the tests

```bash
# Run everything (API tests first, then GUI)
npm test

# API tests only
npm run test:api

# GUI tests only (requires .test-state.json from a prior API run)
npm run test:gui

# Watch the browser while tests run
npm run test:headed
```

### 5. View the Allure report

```bash
npm run allure:generate   # Build the HTML report from raw results
npm run allure:open       # Open the report in your browser
```

Or stream results live while tests are running:

```bash
npm run allure:serve
```

---

## Optional: Encrypt Your Credentials

To securely back up or share your credentials, you can encrypt your `.env` file with a master password:

```bash
npm run secrets:encrypt   # Encrypts .env → secrets/secrets.enc (AES-256-GCM + PBKDF2)
```

To restore your `.env` from the encrypted file (e.g. on another machine):

```bash
npm run secrets:decrypt   # Decrypts secrets/secrets.enc → .env
```

You will be prompted for the master password. Keep it safe — it cannot be recovered.

> `secrets/` is gitignored. The encrypted file does not contain plaintext credentials.

---

## GitHub Actions Setup

### Required Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Your `sk_test_...` key |
| `STRIPE_PUBLISHABLE_KEY` | Your `pk_test_...` key |
| `STRIPE_WEBHOOK_SECRET` | Your `whsec_...` key |
| `STRIPE_DASHBOARD_EMAIL` | Your Stripe login email |
| `STRIPE_DASHBOARD_PASSWORD` | Your Stripe dashboard password |

Secrets are encrypted by GitHub and never visible in logs or to other users — safe to add on public repos.

### Enable GitHub Pages

1. Go to **Settings → Pages**
2. Under **Build and deployment**, set Source to **GitHub Actions**
3. After the first successful push to `main`, the Allure report will be live at:
   `https://mahnoorgullper.github.io/stripe-e2e/`

For PRs and non-`main` branches, the report is available as a downloadable artifact (`allure-report-<run-number>`) in the Actions tab — no Pages deployment needed.

> **Note:** GUI tests run with `continue-on-error: true` in CI because they require a pre-saved browser session (`.auth/` is not committed to the repo). API tests must pass; GUI test failures are reported but do not block the pipeline.

---

## Test Coverage

### API Tests (19 tests)

| File | Tests |
|---|---|
| 01 Create PaymentIntent | Valid creation, zero/negative amount rejected, unsupported currency rejected |
| 02 Confirm PaymentIntent | Success (Visa), card declined, insufficient funds, 3D Secure |
| 03 Retrieve Status | PaymentIntent status, charge details, non-existent PI returns error |
| 04 Webhook Verification | Valid HMAC signature, invalid signature rejected, event payload structure |
| 05 Refund | Full refund, charge marked refunded, refund in list, double-refund blocked, partial refund |

### GUI Tests (5 tests)

| Test | What it checks |
|---|---|
| Dashboard loads | Test mode badge visible after session restore |
| Payment in list | Payment appears with correct amount |
| Payment detail | "Succeeded" status badge visible |
| Refund visible | "Refunded" label and refund amount on detail page |
| Amount formatting | "$20.00 USD" displayed correctly |

---

## Stripe Test Payment Methods

The tests use Stripe's predefined test Payment Method IDs — no raw card numbers needed:

| Constant | Payment Method ID | Behavior |
|---|---|---|
| `visa_success` | `pm_card_visa` | Always succeeds |
| `visa_decline` | `pm_card_visa_chargeDeclined` | Generic card decline |
| `visa_insufficient` | `pm_card_chargeDeclinedInsufficientFunds` | `insufficient_funds` decline |
| `three_d_secure` | `pm_card_threeDSecure2Required` | Requires 3DS authentication |
| `auth_required` | `pm_card_authenticationRequired` | Requires authentication |

---

## Notes

- Tests run **sequentially** (1 worker, no parallelism) because GUI tests depend on state produced by API tests.
- Shared state (paymentIntentId, chargeId, refundId) is written to `.test-state.json` between test files — this file is gitignored.
- Webhook tests use **local HMAC signature verification** — no public endpoint or running Stripe CLI listener required.
- `PAYMENT_AMOUNT` of `2000` equals **$20.00** — Stripe amounts are always in the smallest currency unit (cents for USD).
