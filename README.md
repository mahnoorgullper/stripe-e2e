# Stripe Payment Processing E2E Tests

Automated end-to-end tests for a full Stripe Sandbox payment workflow using **Playwright + JavaScript**, with **Allure reports** published to GitHub Pages on every push/PR.

## Workflow Under Test

```
Create PaymentIntent → Confirm (test card) → Retrieve status
       → Verify webhook → Refund → GUI validation (Stripe Dashboard)
```

## Project Structure

```
stripe-e2e/
├── tests/
│   ├── api/
│   │   ├── 01-create-payment-intent.spec.js   # Create & validate PI
│   │   ├── 02-confirm-payment-intent.spec.js  # Confirm with test cards
│   │   ├── 03-retrieve-payment-status.spec.js # Retrieve & verify status
│   │   ├── 04-webhook-verification.spec.js    # Webhook signing/verification
│   │   └── 05-refund-payment.spec.js          # Full & partial refunds
│   └── gui/
│       └── 06-dashboard-gui.spec.js           # Stripe Dashboard GUI checks
├── utils/
│   ├── stripe-api.js      # Stripe SDK wrapper & test card constants
│   └── shared-state.js    # Persists paymentIntentId/chargeId between tests
├── .github/
│   └── workflows/
│       └── e2e-tests.yml  # CI/CD pipeline + GitHub Pages deployment
├── playwright.config.js
├── package.json
└── .env.example
```

## Setup

### 1. Clone & install

```bash
git clone <your-repo>
cd stripe-e2e
npm install
npx playwright install chromium
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Where to find it |
|---|---|
| `STRIPE_SECRET_KEY` | [Stripe Dashboard → API keys](https://dashboard.stripe.com/test/apikeys) (starts with `sk_test_`) |
| `STRIPE_PUBLISHABLE_KEY` | Same page (starts with `pk_test_`) |
| `STRIPE_WEBHOOK_SECRET` | Run `stripe listen --print-secret` (Stripe CLI) or create a webhook endpoint in Dashboard |
| `STRIPE_DASHBOARD_EMAIL` | Your Stripe account email |
| `STRIPE_DASHBOARD_PASSWORD` | Your Stripe account password |

### 3. Run tests locally

```bash
# All tests (API then GUI)
npm test

# API only
npm run test:api

# GUI only (requires API tests to have run first — .test-state.json must exist)
npm run test:gui

# With browser visible
npm run test:headed
```

### 4. View Allure report

```bash
npm run allure:generate
npm run allure:open
```

## GitHub Actions Setup

### Required Secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe test secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe test publishable key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_DASHBOARD_EMAIL` | Stripe Dashboard login email |
| `STRIPE_DASHBOARD_PASSWORD` | Stripe Dashboard login password |

### GitHub Pages Setup

1. Go to **Settings → Pages**
2. Set Source to **GitHub Actions**
3. After the first push to `main`, the Allure report will be live at `https://<your-username>.github.io/<repo-name>/`

The workflow also uploads the report as a **downloadable artifact** (`allure-report-<run-number>`) on every run for PRs and non-main branches.

## Test Coverage

### API Tests (tests/api/)

| Test | What it checks |
|---|---|
| Create PaymentIntent | Amount, currency, status=`requires_payment_method`, client_secret format |
| Create with invalid data | Zero amount, negative amount, unsupported currency are rejected |
| Confirm (success) | status=`succeeded`, amount_received matches, charge ID returned |
| Confirm (declined card) | `card_declined` error returned |
| Confirm (insufficient funds) | `insufficient_funds` decline_code returned |
| Retrieve PaymentIntent | Status, amount, charge linkage after confirmation |
| Retrieve Charge | paid, captured, amount_refunded=0, card brand/last4 |
| Retrieve non-existent PI | 404 error returned |
| Webhook signature | Signing + `constructEvent` verification |
| Invalid webhook signature | `StripeSignatureVerificationError` thrown |
| charge.refunded payload | Event structure validated |
| Full refund | refund.status=`succeeded`, amount matches |
| Charge after refund | amount_refunded=full, refunded=true |
| Refund in list | Refund appears in `stripe.refunds.list` |
| Double refund prevention | `charge_already_refunded` error |
| Partial refund | Partial amount, refunded=false on charge |

### GUI Tests (tests/gui/)

| Test | What it checks |
|---|---|
| Login | Successful auth, test mode badge visible |
| Payment in list | Payment appears with correct amount |
| Status on detail page | "Succeeded" badge visible |
| Refund visible | "Refunded" text and amount on detail page |
| Amount formatting | "$20.00 USD" displayed correctly |

## Stripe Test Card Numbers

| Card | Number | Behavior |
|---|---|---|
| Visa (success) | `4242 4242 4242 4242` | Always succeeds |
| Generic decline | `4000 0000 0000 0002` | Always declines |
| Insufficient funds | `4000 0000 0000 9995` | `insufficient_funds` decline |
| 3D Secure required | `4000 0000 0000 3220` | Requires authentication |

Use any future expiry date, any 3-digit CVC, any billing ZIP.

## Notes

- Tests run **sequentially** (not in parallel) because GUI tests depend on state from API tests.
- State is persisted in `.test-state.json` between test files (gitignored).
- Webhook tests use **local signature verification** — no public endpoint required.
- GUI tests are skipped automatically if `STRIPE_DASHBOARD_EMAIL`/`PASSWORD` are not set.
