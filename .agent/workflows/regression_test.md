---
description: Run regression tests to verify SDB and GDCC system functionality
---

1. Start the development server in the background (if not already running).
   ```bash
   # Check if port 8002 is in use, if not start server
   lsof -i :8002 || npm run dev &
   ```
   > Note: Ideally, the user should have the server running. The test script assumes `localhost:8002` is accessible.

2. Run the regression test script.
   // turbo
   ```bash
   node scripts/regression-test.js
   ```

3. Review the output.
   - Look for "PASS" in green.
   - If "FAIL" appears, check the error message and the `REGRESSION_MANUAL.md` for troubleshooting.

4. Run the UI regression test script (Puppeteer).
   // turbo
   ```bash
   node scripts/ui-regression-test.js
   ```

5. Review the UI test output.
   - Look for "Login Successful" and "Table found".
   - If failed, check `regression-failure.png`.
