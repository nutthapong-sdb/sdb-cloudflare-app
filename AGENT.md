# Project Overview

This is a Next.js application that provides a dashboard for interacting with the Cloudflare API. It allows users to view and manage their Cloudflare zones, DNS records, and view traffic analytics. The application features a user authentication and management system. We are currently focusing on improving the accuracy of report generation, specifically ensuring all SSL/TLS and Security placeholders map correctly to real-time Cloudflare settings.

The frontend is built with React and Tailwind CSS, and the backend is powered by Next.js API Routes and Server Actions. It uses `axios` to communicate with the Cloudflare API and `sqlite` for the user database.

# Features

*   **Zone & DNS Management:** View and manage Cloudflare zones and DNS records.
*   **Traffic Analytics:** Real-time visualization of traffic volume, top URLs, client IPs, and countries using Recharts.
*   **Security Monitoring:** Track WAF events, blocked attacks, and HTTP status code distributions.
*   **API Discovery:** Discover and manage API endpoints associated with your zones. Handles permissions gracefully (graceful degradation if feature is unavailable).
*   **Batch Reporting:** Automatically generate comprehensive reports for multiple sub-domains. This feature captures dashboard snapshots and aggregates data into a single downloadable Word document using Template Variables (e.g., `@TOP_HOST_VAL@`). Includes a "Promote to Domain Template" toggle that allows printing a specific subdomain's data utilizing the comprehensive domain `staticReportTemplate.json` instead of a sub-report template. Also supports exporting selected subdomains as separated `.doc` files bundled into a `.zip` (users can convert to `.docx` later).
*   **Dynamic Theming:** Centralized theme management supporting multiple themes (Dark, Pink Pastel, Corporate Blue). Theming applies globally to Sidebar, Modals, and Dashboard components via `app/utils/themes.js` and custom events.
*   **Robust API Security:** Explicit input validation of tokens/UUIDs and path traversal protections across all report and template generation endpoints.

# Building and Running

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Setup (Debugging):**
    While the App manages tokens via its User Management system, for **Script Debugging** and **Regression Testing**, you must configure `.env.local`:
    ```env
    # Required for scripts/debug/*.js
    CLOUDFLARE_API_TOKEN=your_token_here
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at [http://localhost:8002](http://localhost:8002).

4.  **Build for production:**
    ```bash
    npm run build
    ```

5.  **Start the production server:**
    ```bash
    npm run start
    ```

# Development Conventions

*   **Styling & Theming:**
    *   Uses Tailwind CSS for styling.
    *   **Theme System:** All theme colors and styles are centralized in `app/utils/themes.js`.
    *   Components subscribe to theme changes via the `theme-change` custom event.
    *   **Do not hardcode colors.** Use variables from the `theme` object (e.g., `theme.bg`, `theme.text`, `theme.card`) to ensure compatibility across Dark, Pastel, and Corporate themes.
*   **API & Security:** 
    *   The backend API is built with Next.js API Routes. The main endpoint is `/api/scrape` (Proxy to Cloudflare).
    *   All file-system operations (saving/deleting reports and templates) MUST sanitize filenames using `path.basename` and regex string replacement (e.g., `/[^a-zA-Z0-9.\-_]/g`) to prevent Path Traversal and HTTP Header Injection vulnerabilities.
    *   External IDs (Zone ID, Account ID) must undergo strict regex validation before use.
*   **Authentication:** User authentication is handled by Next.js Server Actions and session management using `localStorage`.
*   **Debug Scripts:**
    *   Located in `scripts/debug/` and `scripts/total_requests/`.
    *   **MUST** use `scripts/helpers.js` for consistent token retrieval and output formatting.
    *   **MUST** first fetch the **Zone ID (UUID)** using the Account/Zone Name before querying Traffic Analytics endpoints, matching the frontend logic (avoid using Zone Name directly).
    *   Output should be directed to the terminal with color-coded logs.
*   **Git Workflow & CI:**
    *   Branches should be created systematically using the `.agent/workflows/create_branch.md` workflow.
    *   Always use the `.agent/workflows/git_push.md` workflow to execute clean commits, merges, and pushes.
    *   Run `@lint-and-validate` to check for ESLint warnings/errors before pushing code.
*   **Dashboard & Report Generation Constraints:**
    *   **Scope Safety:** All variables used in report generation (such as `firewallRulesData`, `firewallActivity`) MUST be declared with `let` in the outer function scope before `if` success blocks. This prevents block-scoping ReferenceErrors during batch report generations.
    *   **WAF XSS Bypass:** Template saving API calls must Base64-encode their payload on the frontend, and API routes must decode it on the backend, preventing HTTP 403 blocks from Cloudflare's WAF.
    *   **Regression Tests:** When developing or modifying report generation flows, ensure regression tests are updated or created. All regression tests must detect and parse SweetAlert2 (or other UI alert) modal popups to output errors immediately and fail the test gracefully.

# Key Files

*   `app/page.js`: The main portal page with links to different systems.
*   `app/systems/gdcc/page.js`: The GDCC Analytics dashboard. Handles data visualization, report generation logic, logic for "Promote to Domain", and processing of template variables.
*   `app/systems/Sidebar.js`: The global sidebar component, fully themable and responsive.
*   `app/utils/themes.js`: Centralized configuration for all application themes (Dark, Pastel, Corporate).
*   `app/systems/api_discovery/page.js`: The SDB Cloudflare API dashboard for zone and API discovery management.
*   `app/api/scrape/route.js`: The core of the backend, handling all interactions with the Cloudflare API (Proxy to Cloudflare). Includes route parameter validation.
*   `app/utils/auth.js`: Handles user authentication and session management.
*   `app/actions/authActions.js`: Contains the Next.js Server Actions for authentication and user management.
*   `scripts/helpers.js`: Shared utility module for debug scripts (API Token loading, Logger).
*   `scripts/debug/test-template-variables.js`: regression script to verify all report template variables are populating correctly.
*   `package.json`: Defines the project's dependencies and scripts.

# Recent Changes (May 2026)

*   **Per-user report template preferences (UI-only):** Users can set a default template and hide templates (soft delete) per-user using `localStorage`. Hidden templates are filtered out of template selectors (Auto Report + Batch Report + Manage Templates), with safety to prevent hiding the last visible template.
    *   Main UI: `app/systems/gdcc/ManageTemplateModal.js`, `app/systems/gdcc/AutoReportModal.js`, `app/systems/gdcc/page.js`
    *   Storage keys: `gdcc:templates:<userId>:defaultTemplateId`, `gdcc:templates:<userId>:hiddenTemplateIds`

*   **Root-only hard delete:** In Manage Templates, `Hard delete` permanently deletes templates (non-`default`) for root users only; `default` cannot be hard deleted.

*   **Corporate theme readability improvements:** Updated hover and table/list contrast for Corporate Blue theme.
    *   Theme tokens: `app/utils/themes.js`
    *   UI adjustments: `app/systems/gdcc/page.js`

*   **Attack Prevention History fix:** The chart/table now derives from `result.data.firewallActivity` (the real API payload) instead of a non-existent `result.firewallData`.
    *   File: `app/systems/gdcc/page.js`

*   **Template modal white-screen fix:** Defensive handling for `/api/templates` non-array responses.
    *   Files: `app/utils/templateApi.js`, `app/systems/gdcc/ManageTemplateModal.js`

*   **Thai numeral rendering toggle (per-template, per-user):** Templates are stored with Arabic digits, but Preview + Word download can render digits as Thai numerals. A button in the Edit/Preview modal toggles Thai/Arabic output for the currently selected template (persisted per-user in `localStorage`).
    *   File: `app/systems/gdcc/page.js`
    *   Storage key: `gdcc:templates:<userId>:thaiDigits:<templateId>`
    *   Behavior: affects Preview + Word download only; saved template HTML remains unchanged (Arabic digits).

# Current Status (May 2026)

*   **Main focus area:** GDCC dashboard/reporting UX and correctness.
*   **Template management UX is now per-user (UI-only):** Default template + hidden templates are stored in `localStorage` keyed by `currentUser.id`. This does not change backend semantics of the built-in `default` template.
*   **Manage Templates supports:**
    *   Soft delete (hide) for all users (cannot hide the last visible template).
    *   Root-only hard delete for templates where `id !== 'default'`.
    *   "Show hidden templates" toggle to restore hidden ones.
*   **Attack Prevention History (Block/Challenge):** now built from `get-traffic-analytics` -> `data.firewallActivity` (fixes the previously empty chart caused by reading a non-existent field).
*   **Thai vs Arabic digits toggle (per-template):** button in the Edit/Preview modal controls whether Preview + Word download renders Thai digits; saved template stays Arabic.
*   **Docs entrypoint:** this file was renamed from `CLAUDE.md` to `AGENT.md`.
