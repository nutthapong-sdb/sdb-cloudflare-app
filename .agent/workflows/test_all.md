# Test Scripts Registry

Below is the list of all test scripts in the project. For safety, running global "test all" scripts is prohibited. Execute tests module by module to prevent configuration leakage.

## GDCC System Tests

### New Background Report Feature
- **Backend API Logic Test:**
  [test-background-report-backend.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/gdcc/test-background-report-backend.js)
  Verifies queueing and status polling via backend endpoints.
- **Frontend E2E UI Test:**
  [test-background-report-ui.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/gdcc/test-background-report-ui.js)
  Verifies SweetAlert, background worker execution, progress bar updates, and Background Jobs modal.

### Existing GDCC Tests
- **Dashboard Metrics:**
  [test-gdcc-dashboard-metrics.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/ntbc/test-gdcc-dashboard-metrics.js)
- **Zone Name Verification:**
  [test-gdcc-zone-name-live.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/ntbc/test-gdcc-zone-name-live.js)
- **Subdomain Report Capture:**
  [test-gdcc-subdomain-report-capture.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/ntbc/test-gdcc-subdomain-report-capture.js)
- **Defaults Regression:**
  [test-gdcc-defaults-regression.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/ntbc/test-gdcc-defaults-regression.js)
- **Firewall Regression:**
  [test-gdcc-firewall-regression.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/ntbc/test-gdcc-firewall-regression.js)
- **Subdomain Firewall:**
  [test-gdcc-subdomain-firewall.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/ntbc/test-gdcc-subdomain-firewall.js)
- **Traffic Time Window:**
  [test-traffic-time-window.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/ntbc/test-traffic-time-window.js)

## NTBC System Tests
- **CF Report Capture E2E:**
  [test-ntbc-cfreport-capture.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/ntbc/test-ntbc-cfreport-capture.js)

## API Discovery Tests
- **API Endpoints Test:**
  [test-api.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/api_discovery/test-api.js)

## Firewall Tests
- **WAF Security Test:**
  [test-firewall.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/firewall/test-firewall.js)

## Auth Tests
- **User Login Action Test:**
  [test-login.js](file:///Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/scripts/test-all/auth/test-login.js)
