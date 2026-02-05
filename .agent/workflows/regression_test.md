---
description: เรียก workflow นี้ทุกครั้งที่ต้องการทดสอบระบบทั้งหมด (API, UI, และ Traffic Analytics)
---

1. Start the development server in the background (if not already running).
   ```bash
   # Check if port 8002 is in use, verify locally
   # Ideally, the user should have the server running. The test script assumes `localhost:8002` is accessible.
   ```

2. Run the API regression test script (Uses System User Token).
   // turbo
   ```bash
   node scripts/regression_test/test-api.js
   ```

3. Run the Traffic Analytics validation script (Total Requests).
   // turbo
   ```bash
   node scripts/total_requests/test-total-requests.js
   ```

4. Run the Template Variable validation script.
   // turbo
   ```bash
   node scripts/debug/test-template-variables.js
   ```

5. Run the DNS check script (Default: BDMS Group1 / bdms.co.th).
   // turbo
   ```bash
   node scripts/dns_check/test-dns-specific.js
   ```

6. Run the Firewall Logs regression test (Account: Siam Cement).
   // turbo
   ```bash
   node scripts/regression_test/test-firewall-logs.js
   ```

7. Review the API and Data test output.
   - Look for "PASS" in green and ensure total requests are displayed.
   - Review the "TEMPLATE VARIABLE DATA STATUS" report to ensure key variables are loaded.
   - Ensure "Cloudflare Token Verification" and API calls succeed.
   - DNS check should display total records by type and proxy status.
   - Firewall Logs check should display "found" for Account and Zone, and fetch logs successfully.

8. Run the Full UI regression test script (Puppeteer).
   // turbo
   ```bash
   node scripts/regression_test/test-all-ui.js
   ```

9. Review the UI test output.
   - Look for "Login Successful" and "Tests Completed".
   - If failed, check `regression-failure.png`.
