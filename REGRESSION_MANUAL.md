# Regression Testing Manual

This manual guides you through running the regression test suite for the SDB/GDCC Cloudflare Dashboard.

## Prerequisites

1.  **Node.js**: Ensure Node.js is installed.
2.  **Server Running**: The regression script tests the backend API using `http://localhost:8002`. **The development server must be running.**
    ```bash
    npm run dev
    ```
3.  **Environment Variables**: The script automatically loads `CLOUDFLARE_API_TOKEN` from `.env.local` if it exists.

## Running the Tests

To run the regression tests, execute the following command in a new terminal window (keep the server running in the other one):

```bash
node scripts/regression-test.js
```

## What is Tested?

The script performs the following checks:

### 1. Cloudflare Connectivity
- **Token Validity**: Verifies if the configured `CLOUDFLARE_API_TOKEN` is valid by directly interacting with Cloudflare's API.

### 2. SDB System (API Discovery)
- **Get Account Info**: Checks if the system can list Cloudflare accounts.
- **List Zones**: Checks if the system can retrieve zones for the account.
- **Get API Discovery**:
    - Verifies that API Discovery data is fetched for the first available zone.
    - **Critical Check**: validatse that the `method` (e.g., GET, POST) and `source` fields are present in the response, confirming the recent fix.

### 3. GDCC System (Analytics & Reporting)
- **Get Zone Settings**: Checks if security settings (Security Level, WAF, Bot Management) are correctly retrieved. This verifies the data used for the "Domain Report".
- **Get Traffic Analytics**: Verifies that traffic data (requests, bandwidth) can be fetched without errors.

### 4. UI Regression (Puppeteer)
- **Login**: Simulates a login using default credentials (`root` / `password`).
- **SDB Navigation**: Navigates to the SDB System.
- **Visual Verification**:
    - Automatically selects the first Account and first Zone.
    - **Crucial**: Verifies that the Table Columns **"Method"** and **"Source"** are physically present in the DOM.
    - **GDCC System**:
      - **Time Ranges**: Clicks 30m, 6h, 12h, 24h buttons to verify interactivity.
      - **Reports**: 
        - **Domain Report**: Opens modal and verifies title.
        - **Batch Report**: Opens modal, **selects first sub-domain**, clicks **Generate**, waits for **Success Alert**, and clicks **OK**.
        - **Sub Report**: Opens modal and verifies title "Preview Report".
        - Verifies that modals can be closed properly.
    - **Visible Mode**: The test runs in `headless: false` mode, so you will see a Chromium window open and perform the actions.

## Troubleshooting

- **Connection Refused**: Ensure the local server is running on port 8002 (`http://localhost:8002`).
- **Token Invalid**: Check your `.env.local` file and ensure the API Token has the correct permissions (Account:Read, Zone:Read, API Gateway:Read).
- **No Data Found**: This is usually a warning, not an error. It means the API call worked, but the zone has no data (e.g., no API traffic discovered).
- **UI Test Failed / Timeout**: Check `regression-failure.png`. 
  - If the test hangs at "Entering credentials...", it might be a Puppeteer headless mode issue. Try running with `headless: false` in `scripts/ui-regression-test.js` to see the browser.
  - Ensure the local development server is fully responsive.

---
*Last Updated: 2026-01-27*
